#!/usr/bin/env node
// Connect TripFlow to YOUR ChatGPT plan ("Sign in with ChatGPT" plan usage for
// open-source apps). Run it on your own computer:
//
//   node scripts/connect-chatgpt.mjs --local            # write to local D1 (wrangler dev)
//   node scripts/connect-chatgpt.mjs --remote           # write to production D1
//   node scripts/connect-chatgpt.mjs --remote --model <slug>
//
// It opens a ChatGPT sign-in page, receives the callback on 127.0.0.1, and
// stores the resulting tokens in the `openai_session` D1 table. Tokens are
// never written to disk in this repo; .siwc/ only keeps the host id and the
// issued client id so later runs reuse the same registration.

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const AUTHORIZE_URL = "https://auth.openai.com/api/accounts/authorize";
const TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token";
const MODELS_URL = "https://api.openai.com/v1/models";
const RESOURCE = "https://api.openai.com/v1";
const SCOPE = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const PLAN_SCOPE = "chatgpt.tokens.use.direct";
const PORT = 1455;
const CALLBACK_PATH = "/auth/callback";
const REDIRECT_URI = `http://127.0.0.1:${PORT}${CALLBACK_PATH}`;
const DATABASE = "tripflow-production";
const STATE_DIR = ".siwc";
const HOST_FILE = join(STATE_DIR, "host.json");
const CLIENT_FILE = join(STATE_DIR, "client.json");
const TIMEOUT_MS = 5 * 60 * 1000;

const args = process.argv.slice(2);
const target = args.includes("--remote") ? "--remote" : args.includes("--local") ? "--local" : null;
const modelArgIndex = args.indexOf("--model");
const requestedModel = modelArgIndex >= 0 ? args[modelArgIndex + 1] : null;

if (!target) {
  console.error("Choose where to store the connection: --local (wrangler dev) or --remote (production).");
  process.exit(1);
}

const base64url = (buffer) => buffer.toString("base64url");

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function hostId() {
  mkdirSync(STATE_DIR, { recursive: true });
  const saved = readJson(HOST_FILE);
  if (saved?.ext_agent_host_id) return saved.ext_agent_host_id;
  const id = `urn:uuid:${randomUUID()}`;
  writeFileSync(HOST_FILE, JSON.stringify({ ext_agent_host_id: id }, null, 2));
  return id;
}

function openBrowser(url) {
  const [command, commandArgs] = process.platform === "win32"
    ? ["powershell", ["-NoProfile", "-Command", `Start-Process '${url}'`]]
    : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(command, commandArgs, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}

function waitForCallback(expectedState) {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url, REDIRECT_URI);
      if (url.pathname !== CALLBACK_PATH) {
        response.writeHead(404).end();
        return;
      }
      const finish = (status, message, settle) => {
        response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
        response.end(`<!doctype html><meta charset="utf-8"><p style="font:16px system-ui;padding:2rem">${message}</p>`);
        server.close();
        clearTimeout(timer);
        settle();
      };
      const error = url.searchParams.get("error");
      if (error) {
        const detail = url.searchParams.get("error_description") ?? "";
        return finish(400, "ChatGPT sign-in was cancelled or failed. You can close this tab.",
          () => reject(new Error(`Authorization failed: ${error} ${detail}`.trim())));
      }
      if (url.searchParams.get("state") !== expectedState) {
        return finish(400, "State mismatch. Please run the script again.", () => reject(new Error("State mismatch.")));
      }
      return finish(200, "TripFlow is connected to ChatGPT. You can close this tab.", () => resolve(url.searchParams));
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for the ChatGPT sign-in callback."));
    }, TIMEOUT_MS);
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1");
  });
}

async function exchangeCode({ clientId, code, verifier }) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
      resource: RESOURCE,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token || !data.refresh_token) {
    const reason = [data.error, data.error_description].filter(Boolean).join(" ");
    throw new Error(`Token exchange failed (${response.status}). ${reason}`.trim());
  }
  return data;
}

