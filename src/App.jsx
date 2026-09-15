import { useEffect, useReducer, useRef, useState } from "react";
import AddPlaceDialog from "./components/AddPlaceDialog";
import DayPlanner from "./components/DayPlanner";
import { initialCandidates, initialTrip } from "./data/okinawaDay3";
import { findMissingTravelLegPairs, normalizePlan, planReducer, routeStopsOf } from "./domain/plan";
import { loadRemotePlan, saveRemotePlan } from "./services/planSync";
import { computeTravelTime } from "./services/travelTime";

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
  const [mapSheetSnap, setMapSheetSnap] = useState("peek");
  const [placeEditor, setPlaceEditor] = useState(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("loading");
  const [pendingLegPairs, setPendingLegPairs] = useState(() => new Set());
  const attemptedLegPairsRef = useRef(new Set());

  const days = plan.trip.days;
  const day = days.find((candidateDay) => candidateDay.id === selectedDayId) ?? days[0];
  const tentativePlaces = plan.candidates.filter(
    (candidate) => !candidate.suggestedDayId || candidate.suggestedDayId === day.id,
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  useEffect(() => {
    let cancelled = false;
    loadRemotePlan()
      .then((remote) => {
        if (cancelled) return;
        if (remote?.plan) dispatch({ type: "replace-plan", plan: remote.plan });
        setCloudReady(true);
        setSyncStatus(remote ? "synced" : "saving");
      })
      .catch((error) => {
        if (cancelled) return;
        setSyncStatus(error.status === 401 || error.status === 403 ? "local" : "offline");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!cloudReady) return undefined;
    setSyncStatus("saving");
    const timeout = window.setTimeout(() => {
      saveRemotePlan(plan)
        .then(() => setSyncStatus("synced"))
        .catch((error) => setSyncStatus(error.status === 401 || error.status === 403 ? "local" : "offline"));
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [cloudReady, plan]);

  useEffect(() => {
    if (selectedPlaceId && !day.stops.some((stop) => stop.id === selectedPlaceId)
      && !tentativePlaces.some((place) => place.id === selectedPlaceId)) {
      setSelectedPlaceId(null);
    }
  }, [day.stops, selectedPlaceId, tentativePlaces]);

  useEffect(() => {
    const missingPairs = findMissingTravelLegPairs(routeStopsOf(day), day.travelLegs)
      .filter((pair) => !attemptedLegPairsRef.current.has(`${pair.fromStopId}:${pair.toStopId}`));
    if (!missingPairs.length) return;

    missingPairs.forEach((pair) => {
      const key = `${pair.fromStopId}:${pair.toStopId}`;
      attemptedLegPairsRef.current.add(key);
      setPendingLegPairs((prev) => new Set(prev).add(key));

      computeTravelTime(pair.from, pair.to)
        .then((result) => {
          dispatch({
            type: "set-travel-leg",
            dayId: day.id,
            fromStopId: pair.fromStopId,
            toStopId: pair.toStopId,
            mode: pair.existingLeg?.mode ?? result.mode,
            minutes: pair.existingLeg?.minutes ?? result.minutes,
            polyline: result.polyline,
          });
        })
        .catch(() => {})
        .finally(() => {
          setPendingLegPairs((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        });
    });
  }, [day]);

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

  function handleSelectPlace(placeId) {
    setSelectedPlaceId(placeId);
    if (placeId) setMapSheetSnap((prev) => (prev === "peek" ? "half" : prev));
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
        <div className="header-actions">
          <p className={`sync-status ${syncStatus}`} role="status">
            {syncStatus === "loading" && "Checking cloud…"}
            {syncStatus === "saving" && "Saving…"}
            {syncStatus === "synced" && "Saved to cloud"}
            {syncStatus === "local" && "Saved on this device"}
            {syncStatus === "offline" && "Offline · saved locally"}
          </p>
          <button className="primary-button" type="button" onClick={() => setPlaceEditor({ kind: "new", place: null })}>
            + Add place
          </button>
        </div>
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
        onSelectPlace={handleSelectPlace}
        onReorder={handleReorder}
        onRemoveStop={handleRemoveStop}
        onEditStop={(stop) => setPlaceEditor({ kind: "confirmed", place: stop })}
        onEditCandidate={(candidate) => setPlaceEditor({ kind: "tentative", place: candidate })}
        onRemoveCandidate={handleRemoveTentative}
        onConfirmCandidate={(candidate) => handleSavePlace({ ...candidate, status: "confirmed" })}
        onAddTentative={() => setPlaceEditor({ kind: "new", place: null, presetStatus: "tentative" })}
        onUpdateLocation={handleUpdateLocation}
        pendingLegPairs={pendingLegPairs}
        mapSheetSnap={mapSheetSnap}
        onChangeMapSheetSnap={setMapSheetSnap}
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
          dayDate={day.date}
          onClose={() => setPlaceEditor(null)}
          onSavePlace={handleSavePlace}
        />
      )}
    </div>
  );
}
