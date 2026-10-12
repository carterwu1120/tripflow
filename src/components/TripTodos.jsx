import { useEffect, useRef, useState } from "react";

function TodoRow({ todo, onToggle, onRemove }) {
  return (
    <div className={`todo-row ${todo.done ? "done" : ""}`}>
      <label className="todo-row-content">
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
        />
        <span>{todo.text}</span>
      </label>
      <button
        type="button"
        className="tip-remove-button"
        onClick={() => onRemove(todo.id)}
        aria-label={`Delete to-do: ${todo.text}`}
      >
        ✕
      </button>
    </div>
  );
}

function TodoAddForm({ onAdd }) {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  }

  return (
    <form className="tip-add-form" onSubmit={handleSubmit}>
      <input value={text} onChange={(event) => setText(event.target.value)} placeholder="What needs doing?" />
      <button type="submit" className="primary-button compact">Add</button>
    </form>
  );
}

export default function TripTodos({ todos, onAdd, onToggle, onRemove }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const openCount = todos.filter((todo) => !todo.done).length;

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
    <div className="todos-widget" ref={containerRef}>
      <button
        type="button"
        className="secondary-button compact"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        ☑️ To-do{openCount > 0 ? ` (${openCount})` : ""}
      </button>
      {open && (
        <div className="todos-popover" role="dialog" aria-label="Trip to-do list">
          <strong>To-do · {todos.length - openCount}/{todos.length} done</strong>
          {todos.length === 0 ? (
            <p className="tips-empty">Nothing to do yet.</p>
          ) : (
            <div className="todos-list">
              {todos.map((todo) => (
                <TodoRow key={todo.id} todo={todo} onToggle={onToggle} onRemove={onRemove} />
              ))}
            </div>
          )}
          <TodoAddForm onAdd={onAdd} />
        </div>
      )}
    </div>
  );
}
