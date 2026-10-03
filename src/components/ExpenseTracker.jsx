import { useEffect, useRef, useState } from "react";
import { summarizeExpenses } from "../domain/plan";

const CATEGORIES = [
  { value: "flight", label: "✈️ 機票" },
  { value: "hotel", label: "🏨 住宿" },
  { value: "rental-car", label: "🚗 租車" },
  { value: "food", label: "🍽️ 餐飲" },
  { value: "shopping", label: "🛍️ 購物" },
  { value: "other", label: "📦 其他" },
];

function categoryLabel(value) {
  return CATEGORIES.find((category) => category.value === value)?.label ?? "📦 其他";
}

function formatAmount(amount, currency) {
  return `${currency === "JPY" ? "¥" : "NT$"}${amount.toLocaleString()}`;
}

function ExpenseRow({ expense, onRemove }) {
  return (
    <div className="expense-row">
      <div className="expense-row-content">
        <p>
          <span className="expense-category">{categoryLabel(expense.category)}</span>
          {expense.label}
        </p>
        <span className="expense-amount">{formatAmount(expense.amount, expense.currency)}</span>
      </div>
      <button type="button" className="expense-remove-button" onClick={() => onRemove(expense.id)} aria-label={`Delete expense: ${expense.label}`}>
        ✕
      </button>
    </div>
  );
}

function ExpenseAddForm({ onAdd }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("JPY");
  const [category, setCategory] = useState("other");

  function handleSubmit(event) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!label.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    onAdd({ label: label.trim(), amount: parsedAmount, currency, category });
    setLabel("");
    setAmount("");
  }

  return (
    <form className="expense-add-form" onSubmit={handleSubmit}>
      <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="花費項目,例如：租車" />
      <div className="expense-add-row">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="金額"
        />
        <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
          <option value="JPY">JPY</option>
          <option value="TWD">TWD</option>
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <button type="submit" className="primary-button compact">Add</button>
    </form>
  );
}

export default function ExpenseTracker({ expenses, jpyToTwdRate, onAdd, onRemove, onSetRate }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const { totalJpy, totalTwd, grandTotalTwd } = summarizeExpenses(expenses, jpyToTwdRate);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="expense-widget" ref={containerRef}>
      <button
        type="button"
        className="secondary-button compact"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        💰 NT${Math.round(grandTotalTwd).toLocaleString()}
      </button>
      {open && (
        <div className="expense-popover" role="dialog" aria-label="Trip expenses">
          <div className="expense-total">
            <strong>預估總花費 NT${Math.round(grandTotalTwd).toLocaleString()}</strong>
            <span>¥{totalJpy.toLocaleString()} + NT${totalTwd.toLocaleString()}</span>
          </div>

          <label className="expense-rate">
            匯率 1¥ =
            <input
              type="number"
              step="0.001"
              min="0"
              value={jpyToTwdRate}
              onChange={(event) => onSetRate(Number(event.target.value) || 0)}
            />
            NT$
          </label>

          {expenses.length === 0 ? (
            <p className="tips-empty">還沒有記錄。</p>
          ) : (
            <div className="expense-list">
              {expenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} onRemove={onRemove} />)}
            </div>
          )}

          <ExpenseAddForm onAdd={onAdd} />
        </div>
      )}
    </div>
  );
}
