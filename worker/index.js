import { getPlanStatus, PlanError, runResponse } from "./chatgptPlan.js";

const GOOGLE_HOSTS = new Set(["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]);
const TRIP_ID = "okinawa-2027";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function isAllowedGoogleUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (GOOGLE_HOSTS.has(url.hostname) || url.hostname.endsWith(".google.com"));
  } catch {
    return false;
  }
}

function coordinatesFromUrl(value) {
  const decoded = decodeURIComponent(value);
  const match = decoded.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/)
    ?? decoded.match(/[?&](?:query|q)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}

async function expandGoogleUrl(value) {
  if (!isAllowedGoogleUrl(value)) throw new Error("Only HTTPS Google Maps links are supported.");
  let current = new URL(value);

  for (let count = 0; count < 5; count += 1) {
    const response = await fetch(current, { method: "GET", redirect: "manual" });
    if (response.status < 300 || response.status >= 400) return current.toString();
    const location = response.headers.get("location");
    if (!location) return current.toString();
    const next = new URL(location, current);
    if (!isAllowedGoogleUrl(next.toString())) throw new Error("Google redirect left the allowed domain list.");
    current = next;
  }

  throw new Error("The Google Maps link redirected too many times.");
}

function looksLikePlaceName(candidate) {
  if (!candidate) return false;
  if (candidate.startsWith("data=")) return false;
  if (candidate.includes("!")) return false;
  return true;
}

function queryFromMapsUrl(value) {
  const url = new URL(value);
  const parameter = url.searchParams.get("query") ?? url.searchParams.get("q");
  if (parameter && !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(parameter)) return parameter;
  const match = decodeURIComponent(url.pathname).match(/\/maps\/place\/([^/]+)/);
  const candidate = match?.[1]?.replace(/\+/g, " ") ?? null;
  return looksLikePlaceName(candidate) ? candidate : null;
}

async function searchPlace(textQuery, apiKey) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.regularOpeningHours",
    },
    body: JSON.stringify({ textQuery, languageCode: "zh-TW", regionCode: "JP", maxResultCount: 1 }),
  });
  if (!response.ok) throw new Error(`Google Places returned ${response.status}.`);
  const data = await response.json();
  return data.places?.[0] ?? null;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  const allowed = env.ALLOWED_ORIGIN;
  if (!origin) return {};
  if (allowed && origin !== allowed) return null;
  if (!allowed && !origin.startsWith("http://localhost:") && !origin.startsWith("http://127.0.0.1:")) return null;
  return { "access-control-allow-origin": origin, vary: "Origin" };
}

async function resolvePlace(request, env) {
  const cors = corsHeaders(request, env);
  if (cors === null) return json({ error: "Origin not allowed." }, 403);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } });
  }
  if (request.method !== "POST") return json({ error: "Use POST." }, 405, cors);

  try {
    const body = await request.json();
    const suppliedUrl = typeof body.url === "string" ? body.url.trim() : "";
    const suppliedName = typeof body.name === "string" ? body.name.trim() : "";
    if (suppliedUrl.length > 2048 || suppliedName.length > 200) {
      return json({ error: "The place name or URL is too long." }, 413, cors);
    }
    if (!suppliedUrl && !suppliedName) {
      return json({ error: "Provide a Google Maps link or place name." }, 422, cors);
    }
    const resolvedUrl = suppliedUrl ? await expandGoogleUrl(suppliedUrl) : null;
    const directCoordinates = resolvedUrl ? coordinatesFromUrl(resolvedUrl) : null;

    if (directCoordinates) {
      const inferredName = suppliedName || queryFromMapsUrl(resolvedUrl) || null;
      return json({ ...directCoordinates, name: inferredName, resolvedUrl, accuracy: "confirmed", source: "maps-redirect" }, 200, cors);
    }

    const query = (resolvedUrl && queryFromMapsUrl(resolvedUrl)) || suppliedName;
    if (!query) return json({ error: "No searchable place name was found in this link." }, 422, cors);
    if (!env.GOOGLE_MAPS_API_KEY) return json({ error: "GOOGLE_MAPS_API_KEY is not configured." }, 503, cors);

    const place = await searchPlace(`${query} Okinawa Japan`, env.GOOGLE_MAPS_API_KEY);
    if (!place?.location) return json({ error: "Google Places could not find this location." }, 404, cors);
    return json({
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      name: place.displayName?.text ?? suppliedName,
      formattedAddress: place.formattedAddress ?? null,
      googlePlaceId: place.id,
      openingHoursPeriods: place.regularOpeningHours?.periods ?? null,
      resolvedUrl,
      accuracy: "confirmed",
      source: "places-api",
    }, 200, cors);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to resolve this place." }, 400, cors ?? {});
  }
}

