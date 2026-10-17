// MCP Apps card rendered inside Claude. It receives the `show_expenses` tool
// result from the host and can call the tool again to refresh.

import { App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import "./expenses.css";

// Mirrors CATEGORIES in src/components/ExpenseTracker.jsx.
const CATEGORY_LABELS = {
  flight: "✈️ 機票",
  hotel: "🏨 住宿",
  "rental-car": "🚗 租車",
  food: "🍽️ 餐飲",
  shopping: "🛍️ 購物",
  other: "📦 其他",
};

const tripNameEl = document.getElementById("trip-name");
const grandTotalEl = document.getElementById("grand-total");
const breakdownEl = document.getElementById("breakdown");
const itemsEl = document.getElementById("items");
const emptyEl = document.getElementById("empty");
const statusEl = document.getElementById("status");
const refreshButton = document.getElementById("refresh");

function formatAmount(amount, currency) {
  return `${currency === "JPY" ? "¥" : "NT$"}${Math.round(amount).toLocaleString("en-US")}`;
}

// Labels can come from AI-read receipts, so everything goes in via textContent.
function render(data) {
  if (!data) return;
  const { tripName, items = [], totals } = data;
  tripNameEl.textContent = tripName ? `${tripName} · 記帳` : "記帳";
  grandTotalEl.textContent = totals ? `NT$${Math.round(totals.grandTotalTwd).toLocaleString("en-US")}` : "—";
  breakdownEl.textContent = totals
    ? `¥${totals.totalJpy.toLocaleString("en-US")} + NT$${totals.totalTwd.toLocaleString("en-US")}`
    : "";

  itemsEl.replaceChildren(
    ...items.map((item) => {
      const row = document.createElement("li");
      const category = document.createElement("span");
      category.className = "category";
      category.textContent = CATEGORY_LABELS[item.category] ?? CATEGORY_LABELS.other;
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = item.label;
      const amount = document.createElement("span");
      amount.className = "amount";
      amount.textContent = formatAmount(item.amount, item.currency);
      row.append(category, label, amount);
      return row;
    }),
  );
  emptyEl.hidden = items.length > 0;
}

function applyHostContext(context) {
  if (!context) return;
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
}

const app = new App({ name: "TripFlow Expenses", version: "0.1.0" });

app.ontoolresult = (result) => {
  render(result.structuredContent);
  statusEl.textContent = "";
};
app.onhostcontextchanged = applyHostContext;

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  statusEl.textContent = "更新中…";
  try {
    const result = await app.callServerTool({ name: "show_expenses", arguments: {} });
    render(result.structuredContent);
    statusEl.textContent = `已更新 ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    statusEl.textContent = `更新失敗:${error?.message ?? error}`;
  } finally {
    refreshButton.disabled = false;
  }
});

await app.connect();
applyHostContext(app.getHostContext());
