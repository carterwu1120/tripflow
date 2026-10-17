// Remote MCP server for Claude custom connectors, with an MCP Apps card.
//
// Experiment scope: one read-only tool, `show_expenses`, whose result renders
// as an interactive card inside the Claude conversation. There is deliberately
// no write tool yet: the web app saves the whole trip document at once, so a
// concurrent write from Claude would be overwritten by the next browser save.

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { DEFAULT_JPY_TO_TWD_RATE, summarizeExpenses } from "../src/domain/plan.js";
import expensesHtml from "./generated/expenses.html";

const EXPENSES_UI_URI = "ui://tripflow/expenses.html";

function plainResponse(status, message, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

// Constant-time comparison so response timing doesn't leak how much of the
// secret a guess got right.
function secretsMatch(candidate, secret) {
  const encoder = new TextEncoder();
  const a = encoder.encode(candidate);
  const b = encoder.encode(secret);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

async function loadExpenses(env, tripId) {
  const row = await env.DB.prepare("SELECT data FROM trip_documents WHERE id = ?").bind(tripId).first();
  if (!row) return { tripName: null, expenses: [], jpyToTwdRate: DEFAULT_JPY_TO_TWD_RATE };
  const plan = JSON.parse(row.data);
  return {
    tripName: plan.trip?.name ?? null,
    expenses: Array.isArray(plan.expenses) ? plan.expenses : [],
    jpyToTwdRate: plan.jpyToTwdRate ?? DEFAULT_JPY_TO_TWD_RATE,
  };
}

function formatAmount(amount, currency) {
  return `${currency === "JPY" ? "¥" : "NT$"}${Math.round(amount).toLocaleString("en-US")}`;
}

async function showExpenses(env, tripId) {
  const { tripName, expenses, jpyToTwdRate } = await loadExpenses(env, tripId);
  const totals = summarizeExpenses(expenses, jpyToTwdRate);
  const items = expenses.map(({ label, amount, currency, category }) => ({ label, amount, currency, category }));

  // The text summary reaches the model even if a client can't render the card,
  // which also tells us whether a missing card means "no UI" or "no data".
  const lines = items.map((item) => `- ${item.label}: ${formatAmount(item.amount, item.currency)}`);
  const summary = [
    `${tripName ?? "Trip"}: ${items.length} expense(s), about NT$${Math.round(totals.grandTotalTwd).toLocaleString("en-US")} in total.`,
    ...lines,
  ].join("\n");

  return {
    content: [{ type: "text", text: summary }],
    structuredContent: { tripName, items, totals, jpyToTwdRate },
  };
}

function createServer(env, tripId) {
  const server = new McpServer({ name: "TripFlow", version: "0.1.0" });

  registerAppTool(
    server,
    "show_expenses",
    {
      title: "Show trip expenses",
      description: "Show the user's TripFlow trip expenses and totals as an interactive card. Use when the user asks how much they have spent or wants to see their expenses.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: EXPENSES_UI_URI } },
    },
    async () => showExpenses(env, tripId),
  );

  registerAppResource(
    server,
    "TripFlow expenses card",
    EXPENSES_UI_URI,
    { description: "Interactive card listing TripFlow expenses." },
    async () => ({
      contents: [{ uri: EXPENSES_UI_URI, mimeType: RESOURCE_MIME_TYPE, text: expensesHtml }],
    }),
  );

  return server;
}

// TripFlow sits behind Cloudflare Access, which Claude's servers can't pass, so
// /mcp gets an Access bypass and is protected here by a shared bearer secret
// that the Claude connector sends as a request header. Without the secret
// configured, the endpoint refuses everything.
export async function handleMcp(request, env, { tripId }) {
  if (!env.MCP_SHARED_SECRET) return plainResponse(503, "The MCP connector is not configured.");
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token || !secretsMatch(token, env.MCP_SHARED_SECRET)) {
    return plainResponse(401, "Unauthorized.", { "www-authenticate": "Bearer" });
  }
  if (!env.DB) return plainResponse(503, "D1 is not configured.");

  const handler = createMcpHandler(() => createServer(env, tripId));
  return handler.fetch(request);
}
