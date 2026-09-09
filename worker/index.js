const GOOGLE_HOSTS = new Set(["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]);

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
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
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
      return json({ ...directCoordinates, name: suppliedName || null, resolvedUrl, accuracy: "confirmed", source: "maps-redirect" }, 200, cors);
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
      resolvedUrl,
      accuracy: "confirmed",
      source: "places-api",
    }, 200, cors);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to resolve this place." }, 400, cors ?? {});
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/resolve-place") return resolvePlace(request, env);
    return env.ASSETS.fetch(request);
  },
};