function isFiniteCoordinate(point) {
  return Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude);
}

async function computeTravelTime(request, env) {
  const cors = corsHeaders(request, env);
  if (cors === null) return json({ error: "Origin not allowed." }, 403);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } });
  }
  if (request.method !== "POST") return json({ error: "Use POST." }, 405, cors);

  try {
    const body = await request.json();
    if (!isFiniteCoordinate(body.from) || !isFiniteCoordinate(body.to)) {
      return json({ error: "Provide from/to coordinates." }, 422, cors);
    }
    if (!env.GOOGLE_MAPS_API_KEY) return json({ error: "GOOGLE_MAPS_API_KEY is not configured." }, 503, cors);

    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: body.from.latitude, longitude: body.from.longitude } } },
        destination: { location: { latLng: { latitude: body.to.latitude, longitude: body.to.longitude } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
    });
    if (!response.ok) throw new Error(`Google Routes returned ${response.status}.`);
    const data = await response.json();
    const durationSeconds = Number(data.routes?.[0]?.duration?.replace(/s$/, ""));
    if (!Number.isFinite(durationSeconds)) return json({ error: "Google Routes could not find a driving route." }, 404, cors);
    const polyline = data.routes?.[0]?.polyline?.encodedPolyline ?? null;
    return json({ minutes: Math.round(durationSeconds / 60), mode: "driving", polyline }, 200, cors);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to compute travel time." }, 400, cors ?? {});
  }
}

async function authenticatedEmail(ctx) {
  const identity = await ctx.access?.getIdentity?.();
  return typeof identity?.email === "string" ? identity.email.toLowerCase() : null;
}

