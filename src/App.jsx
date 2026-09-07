import { useCallback, useEffect, useMemo, useState } from "react";
import AddPlaceDialog from "./components/AddPlaceDialog";
import DayPlanner from "./components/DayPlanner";
import { initialCandidates, initialTrip } from "./data/okinawaDay3";

const STORAGE_KEY = "tripflow-okinawa-day3";

function clone(value) {
  return structuredClone(value);
}

function loadSavedPlan() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { trip: initialTrip, candidates: initialCandidates };
  } catch {
    return { trip: initialTrip, candidates: initialCandidates };
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
  const [savedPlan, setSavedPlan] = useState(loadSavedPlan);
  const [draft, setDraft] = useState(null);
  const [selectedStopId, setSelectedStopId] = useState(null);
  const [mobileView, setMobileView] = useState("itinerary");
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);

  const visiblePlan = draft ?? savedPlan;
  const day = visiblePlan.trip.days[0];
  const isDraft = draft !== null;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPlan));
  }, [savedPlan]);

  useEffect(() => {
    if (selectedStopId && !day.stops.some((stop) => stop.id === selectedStopId)) {
      setSelectedStopId(null);
    }
  }, [day.stops, selectedStopId]);

  const updateDraftDay = useCallback((updater) => {
    setDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      const nextDay = updater(currentDraft.trip.days[0]);
      return {
        ...currentDraft,
        trip: { ...currentDraft.trip, days: [nextDay] },
      };
    });
  }, []);

  const handleSelectStop = useCallback((stopId) => {
    setSelectedStopId(stopId);
  }, []);

  function startDraft() {
    setDraft(clone(savedPlan));
  }

  function discardDraft() {
    setDraft(null);
    setSelectedStopId(null);
  }

  function applyDraft() {
    setSavedPlan(draft);
    setDraft(null);
  }

  function handleReorder(draggedStopId, targetStopId) {
    updateDraftDay((currentDay) => ({
      ...currentDay,
      stops: reorderStops(currentDay.stops, draggedStopId, targetStopId),
    }));
  }

  function handleRemoveStop(stopId) {
    const removedStop = day.stops.find((stop) => stop.id === stopId);
    if (!removedStop) return;

    setDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      const currentDay = currentDraft.trip.days[0];
      return {
        ...currentDraft,
        trip: {
          ...currentDraft.trip,
          days: [{ ...currentDay, stops: currentDay.stops.filter((stop) => stop.id !== stopId) }],
        },
        candidates: [
          ...currentDraft.candidates,
          { ...removedStop, status: "candidate", time: { kind: "none", value: null } },
        ],
      };
    });
  }

  function handleChangeTime(stopId, time) {
    updateDraftDay((currentDay) => ({
      ...currentDay,
      stops: currentDay.stops.map((stop) => stop.id === stopId ? { ...stop, time } : stop),
    }));
  }

  function handleAddCandidateToDay(candidateId) {
    setDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      const candidate = currentDraft.candidates.find((place) => place.id === candidateId);
      if (!candidate) return currentDraft;

      const currentDay = currentDraft.trip.days[0];
      return {
        ...currentDraft,
        trip: {
          ...currentDraft.trip,
          days: [{
            ...currentDay,
            stops: [...currentDay.stops, { ...candidate, status: "planned" }],
          }],
        },
        candidates: currentDraft.candidates.filter((place) => place.id !== candidateId),
      };
    });
    setSelectedStopId(candidateId);
  }

  function handleSaveCandidate(candidate) {
    if (isDraft) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        candidates: [...currentDraft.candidates, candidate],
      }));
    } else {
      setSavedPlan((currentPlan) => ({
        ...currentPlan,
        candidates: [...currentPlan.candidates, candidate],
      }));
    }
    setIsAddPlaceOpen(false);
  }

  const statusText = useMemo(
    () => isDraft ? "Draft Mode" : "Official Plan",
    [isDraft],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="product-name">TripFlow</p>
            <p className="trip-name">{visiblePlan.trip.name} · {visiblePlan.trip.location}</p>
          </div>
        </div>

        <div className="plan-actions">
          <span className={`plan-status ${isDraft ? "draft" : ""}`}>
            <i />{statusText}
          </span>
          {isDraft ? (
            <>
              <button className="secondary-button" type="button" onClick={discardDraft}>Discard</button>
              <button className="primary-button" type="button" onClick={applyDraft}>Apply Changes</button>
            </>
          ) : (
            <button className="primary-button" type="button" onClick={startDraft}>Edit Plan</button>
          )}
        </div>
      </header>

      <DayPlanner
        day={day}
        candidates={visiblePlan.candidates}
        selectedStopId={selectedStopId}
        onSelectStop={handleSelectStop}
        isDraft={isDraft}
        onReorder={handleReorder}
        onRemoveStop={handleRemoveStop}
        onChangeTime={handleChangeTime}
        onAddCandidateToDay={handleAddCandidateToDay}
        onOpenAddPlace={() => setIsAddPlaceOpen(true)}
        mobileView={mobileView}
        onChangeMobileView={setMobileView}
      />

      {isAddPlaceOpen && (
        <AddPlaceDialog
          onClose={() => setIsAddPlaceOpen(false)}
          onSaveCandidate={handleSaveCandidate}
        />
      )}
    </div>
  );
}
