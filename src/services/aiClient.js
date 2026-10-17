async function readResult(response, fallbackMessage) {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const result = isJson ? await response.json().catch(() => ({})) : {};
  if (!response.ok) {
    const error = new Error(result.error ?? fallbackMessage);
    error.code = result.code;
    throw error;
  }
  return result;
}

function post(url, body) {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getAiStatus() {
  const response = await fetch("/api/ai/status", { credentials: "same-origin" });
  return readResult(response, "Unable to check the ChatGPT connection.");
}

export async function testAi({ text, image }) {
  const result = await readResult(await post("/api/ai/test", { text, image }), "ChatGPT request failed.");
  return result.output ?? "";
}

export async function scanReceipt(image) {
  return readResult(await post("/api/scan-receipt", { image }), "Unable to read the receipt.");
}
