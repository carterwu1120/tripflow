import { useCallback, useEffect, useState } from "react";
import AddPlaceDialog from "./components/AddPlaceDialog";
import DayPlanner from "./components/DayPlanner";
import { initialCandidates, initialTrip } from "./data/okinawaDay3";

const STORAGE_KEY = "tripflow-okinawa-2027-v2";

function normalizePlan(value) {
  return {
    ...value,
    trip: {
      ...value.trip,
      days: value.trip.days.map((day) => ({
        ...day,
        stops: day.stops.map((stop) => ({ ...stop, status: "confirmed" })),
      })),
    },
    candidates: (value.candidates ?? []).map((place) => ({
      ...place,
      status: "tentative",
    })),
  };
}

function loadPlan() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return normalizePlan(saved
      ? JSON.parse(saved)
      : { trip: initialTrip, candidates: initialCandidates });
  } catch {
    return normalizePlan({ trip: initialTrip, candidates: initialCandidates });
  }
}

function reorderStops(stops, draggedStopId, targetStopId) {
  const fromIndex = stops.findIndex((stop) => stop.id === draggedStopId);
  const targetIndex = stops.findIndex((stop) => stop.id === targetStopId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return stops;

  const reordered = [...stops];
  const [movedStop] = reordered.splice(fromIndex, 1);
  reordered.splice(targetIndex, 0, movedStop);
  return reordered;
}

export default function App() {
  const [plan, setPlan] = useState(loadPlan);
  const [selectedDayId, setSelectedDayId] = useState(() => initialTrip.days[0].id);
  const [selectedStopId, setSelectedStopId] = useState(null);
  const [mobileView, setMobileView] = useState("itinerary");
  const [placeEditor, setPlaceEditor] = useState(null);

  const days = plan.trip.days;
  const day = days.find((candidateDay) => candidateDay.id === selectedDayId) ?? days[0];
  const tentativePlaces = plan.candidates.filter(
    (candidate) => !candidate.suggestedDayId || candidate.suggestedDayId === day.id,
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  useEffect(() => {
    if (selectedStopId && !day.stops.some((stop) => stop.id === selectedStopId)) {
      setSelectedStopId(null);
    }
  }, [day.stops, selectedStopId]);

  const updateDay = useCallback((updater) => {
    setPlan((currentPlan) => ({
      ...currentPlan,
      trip: {
        ...currentPlan.trip,
        days: currentPlan.trip.days.map((candidateDay) =>
          candidateDay.id === selectedDayId ? updater(candidateDay) : candidateDay
        ),
      },
    }));
  }, [selectedDayId]);

  function handleReorder(draggedStopId, targetStopId) {
    updateDay((currentDay) => ({
      ...currentDay,
      stops: reorderStops(currentDay.stops, draggedStopId, targetStopId),
    }));
  }

  function handleRemoveStop(stopId) {
    updateDay((currentDay) => ({
      ...currentDay,
      stops: currentDay.stops.filter((stop) => stop.id !== stopId),
    }));
  }

  function handleRemoveTentative(placeId) {
    setPlan((currentPlan) => ({
      ...currentPlan,
      candidates: currentPlan.candidates.filter((candidate) => candidate.id !== placeId),
    }));
  }

  function handleSavePlace(place) {
    setPlan((currentPlan) => {
      const candidatesWithoutPlace = currentPlan.candidates.filter(({ id }) => id !== place.id);
      const daysWithoutPlace = currentPlan.trip.days.map((candidateDay) => ({
        ...candidateDay,
        stops: candidateDay.stops.filter(({ id }) => id !== place.id),
      }));

      if (place.status === "tentative") {
        return {
          ...currentPlan,
          trip: { ...currentPlan.trip, days: daysWithoutPlace },
          candidates: [
            ...candidatesWithoutPlace,
            { ...place, suggestedDayId: selectedDayId, status: "tentative" },
          ],
        };
      }

      const { suggestedDayId: _suggestedDayId, ...confirmedPlace } = place;
      const originalIndex = day.stops.findIndex(({ id }) => id === place.id);
      return {
        ...currentPlan,
        trip: {
          ...currentPlan.trip,
          days: daysWithoutPlace.map((candidateDay) => {
            if (candidateDay.id !== selectedDayId) return candidateDay;
            const nextStops = [...candidateDay.stops];
            nextStops.splice(originalIndex >= 0 ? originalIndex : nextStops.length, 0, {
              ...confirmedPlace,
              status: "confirmed",
            });
            return { ...candidateDay, stops: nextStops };
          }),
        },
        candidates: candidatesWithoutPlace,
      };
    });
    setPlaceEditor(null);
    setSelectedStopId(place.status === "confirmed" ? place.id : null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <p className="product-name">TripFlow</p>
            <p className="trip-name">{plan.trip.name} · {plan.trip.location}</p>
          </div>
        </div>
        <button className="primary-button" type="button" onClick={() => setPlaceEditor({ kind: "new", place: null })}>
          + Add place
        </button>
      </header>

      <DayPlanner
        days={days}
        day={day}
        candidates={tentativePlaces}
        onSelectDay={(dayId) => {
          setSelectedDayId(dayId);
          setSelectedStopId(null);
        }}
        selectedStopId={selectedStopId}
        onSelectStop={setSelectedStopId}
        onReorder={handleReorder}
        onRemoveStop={handleRemoveStop}
        onEditStop={(stop) => setPlaceEditor({ kind: "confirmed", place: stop })}
        onEditCandidate={(candidate) => setPlaceEditor({ kind: "tentative", place: candidate })}
        onRemoveCandidate={handleRemoveTentative}
        mobileView={mobileView}
        onChangeMobileView={setMobileView}
      />

      {placeEditor && (
        <AddPlaceDialog
          initialPlace={placeEditor.place}
          onClose={() => setPlaceEditor(null)}
          onSavePlace={handleSavePlace}
        />
      )}
    </div>
  );
}
