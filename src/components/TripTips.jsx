import { useEffect, useRef, useState } from "react";

function TipRow({ tip, onRemove }) {
  return (
    <div className="tip-row">
      <div className="tip-row-content">
        <p>{tip.text}</p>
        {tip.url && (
          <a href={tip.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            Source ↗
          </a>
        )}
      </div>
      <button type="button" className="tip-remove-button" onClick={() => onRemove(tip.id)} aria-label={`Delete tip: ${tip.text}`}>
        ✕
      </button>
    </div>
  );
}

function TipAddForm({ onAdd }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim(), url.trim() || null);
    setText("");
    setUrl("");
  }

  return (
    <form className="tip-add-form" onSubmit={handleSubmit}>
      <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Note something to remember…" />
      <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Source link · optional" />
      <button type="submit" className="primary-button compact">Add</button>
    </form>
  );
}

export default function TripTips({ tips, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

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
    <div className="tips-widget" ref={containerRef}>
      <button
        type="button"
        className="secondary-button compact"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        📌 Tips{tips.length > 0 ? ` (${tips.length})` : ""}
      </button>
      {open && (
        <div className="tips-popover" role="dialog" aria-label="Trip tips">
          <strong>Trip tips</strong>
          {tips.length === 0 ? (
            <p className="tips-empty">Nothing saved yet.</p>
          ) : (
            <div className="tips-list">
              {tips.map((tip) => <TipRow key={tip.id} tip={tip} onRemove={onRemove} />)}
            </div>
          )}
          <TipAddForm onAdd={onAdd} />
        </div>
      )}
    </div>
  );
}
