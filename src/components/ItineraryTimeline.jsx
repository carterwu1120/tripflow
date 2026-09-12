import { useState } from "react";
import TripStopCard from "./TripStopCard";

export default function ItineraryTimeline({
  day,
  selectedStopId,
  onSelectStop,
  onReorder,
  onRemoveStop,
  onEditStop,
}) {
  const [draggedStopId, setDraggedStopId] = useState(null);
  const [announcement, setAnnouncement] = useState("");

  const routeStops = day.stops.filter((stop) => stop.type !== "hotel");

  function handleDrop(targetStopId) {
    if (draggedStopId && draggedStopId !== targetStopId) {
      onReorder(draggedStopId, targetStopId);
      const targetIndex = routeStops.findIndex((stop) => stop.id === targetStopId);
      const moved = routeStops.find((stop) => stop.id === draggedStopId);
      setAnnouncement(`${moved?.name ?? "Place"} moved to position ${targetIndex + 1}`);
    }
    setDraggedStopId(null);
  }

  return (
    <div className="timeline">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {routeStops.map((stop, index) => {
        const nextStop = routeStops[index + 1];
        const travelLeg = nextStop
          ? day.travelLegs.find(
              (leg) => leg.fromStopId === stop.id && leg.toStopId === nextStop.id,
            )
          : null;

        return (
          <div className="timeline-entry" key={stop.id}>
            <TripStopCard
              stop={stop}
              order={index + 1}
              isSelected={selectedStopId === stop.id}
              onSelect={() => onSelectStop(stop.id)}
              isEditable
              isDragging={draggedStopId === stop.id}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", stop.id);
                setDraggedStopId(stop.id);
              }}
              onDragEnd={() => setDraggedStopId(null)}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={() => handleDrop(stop.id)}
              onMoveUp={() => index > 0 && onReorder(stop.id, routeStops[index - 1].id)}
              onMoveDown={() =>
                index < routeStops.length - 1 && onReorder(stop.id, routeStops[index + 1].id)
              }
              canMoveUp={index > 0}
              canMoveDown={index < routeStops.length - 1}
              onRemove={() => onRemoveStop(stop.id)}
              onEdit={() => onEditStop(stop)}
            />
            {nextStop && <TravelLeg leg={travelLeg} />}
          </div>
        );
      })}
    </div>
  );
}

function TravelLeg({ leg }) {
  const modeIcon = {
    driving: "🚗",
    taxi: "🚕",
    walking: "🚶",
    shuttle: "🚌",
  };

  return (
    <div className={`travel-leg ${leg ? "" : "unset"}`}>
      <span className="travel-line" />
      <span className="travel-label">
        <span aria-hidden="true">{leg ? modeIcon[leg.mode] ?? "🚗" : "?"}</span>
        {leg ? `${leg.mode} · ~${leg.minutes} min` : "Travel time not set"}
      </span>
    </div>
  );
}
