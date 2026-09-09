import { useEffect, useReducer, useState } from "react";
import AddPlaceDialog from "./components/AddPlaceDialog";
import DayPlanner from "./components/DayPlanner";
import { initialCandidates, initialTrip } from "./data/okinawaDay3";
import { normalizePlan, planReducer } from "./domain/plan";

const STORAGE_KEY = "tripflow-okinawa-2027-v3";
const LEGACY_STORAGE_KEY = "tripflow-okinawa-2027-v2";

function loadPlan() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    return normalizePlan(saved
      ? JSON.parse(saved)
      : { trip: initialTrip, candidates: initialCandidates });
  } catch {
    return normalizePlan({ trip: initialTrip, candidates: initialCandidates });
  }
}

export default function App() {
  const [planState, dispatch] = useReducer(planReducer, null, () => ({ present: loadPlan(), past: [], notice: null }));
  const plan = planState.present;
  const [selectedDayId, setSelectedDayId] = useState(() => initialTrip.days[0].id);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
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
    if (selectedPlaceId && !day.stops.some((stop) => stop.id === selectedPlaceId)
      && !tentativePlaces.some((place) => place.id === selectedPlaceId)) {
      setSelectedPlaceId(null);
    }
  }, [day.stops, selectedPlaceId, tentativePlaces]);

  function handleReorder(draggedStopId, targetStopId) {
    dispatch({ type: "reorder", dayId: selectedDayId, draggedStopId, targetStopId });
  }

  function handleRemoveStop(stopId) {
    dispatch({ type: "remove-stop", dayId: selectedDayId, placeId: stopId });
  }

  function handleRemoveTentative(placeId) {
    dispatch({ type: "remove-tentative", placeId });
  }

  function handleSavePlace(place) {
    dispatch({ type: "save-place", dayId: selectedDayId, place });
    setPlaceEditor(null);
    setSelectedPlaceId(place.id);
  }

  function handleUpdateLocation(placeId, latitude, longitude) {
    dispatch({ type: "update-location", placeId, latitude, longitude });
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
          setSelectedPlaceId(null);
        }}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={setSelectedPlaceId}
        onReorder={handleReorder}
        onRemoveStop={handleRemoveStop}
        onEditStop={(stop) => setPlaceEditor({ kind: "confirmed", place: stop })}
        onEditCandidate={(candidate) => setPlaceEditor({ kind: "tentative", place: candidate })}
        onRemoveCandidate={handleRemoveTentative}
        onConfirmCandidate={(candidate) => handleSavePlace({ ...candidate, status: "confirmed" })}
        onAddTentative={() => setPlaceEditor({ kind: "new", place: null, presetStatus: "tentative" })}
        onUpdateLocation={handleUpdateLocation}
        mobileView={mobileView}
        onChangeMobileView={setMobileView}
      />

      {planState.notice && (
        <div className="undo-bar" role="status">
          <span>{planState.notice}</span>
          {planState.past.length > 0 && <button type="button" onClick={() => dispatch({ type: "undo" })}>Undo</button>}
          <button type="button" className="undo-dismiss" aria-label="Dismiss" onClick={() => dispatch({ type: "clear-notice" })}>×</button>
        </div>
      )}

      {placeEditor && (
        <AddPlaceDialog
          initialPlace={placeEditor.place}
          presetStatus={placeEditor.presetStatus}
          dayLabel={`Day ${day.dayNumber} · ${day.dateLabel}`}
          onClose={() => setPlaceEditor(null)}
          onSavePlace={handleSavePlace}
        />
      )}
    </div>
  );
}
