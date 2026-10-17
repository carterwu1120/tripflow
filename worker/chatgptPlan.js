// Calls the Responses API on the owner's ChatGPT plan ("Sign in with ChatGPT"
// plan usage). Tokens come from scripts/connect-chatgpt.mjs and live in the
// single-row `openai_session` D1 table.

const TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token";
const RESPONSES_URL = "https://api.openai.com/v1/responses";
const RESOURCE = "https://api.openai.com/v1";
const REFRESH_MARGIN_MS = 2 * 60 * 1000;
const RECONNECT_HINT = "Run `node scripts/connect-chatgpt.mjs --local` (dev) or `--remote` (production) to connect ChatGPT.";

export class PlanError extends Error {
  constructor(message, { code = "plan_error", status = 502 } = {}) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function readSession(env) {
  if (!env.DB) throw new PlanError("D1 is not configured.", { code: "not_configured", status: 503 });
  return env.DB.prepare(
    "SELECT client_id, refresh_token, access_token, access_expires_at, model FROM openai_session WHERE id = 1",
  ).first();
}

function resolveModel(env, session) {
  const model = env.OPENAI_PLAN_MODEL || session.model;
  if (!model) throw new PlanError("No ChatGPT model is configured.", { code: "no_model", status: 503 });
  return model;
}

export async function getPlanStatus(env) {
  try {
    const session = await readSession(env);
    if (!session) return { connected: false, model: null };
    return { connected: true, model: env.OPENAI_PLAN_MODEL || session.model || null };
  } catch {
    // Most likely the migration has not been applied yet.
    return { connected: false, model: null };
  }
}

// Refresh tokens rotate: each refresh returns a new one and retires the old.
// The UPDATE only lands if the row still holds the token we started from, so
// two requests refreshing at once cannot overwrite each other.
async function refreshSession(env, session) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: session.client_id,
      refresh_token: session.refresh_token,
      resource: RESOURCE,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    const latest = await readSession(env);
    if (latest && latest.refresh_token !== session.refresh_token) return latest;
    throw new PlanError(`ChatGPT connection expired. ${RECONNECT_HINT}`, { code: "needs_reconnect", status: 401 });
  }

  const nextRefreshToken = data.refresh_token ?? session.refresh_token;
  const expiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  const result = await env.DB.prepare(`
    UPDATE openai_session
    SET access_token = ?, refresh_token = ?, access_expires_at = ?, updated_at = ?
    WHERE id = 1 AND refresh_token = ?
  `).bind(data.access_token, nextRefreshToken, expiresAt, new Date().toISOString(), session.refresh_token).run();

  if (result.meta?.changes === 0) return readSession(env);
  return { ...session, access_token: data.access_token, refresh_token: nextRefreshToken, access_expires_at: expiresAt };
}

async function getSession(env, { forceRefresh = false } = {}) {
  const session = await readSession(env);
  if (!session) throw new PlanError(`ChatGPT is not connected yet. ${RECONNECT_HINT}`, { code: "not_connected", status: 409 });
  if (forceRefresh || session.access_expires_at - Date.now() < REFRESH_MARGIN_MS) {
    return refreshSession(env, session);
  }
  return session;
}

function failureFromEvent(event) {
  const error = event.response?.error ?? event.error ?? event;
  const code = String(error?.code ?? "");
  const message = error?.message ?? "ChatGPT could not complete the request.";
  const isUsageLimit = /usage|rate|limit|quota/i.test(code);
  return new PlanError(
    isUsageLimit ? `ChatGPT plan usage limit reached. Try again later. (${message})` : message,
    { code: isUsageLimit ? "usage_limit" : "plan_error", status: isUsageLimit ? 429 : 502 },
  );
}

// Plan usage requires stream: true. Collect the text deltas and only trust the
// result once `response.completed` arrives.
async function readStreamedText(body) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let output = "";
  let completed = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value.replace(/\r\n/g, "\n");

    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (!data || data === "[DONE]") continue;

      const event = JSON.parse(data);
      if (event.type === "response.output_text.delta") output += event.delta ?? "";
      else if (event.type === "response.completed") completed = true;
      else if (event.type === "response.failed" || event.type === "error") throw failureFromEvent(event);
    }
  }

  if (!completed) throw new PlanError("ChatGPT stream ended before the response completed.");
  return output;
}

export async function runResponse(env, { instructions, text, imageDataUrl }) {
  const content = [];
  if (text) content.push({ type: "input_text", text });
  if (imageDataUrl) content.push({ type: "input_image", image_url: imageDataUrl });
  if (!content.length) throw new PlanError("Provide text or an image.", { code: "bad_request", status: 422 });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session = await getSession(env, { forceRefresh: attempt > 0 });
    const body = {
      model: resolveModel(env, session),
      store: false,
      stream: true,
      input: [{ role: "user", content }],
    };
    if (instructions) body.instructions = instructions;

    const response = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${session.access_token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    // A rejected access token gets one forced refresh before giving up.
    if (response.status === 401 && attempt === 0) continue;
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      const isUsageLimit = response.status === 429;
      throw new PlanError(`ChatGPT returned ${response.status}: ${detail}`, {
        code: isUsageLimit ? "usage_limit" : "plan_error",
        status: isUsageLimit ? 429 : 502,
      });
    }
    return readStreamedText(response.body);
  }
  throw new PlanError(`ChatGPT rejected the access token. ${RECONNECT_HINT}`, { code: "needs_reconnect", status: 401 });
}
