import { useState } from "react";
import TripStopCard from "./TripStopCard";

export default function ItineraryTimeline({
  day,
  selectedStopId,
  onSelectStop,
  isDraft,
  onReorder,
  onRemoveStop,
  onChangeTime,
}) {
  const [draggedStopId, setDraggedStopId] = useState(null);

  function handleDrop(targetStopId) {
    if (draggedStopId && draggedStopId !== targetStopId) {
      onReorder(draggedStopId, targetStopId);
    }
    setDraggedStopId(null);
  }

  return (
    <div className="timeline">
      {day.stops.map((stop, index) => {
        const nextStop = day.stops[index + 1];
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
              isDraft={isDraft}
              isDragging={draggedStopId === stop.id}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", stop.id);
                setDraggedStopId(stop.id);
              }}
              onDragEnd={() => setDraggedStopId(null)}
              onDragOver={(event) => {
                if (isDraft) event.preventDefault();
              }}
              onDrop={() => handleDrop(stop.id)}
              onMoveUp={() => index > 0 && onReorder(stop.id, day.stops[index - 1].id)}
              onMoveDown={() =>
                index < day.stops.length - 1 && onReorder(stop.id, day.stops[index + 1].id)
              }
              canMoveUp={index > 0}
              canMoveDown={index < day.stops.length - 1}
              onRemove={() => onRemoveStop(stop.id)}
              onChangeTime={(time) => onChangeTime(stop.id, time)}
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
