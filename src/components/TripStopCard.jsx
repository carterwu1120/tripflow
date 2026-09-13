import { useEffect, useRef } from "react";

const TYPE_LABELS = {
  attraction: "Attraction",
  restaurant: "Food",
  hotel: "Hotel",
  airport: "Airport",
  "rental-car": "Rental car",
  shopping: "Shopping",
  "rest-stop": "Rest stop",
  other: "Activity",
};

function formatTime(time) {
  if (!time?.value || time.kind === "none") return "Sequence only";
  return time.kind === "approximate" ? `~${time.value}` : time.value;
}

export default function TripStopCard({
  stop,
  order,
  isSelected,
  onSelect,
  isEditable,
  isDragging,
  dragHandleProps,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onRemove,
  onEdit,
}) {
  const cardRef = useRef(null);

  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isSelected]);

  const timeKind = stop.time?.kind ?? "none";

  return (
    <article
      ref={cardRef}
      className={`stop-card ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      aria-current={isSelected ? "step" : undefined}
    >
      <div className="order-column">
        <span className="order-number">{order}</span>
        {isEditable && (
          <button
            type="button"
            className="drag-handle"
            {...dragHandleProps}
            title="Drag to reorder"
            aria-label={`Drag ${stop.name} to reorder. Use move buttons for keyboard reordering.`}
          >
            ⠿
          </button>
        )}
      </div>

      <div className="stop-content">
        <div className="stop-topline">
          <span className={`type-badge type-${stop.type}`}>{TYPE_LABELS[stop.type] ?? "Activity"}</span>
          <span className="status-badge confirmed">Confirmed</span>
          <span className={`time-label time-${timeKind}`}>{formatTime(stop.time)}</span>
        </div>
        <h2>{stop.name}</h2>
        <p className="stop-meta">
          {Number.isFinite(stop.durationMinutes) ? `${stop.durationMinutes} min` : "Duration not set"}
          {stop.openingHours && <><span>·</span>{stop.openingHours}</>}
        </p>
        {stop.notes && <p className="stop-notes">{stop.notes}</p>}
        <div className="stop-details">
          {stop.reservationRequired && <span className="detail-chip warm">Reservation</span>}
          {stop.lastEntryTime && <span className="detail-chip">Last entry {stop.lastEntryTime}</span>}
          {stop.locationAccuracy === "approximate" && <span className="detail-chip warm">Approximate location</span>}
          {stop.locationAccuracy === "missing" && <span className="detail-chip warm">Location missing</span>}
          <a
            href={stop.googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            Open in Google Maps ↗
          </a>
          <button className="show-on-map-button" type="button" onClick={onSelect}>Show on map</button>
        </div>

        {isEditable && (
          <div className="stop-editor" onClick={(event) => event.stopPropagation()}>
            <div className="editor-actions">
              <button type="button" onClick={onEdit}>Edit</button>
              <button type="button" onClick={onMoveUp} disabled={!canMoveUp} aria-label="Move stop up">↑</button>
              <button type="button" onClick={onMoveDown} disabled={!canMoveDown} aria-label="Move stop down">↓</button>
              <button
                className="remove-button"
                type="button"
                onClick={onRemove}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
