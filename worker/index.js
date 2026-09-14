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

function queryFromMapsUrl(value) {
  const url = new URL(value);
  const parameter = url.searchParams.get("query") ?? url.searchParams.get("q");
  if (parameter && !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(parameter)) return parameter;
  const match = decodeURIComponent(url.pathname).match(/\/maps\/place\/([^/]+)/);
  return match?.[1]?.replace(/\+/g, " ") ?? null;
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
        "X-Goog-FieldMask": "routes.duration",
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
    return json({ minutes: Math.round(durationSeconds / 60), mode: "driving" }, 200, cors);
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/resolve-place") return resolvePlace(request, env);
    if (url.pathname === "/api/travel-time") return computeTravelTime(request, env);
    if (url.pathname === "/api/plan") return planDocument(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
