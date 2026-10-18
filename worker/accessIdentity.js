// Identifies the user who signed in through Cloudflare Access.
//
// `ctx.access.getIdentity()` is the documented API, but Workers that serve
// static assets run behind a router that does not pass `ctx.access` through,
// so TripFlow never received it and cloud sync always answered 401.
//
// Access also attaches a signed JWT to every request it lets through: the
// `Cf-Access-Jwt-Assertion` header, and the `CF_Authorization` cookie in the
// browser. Verifying that JWT against the team's public keys works no matter
// how the request is routed inside Cloudflare.

const CERTS_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;

let certsCache = { teamDomain: null, keys: null, fetchedAt: 0 };

function base64UrlToBytes(segment) {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function decodeJsonSegment(segment) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
}

async function signingKeys(teamDomain, { refresh = false } = {}) {
  const isFresh = certsCache.teamDomain === teamDomain
    && certsCache.keys
    && Date.now() - certsCache.fetchedAt < CERTS_TTL_MS;
  if (isFresh && !refresh) return certsCache.keys;

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs returned ${response.status}.`);
  const { keys = [] } = await response.json();
  certsCache = { teamDomain, keys, fetchedAt: Date.now() };
  return keys;
}

function readToken(request) {
  const header = request.headers.get("cf-access-jwt-assertion");
  if (header) return header;
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? match[1] : null;
}

// Resolves to { email } for a valid Access token, or { error } with a short
// reason code that is safe to show while debugging.
export async function verifyAccessJwt(request, env) {
  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  if (!teamDomain || !audience) return { error: "access_not_configured" };

  const token = readToken(request);
  if (!token) return { error: "no_access_token" };

  const parts = token.split(".");
  if (parts.length !== 3) return { error: "malformed_token" };

  let header;
  let payload;
  try {
    header = decodeJsonSegment(parts[0]);
    payload = decodeJsonSegment(parts[1]);
  } catch {
    return { error: "malformed_token" };
  }
  if (header.alg !== "RS256") return { error: "unexpected_algorithm" };

  let signatureValid;
  try {
    // A key Cloudflare rotated in since the last fetch earns one refresh.
    let keys = await signingKeys(teamDomain);
    let jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) {
      keys = await signingKeys(teamDomain, { refresh: true });
      jwk = keys.find((key) => key.kid === header.kid);
    }
    if (!jwk) return { error: "unknown_signing_key" };

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    signatureValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch (error) {
    return { error: `key_error: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!signatureValid) return { error: "bad_signature" };

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== `https://${teamDomain}`) return { error: "wrong_issuer" };
  if (!audiences.includes(audience)) return { error: "wrong_audience" };
  if (typeof payload.exp !== "number" || payload.exp < now - CLOCK_SKEW_SECONDS) return { error: "expired_token" };
  if (typeof payload.nbf === "number" && payload.nbf > now + CLOCK_SKEW_SECONDS) return { error: "token_not_yet_valid" };
  if (typeof payload.email !== "string" || !payload.email) return { error: "no_email_in_token" };

  return { email: payload.email.toLowerCase() };
}
