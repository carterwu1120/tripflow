import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { routeStopsOf } from "../domain/plan";
import TripStopCard from "./TripStopCard";

function SortableStopRow({ stop, children }) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: stop.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className="timeline-entry" ref={setNodeRef} style={style}>
      {children({ isDragging, dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

export default function ItineraryTimeline({
  day,
  selectedStopId,
  onSelectStop,
  onReorder,
  onRemoveStop,
  onEditStop,
  pendingLegPairs,
}) {
  const [announcement, setAnnouncement] = useState("");
  const routeStops = routeStopsOf(day);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(active.id, over.id);
    const targetIndex = routeStops.findIndex((stop) => stop.id === over.id);
    const moved = routeStops.find((stop) => stop.id === active.id);
    setAnnouncement(`${moved?.name ?? "Place"} moved to position ${targetIndex + 1}`);
  }

  return (
    <div className="timeline">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={routeStops.map((stop) => stop.id)} strategy={verticalListSortingStrategy}>
          {routeStops.map((stop, index) => {
            const nextStop = routeStops[index + 1];
            const travelLeg = nextStop
              ? day.travelLegs.find(
                  (leg) => leg.fromStopId === stop.id && leg.toStopId === nextStop.id,
                )
              : null;

            return (
              <SortableStopRow key={stop.id} stop={stop}>
                {({ isDragging, dragHandleProps }) => (
                  <>
                    <TripStopCard
                      stop={stop}
                      order={index + 1}
                      isSelected={selectedStopId === stop.id}
                      onSelect={() => onSelectStop(stop.id)}
                      isEditable
                      isDragging={isDragging}
                      dragHandleProps={dragHandleProps}
                      onMoveUp={() => index > 0 && onReorder(stop.id, routeStops[index - 1].id)}
                      onMoveDown={() =>
                        index < routeStops.length - 1 && onReorder(stop.id, routeStops[index + 1].id)
                      }
                      canMoveUp={index > 0}
                      canMoveDown={index < routeStops.length - 1}
                      onRemove={() => onRemoveStop(stop.id)}
                      onEdit={() => onEditStop(stop)}
                    />
                    {nextStop && (
                      <TravelLeg
                        leg={travelLeg}
                        isPending={pendingLegPairs?.has(`${stop.id}:${nextStop.id}`)}
                      />
                    )}
                  </>
                )}
              </SortableStopRow>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function TravelLeg({ leg, isPending }) {
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
        <span aria-hidden="true">{leg ? modeIcon[leg.mode] ?? "🚗" : isPending ? "⏳" : "?"}</span>
        {leg ? `${leg.mode} · ~${leg.minutes} min` : isPending ? "Calculating travel time…" : "Travel time not set"}
      </span>
    </div>
  );
}
