import { useRef, useState } from "react";

const SNAP_ORDER = ["peek", "half", "full"];
const PEEK_VISIBLE_PX = 64;

function snapOffsetPx(snap, sheetHeight) {
  if (snap === "full") return 0;
  if (snap === "half") return sheetHeight * 0.45;
  return sheetHeight - PEEK_VISIBLE_PX;
}

export default function MapSheet({ snap, onSnapChange, ariaLabel, children }) {
  const sheetRef = useRef(null);
  const dragRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  function handlePointerDown(event) {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.setPointerCapture(event.pointerId);
    const sheetHeight = sheet.getBoundingClientRect().height;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset: snapOffsetPx(snap, sheetHeight),
      sheetHeight,
      lastOffset: snapOffsetPx(snap, sheetHeight),
    };
    setIsDragging(true);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (!drag || !sheet || event.pointerId !== drag.pointerId) return;
    const delta = event.clientY - drag.startY;
    const nextOffset = Math.min(Math.max(drag.startOffset + delta, 0), drag.sheetHeight - PEEK_VISIBLE_PX);
    drag.lastOffset = nextOffset;
    sheet.style.transform = `translateY(${nextOffset}px)`;
  }

  function handlePointerUp(event) {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (!drag || !sheet || event.pointerId !== drag.pointerId) return;
    const candidates = SNAP_ORDER.map((value) => ({ value, offset: snapOffsetPx(value, drag.sheetHeight) }));
    const nearest = candidates.reduce((best, candidate) =>
      Math.abs(candidate.offset - drag.lastOffset) < Math.abs(best.offset - drag.lastOffset) ? candidate : best);
    sheet.style.transform = "";
    dragRef.current = null;
    setIsDragging(false);
    onSnapChange(nearest.value);
  }

  function handleHandleKeyDown(event) {
    const index = SNAP_ORDER.indexOf(snap);
    if (event.key === "ArrowUp" && index < SNAP_ORDER.length - 1) onSnapChange(SNAP_ORDER[index + 1]);
    if (event.key === "ArrowDown" && index > 0) onSnapChange(SNAP_ORDER[index - 1]);
  }

  return (
    <section
      className={`map-pane ${isDragging ? "dragging" : ""}`}
      data-snap={snap}
      ref={sheetRef}
      aria-label={ariaLabel ?? "Map"}
    >
      <div
        className="sheet-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleHandleKeyDown}
        role="slider"
        tabIndex={0}
        aria-label="Resize map panel"
        aria-valuemin={0}
        aria-valuemax={SNAP_ORDER.length - 1}
        aria-valuenow={SNAP_ORDER.indexOf(snap)}
        aria-valuetext={snap}
      >
        <span className="sheet-handle-bar" />
      </div>
      <div className="sheet-content">
        {children}
      </div>
    </section>
  );
}