async function listModels(accessToken) {
  const response = await fetch(MODELS_URL, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Listing models failed (${response.status}). This account may not have plan usage.`);
  const data = await response.json();
  const models = data.data ?? data.models ?? [];
  return models
    .filter((model) => (model.visibility ?? "list") === "list")
    .map((model) => ({ slug: model.slug ?? model.id, name: model.display_name ?? model.slug ?? model.id }))
    .filter((model) => model.slug);
}

function sqlString(value) {
  if (value == null) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function storeSession({ clientId, tokens, model }) {
  const expiresAt = Date.now() + (Number(tokens.expires_in) || 3600) * 1000;
  const values = [
    "1",
    sqlString(clientId),
    sqlString(tokens.refresh_token),
    sqlString(tokens.access_token),
    String(expiresAt),
    sqlString(model),
    sqlString(new Date().toISOString()),
  ].join(", ");
  const sql = "INSERT OR REPLACE INTO openai_session "
    + "(id, client_id, refresh_token, access_token, access_expires_at, model, updated_at) "
    + `VALUES (${values});`;

  // The SQL holds live tokens, so it goes to a private temp file that is
  // deleted right after wrangler reads it.
  const sqlFile = join(tmpdir(), `tripflow-openai-session-${randomUUID()}.sql`);
  writeFileSync(sqlFile, sql, { mode: 0o600 });
  try {
    const result = spawnSync("npx", ["wrangler", "d1", "execute", DATABASE, target, "--file", `"${sqlFile}"`], {
      stdio: "inherit",
      shell: true,
    });
    if (result.status !== 0) throw new Error("wrangler d1 execute failed. Did you apply the migration first?");
  } finally {
    unlinkSync(sqlFile);
  }
}

async function main() {
  const savedClient = readJson(CLIENT_FILE);
  const isFirstRegistration = !savedClient?.client_id;
  const verifier = base64url(randomBytes(48));
  const state = base64url(randomBytes(24));
  const nonce = base64url(randomBytes(24));

  const authorize = new URL(AUTHORIZE_URL);
  const params = {
    client_id: isFirstRegistration ? "dynamic_agent_client" : savedClient.client_id,
    ext_agent_host_id: hostId(),
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    resource: RESOURCE,
    state,
    nonce,
    code_challenge: base64url(createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
  };
  if (isFirstRegistration) params.agent_name_hint = "TripFlow";
  for (const [key, value] of Object.entries(params)) authorize.searchParams.set(key, value);

  const callback = waitForCallback(state);
  console.log("\nOpening ChatGPT sign-in. If the browser does not open, visit:\n");
  console.log(`${authorize}\n`);
  openBrowser(authorize.toString());

  const query = await callback;
  const clientId = query.get("client_id") ?? savedClient?.client_id;
  if (!clientId || clientId === "dynamic_agent_client") {
    throw new Error("The callback did not include an issued client_id.");
  }
  writeFileSync(CLIENT_FILE, JSON.stringify({ client_id: clientId }, null, 2));

  const tokens = await exchangeCode({ clientId, code: query.get("code"), verifier });
  const granted = String(tokens.scope ?? "").split(/\s+/);
  if (tokens.scope && !granted.includes(PLAN_SCOPE)) {
    throw new Error("This ChatGPT account did not grant plan usage. Plan usage needs ChatGPT Plus or Pro.");
  }

  const models = await listModels(tokens.access_token);
  if (!models.length) throw new Error("No models are available on this plan.");
  console.log("Models available on your plan:");
  for (const model of models) console.log(`  - ${model.slug}  (${model.name})`);

  const model = requestedModel ?? models[0].slug;
  if (!models.some((item) => item.slug === model)) throw new Error(`Model "${model}" is not on your plan.`);
  console.log(`\nUsing model: ${model}  (change later with --model <slug>)\n`);

  storeSession({ clientId, tokens, model });
  const where = target === "--remote" ? "production" : "local";
  console.log(`\nDone. TripFlow (${where}) can now use your ChatGPT plan.`);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