async function planDocument(request, env, ctx) {
  const cors = corsHeaders(request, env);
  if (cors === null) return json({ error: "Origin not allowed." }, 403);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        "access-control-allow-methods": "GET, PUT, OPTIONS",
        "access-control-allow-headers": "content-type",
      },
    });
  }

  const email = await authenticatedEmail(ctx);
  if (!email) return json({ error: "Cloud sync requires Cloudflare Access." }, 401, cors);
  if (!env.DB) return json({ error: "D1 is not configured." }, 503, cors);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT data, version, updated_at, updated_by_email FROM trip_documents WHERE id = ?",
    ).bind(TRIP_ID).first();
    if (!row) return json({ error: "No cloud itinerary exists yet." }, 404, { ...cors, "cache-control": "no-store" });
    return json({
      plan: JSON.parse(row.data),
      version: row.version,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by_email,
    }, 200, { ...cors, "cache-control": "no-store" });
  }

  if (request.method !== "PUT") return json({ error: "Use GET or PUT." }, 405, cors);
  const raw = await request.text();
  if (raw.length > 1_000_000) return json({ error: "The itinerary is too large." }, 413, cors);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON." }, 400, cors);
  }
  if (!body?.plan?.trip?.days || !Array.isArray(body.plan.trip.days)) {
    return json({ error: "Invalid itinerary data." }, 422, cors);
  }

  const updatedAt = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO trip_documents (id, data, version, updated_at, updated_by_email)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      data = excluded.data,
      version = trip_documents.version + 1,
      updated_at = excluded.updated_at,
      updated_by_email = excluded.updated_by_email
  `).bind(TRIP_ID, JSON.stringify(body.plan), updatedAt, email).run();
  const saved = await env.DB.prepare(
    "SELECT version FROM trip_documents WHERE id = ?",
  ).bind(TRIP_ID).first();
  return json({ version: saved.version, updatedAt, updatedBy: email }, 200, { ...cors, "cache-control": "no-store" });
}

const RECEIPT_CATEGORIES = ["flight", "hotel", "rental-car", "food", "shopping", "other"];
const MAX_IMAGE_DATA_URL_LENGTH = 8_000_000;

const RECEIPT_INSTRUCTIONS = `You read a photo of a shop receipt and reply with one JSON object and nothing else.
Fields:
- "label": the shop or merchant name as printed, in its original language.
- "amount": the final total actually charged, as a plain number without currency symbols or separators.
- "currency": the ISO 4217 code, such as "JPY" or "TWD", inferred from the receipt.
- "category": one of ${RECEIPT_CATEGORIES.join(", ")}.
The final total is the line labelled 合計, 総合計, お会計, 總計 or Total. Never use the cash handed over (お預り, 預り金) or the change returned (お釣り, 找零), and never use a subtotal (小計) when a total is printed.
Use null for any field you cannot read.`;

// These endpoints spend the owner's ChatGPT plan, so they require the same
// Cloudflare Access identity as cloud sync. Local `wrangler dev` has no Access
// identity, so `npm run worker:dev` passes AI_ALLOW_UNAUTHENTICATED=1. The
// bypass also requires a localhost hostname, so the flag alone never opens
// the production deployment.
function isLocalBypass(request, env) {
  const { hostname } = new URL(request.url);
  return env.AI_ALLOW_UNAUTHENTICATED === "1" && (hostname === "localhost" || hostname === "127.0.0.1");
}

async function aiGuard(request, env, ctx, method) {
  const cors = corsHeaders(request, env);
  if (cors === null) return { response: json({ error: "Origin not allowed." }, 403) };
  if (request.method === "OPTIONS") {
    return {
      response: new Response(null, {
        status: 204,
        headers: { ...cors, "access-control-allow-methods": `${method}, OPTIONS`, "access-control-allow-headers": "content-type" },
      }),
    };
  }
  if (request.method !== method) return { response: json({ error: `Use ${method}.` }, 405, cors) };
  const email = await authenticatedEmail(ctx);
  if (!email && !isLocalBypass(request, env)) {
    return { response: json({ error: "AI features require Cloudflare Access." }, 401, cors) };
  }
  return { cors };
}

function aiError(error, cors) {
  if (error instanceof PlanError) return json({ error: error.message, code: error.code }, error.status, cors);
  return json({ error: error instanceof Error ? error.message : "AI request failed." }, 500, cors);
}

async function readAiBody(request) {
  try {
    return await request.json();
  } catch {
    throw new PlanError("Invalid JSON.", { code: "bad_request", status: 400 });
  }
}

function readImage(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^data:image\/(jpeg|png|webp|gif);base64,/.test(value)) {
    throw new PlanError("The image must be a base64 data URL.", { code: "bad_request", status: 422 });
  }
  if (value.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new PlanError("The image is too large.", { code: "bad_request", status: 413 });
  }
  return value;
}

function parseJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeReceipt(raw) {
  const amount = Number(raw.amount);
  return {
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, 120) : null,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    currency: typeof raw.currency === "string" ? raw.currency.trim().toUpperCase().slice(0, 3) : null,
    category: RECEIPT_CATEGORIES.includes(raw.category) ? raw.category : "other",
  };
}

async function aiStatus(request, env, ctx) {
  const guard = await aiGuard(request, env, ctx, "GET");
  if (guard.response) return guard.response;
  return json(await getPlanStatus(env), 200, { ...guard.cors, "cache-control": "no-store" });
}

async function aiTest(request, env, ctx) {
  const guard = await aiGuard(request, env, ctx, "POST");
  if (guard.response) return guard.response;
  try {
    const body = await readAiBody(request);
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 8000) : "";
    const output = await runResponse(env, { text, imageDataUrl: readImage(body.image) });
    return json({ output }, 200, guard.cors);
  } catch (error) {
    return aiError(error, guard.cors);
  }
}

async function scanReceipt(request, env, ctx) {
  const guard = await aiGuard(request, env, ctx, "POST");
  if (guard.response) return guard.response;
  try {
    const body = await readAiBody(request);
    const image = readImage(body.image);
    if (!image) throw new PlanError("Provide a receipt photo.", { code: "bad_request", status: 422 });
    const output = await runResponse(env, {
      instructions: RECEIPT_INSTRUCTIONS,
      text: "Read this receipt.",
      imageDataUrl: image,
    });
    const parsed = parseJsonObject(output);
    if (!parsed) return json({ error: "Could not read the receipt. Try a clearer photo." }, 422, guard.cors);
    return json(normalizeReceipt(parsed), 200, guard.cors);
  } catch (error) {
    return aiError(error, guard.cors);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/resolve-place") return resolvePlace(request, env);
    if (url.pathname === "/api/travel-time") return computeTravelTime(request, env);
    if (url.pathname === "/api/plan") return planDocument(request, env, ctx);
    if (url.pathname === "/api/ai/status") return aiStatus(request, env, ctx);
    if (url.pathname === "/api/ai/test") return aiTest(request, env, ctx);
    if (url.pathname === "/api/scan-receipt") return scanReceipt(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
