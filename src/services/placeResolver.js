const resolverUrl = import.meta.env.VITE_PLACE_RESOLVER_URL ?? "/api/resolve-place";

export async function resolvePlace({ name, url }) {
  const response = await fetch(resolverUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, url }),
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const result = isJson ? await response.json().catch(() => ({})) : {};
  if (!response.ok) throw new Error(result.error ?? "Unable to resolve this place.");
  if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
    throw new Error("Location resolver is not available. Run npm run worker:dev or configure VITE_PLACE_RESOLVER_URL.");
  }
  return result;
}
