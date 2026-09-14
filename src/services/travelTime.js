const travelTimeUrl = import.meta.env.VITE_TRAVEL_TIME_URL ?? "/api/travel-time";

export async function computeTravelTime(from, to) {
  const response = await fetch(travelTimeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const result = isJson ? await response.json().catch(() => ({})) : {};
  if (!response.ok) throw new Error(result.error ?? "Unable to compute travel time.");
  if (!Number.isFinite(result.minutes)) throw new Error("Travel time service returned an invalid result.");
  return result;
}
