// PROTOTYPE — throwaway UI exploration for the "trip tips/reminders" feature.
// Not wired to the real reducer/localStorage/D1 — in-memory only, resets on reload.
// Switch variants via the floating bar at the bottom of the screen, or the
// `?tipsVariant=A|B|C` URL param. Hidden in production builds (import.meta.env.PROD).
//
// Three variants of where the trip-wide "tips" list lives, switchable via
// ?tipsVariant=, layered into the real App/DayPlanner layout:
//   A — a header pill that opens a popover (overlay, zero footprint until opened)
//   B — an ambient collapsible banner between the header and day tabs (page-flow chrome)
//   C — a first-class content card inside the itinerary pane, alongside Stays/Timeline
import { useEffect, useState } from "react";

const VARIANTS = ["A", "B", "C"];
const VARIANT_NAMES = {
  A: "Header popover",
  B: "Banner above day tabs",
  C: "Card in itinerary pane",
};

const SEED_TIPS = [
  {
    id: "seed-1",
    text: "日本自駕導航記得關掉「避開收費道路」跟「省油模式」,不然會被導去繞路",
    url: "https://www.threads.com/@tanglixue5/post/DddpqaQD0Lp",
  },
];

export function useTripTipsPrototype() {
  const [tips, setTips] = useState(SEED_TIPS);

  function addTip(text, url) {
    if (!text.trim()) return;
    setTips((prev) => [...prev, { id: `tip-${Date.now()}`, text: text.trim(), url: url?.trim() || null }]);
  }

  function removeTip(id) {
    setTips((prev) => prev.filter((tip) => tip.id !== id));
  }

  return { tips, addTip, removeTip };
}

export function useTipsVariant() {
  const [variant, setVariant] = useState(() => {
    const param = new URLSearchParams(window.location.search).get("tipsVariant");
    return VARIANTS.includes(param) ? param : "A";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tipsVariant", variant);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [variant]);

  return [variant, setVariant];
}

function TipAddForm({ onAdd }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onAdd(text, url);
    setText("");
    setUrl("");
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 6, marginTop: 8 }}>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Note something to remember…"
        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cdd5cf", fontSize: 13 }}
      />
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Source link (optional)"
        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cdd5cf", fontSize: 12 }}
      />
      <button type="submit" className="primary-button compact" style={{ justifySelf: "start" }}>Add</button>
    </form>
  );
}

function TipRow({ tip, onRemove }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid #eee" }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13 }}>{tip.text}</p>
        {tip.url && <a href={tip.url} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>Source ↗</a>}
      </div>
      <button type="button" onClick={() => onRemove(tip.id)} style={{ flex: "none", background: "none", border: 0, color: "#a33", cursor: "pointer" }}>✕</button>
    </div>
  );
}

export function TripTipsVariantA({ tips, addTip, removeTip }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="secondary-button compact" onClick={() => setOpen((value) => !value)}>
        📌 Tips{tips.length > 0 ? ` (${tips.length})` : ""}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, width: 300,
          background: "white", border: "1px solid #cdd5cf", borderRadius: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,0.15)", padding: 14, zIndex: 2000,
        }}>
          <strong style={{ fontSize: 13 }}>Trip tips</strong>
          <div>
            {tips.length === 0 && <p style={{ fontSize: 12, color: "#687570" }}>No tips yet.</p>}
            {tips.map((tip) => <TipRow key={tip.id} tip={tip} onRemove={removeTip} />)}
          </div>
          <TipAddForm onAdd={addTip} />
        </div>
      )}
    </div>
  );
}

export function TripTipsVariantB({ tips, addTip, removeTip }) {
  const [expanded, setExpanded] = useState(false);
  const latest = tips[tips.length - 1];

  return (
    <div style={{ background: "#fff8e7", borderBottom: "1px solid #e8d9b5" }}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 20px", background: "none", border: 0, cursor: "pointer", fontSize: 12, color: "#70451f",
        }}
      >
        <span>🔔 {tips.length} trip tip{tips.length === 1 ? "" : "s"}{!expanded && latest ? ` · ${latest.text}` : ""}</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div style={{ padding: "0 20px 14px" }}>
          {tips.map((tip) => <TipRow key={tip.id} tip={tip} onRemove={removeTip} />)}
          <TipAddForm onAdd={addTip} />
        </div>
      )}
    </div>
  );
}

export function TripTipsVariantC({ tips, addTip, removeTip }) {
  return (
    <section className="candidate-section" style={{ marginBottom: 20 }}>
      <div className="candidate-heading-row">
        <div>
          <p className="eyebrow">Whole trip</p>
          <h2>Tips to remember</h2>
        </div>
      </div>
      <div className="candidate-list">
        {tips.map((tip) => (
          <article key={tip.id} className="candidate-card">
            <div className="candidate-content">
              <p style={{ margin: 0, fontSize: 13 }}>{tip.text}</p>
              {tip.url && <a href={tip.url} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>Source ↗</a>}
            </div>
            <div className="candidate-actions">
              <button type="button" className="candidate-delete-button" onClick={() => removeTip(tip.id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      <TipAddForm onAdd={addTip} />
    </section>
  );
}

export function TripTipsPrototypeSwitcher({ variant, setVariant }) {
  useEffect(() => {
    function cycle(delta) {
      const index = VARIANTS.indexOf(variant);
      setVariant(VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length]);
    }
    function handleKeyDown(event) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      if (event.key === "ArrowLeft") cycle(-1);
      if (event.key === "ArrowRight") cycle(1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [variant, setVariant]);

  if (import.meta.env.PROD) return null;

  function cycle(delta) {
    const index = VARIANTS.indexOf(variant);
    setVariant(VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length]);
  }

  return (
    <div style={{
      position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
      zIndex: 3000, display: "flex", alignItems: "center", gap: 10,
      background: "#1a1a1a", color: "white", borderRadius: 999, padding: "8px 16px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)", fontSize: 13, fontFamily: "monospace",
    }}>
      <button type="button" onClick={() => cycle(-1)} style={{ background: "none", border: 0, color: "white", cursor: "pointer", fontSize: 16 }}>←</button>
      <span>PROTOTYPE — {variant} — {VARIANT_NAMES[variant]}</span>
      <button type="button" onClick={() => cycle(1)} style={{ background: "none", border: 0, color: "white", cursor: "pointer", fontSize: 16 }}>→</button>
    </div>
  );
}
