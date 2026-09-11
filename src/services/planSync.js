const planUrl = import.meta.env.VITE_PLAN_SYNC_URL ?? "/api/plan";

async function readJson(response) {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  return isJson ? response.json().catch(() => ({})) : {};
}

export async function loadRemotePlan() {
  const response = await fetch(planUrl, { credentials: "same-origin" });
  const result = await readJson(response);
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = new Error(result.error ?? "Unable to load the cloud itinerary.");
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function saveRemotePlan(plan) {
  const response = await fetch(planUrl, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const result = await readJson(response);
  if (!response.ok) {
    const error = new Error(result.error ?? "Unable to save the cloud itinerary.");
    error.status = response.status;
    throw error;
  }
  return result;
}
