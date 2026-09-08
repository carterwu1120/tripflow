import { useCallback, useEffect, useMemo, useState } from "react";
import AddPlaceDialog from "./components/AddPlaceDialog";
import DayPlanner from "./components/DayPlanner";
import { initialCandidates, initialTrip } from "./data/okinawaDay3";

const STORAGE_KEY = "tripflow-okinawa-2027-v2";

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
  const [selectedDayId, setSelectedDayId] = useState(() => initialTrip.days[0].id);
  const [selectedStopId, setSelectedStopId] = useState(null);
  const [mobileView, setMobileView] = useState("itinerary");
  const [placeEditor, setPlaceEditor] = useState(null);

  const visiblePlan = draft ?? savedPlan;
  const days = visiblePlan.trip.days;
  const day = days.find((candidateDay) => candidateDay.id === selectedDayId) ?? days[0];
  const visibleCandidates = visiblePlan.candidates.filter(
    (candidate) => !candidate.suggestedDayId || candidate.suggestedDayId === day.id,
  );
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
      const currentDay = currentDraft.trip.days.find(({ id }) => id === selectedDayId);
      if (!currentDay) return currentDraft;
      const nextDay = updater(currentDay);
      return {
        ...currentDraft,
        trip: {
          ...currentDraft.trip,
          days: currentDraft.trip.days.map((candidateDay) =>
            candidateDay.id === selectedDayId ? nextDay : candidateDay
          ),
        },
      };
    });
  }, [selectedDayId]);

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
      const currentDay = currentDraft.trip.days.find(({ id }) => id === selectedDayId);
      if (!currentDay) return currentDraft;
      return {
        ...currentDraft,
        trip: {
          ...currentDraft.trip,
          days: currentDraft.trip.days.map((candidateDay) =>
            candidateDay.id === selectedDayId
              ? { ...currentDay, stops: currentDay.stops.filter((stop) => stop.id !== stopId) }
              : candidateDay
          ),
        },
        candidates: [
          ...currentDraft.candidates,
          {
            ...removedStop,
            suggestedDayId: selectedDayId,
            status: "candidate",
            time: { kind: "none", value: null },
          },
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

      const currentDay = currentDraft.trip.days.find(({ id }) => id === selectedDayId);
      if (!currentDay) return currentDraft;
      return {
        ...currentDraft,
        trip: {
          ...currentDraft.trip,
          days: currentDraft.trip.days.map((candidateDay) =>
            candidateDay.id === selectedDayId
              ? {
                  ...currentDay,
                  stops: [...currentDay.stops, { ...candidate, status: "planned" }],
                }
              : candidateDay
          ),
        },
        candidates: currentDraft.candidates.filter((place) => place.id !== candidateId),
      };
    });
    setSelectedStopId(candidateId);
  }

  function handleSaveCandidate(candidate) {
    const candidateForDay = { ...candidate, suggestedDayId: selectedDayId };
    if (isDraft) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        candidates: [...currentDraft.candidates, candidateForDay],
      }));
    } else {
      setSavedPlan((currentPlan) => ({
        ...currentPlan,
        candidates: [...currentPlan.candidates, candidateForDay],
      }));
    }
    setPlaceEditor(null);
  }

  function handleSavePlace(place) {
    if (placeEditor?.kind === "stop") {
      updateDraftDay((currentDay) => ({
        ...currentDay,
        stops: currentDay.stops.map((stop) => stop.id === place.id ? place : stop),
      }));
      setPlaceEditor(null);
      return;
    }

    if (placeEditor?.kind === "candidate") {
      const updateCandidate = (currentPlan) => ({
        ...currentPlan,
        candidates: currentPlan.candidates.map((candidate) =>
          candidate.id === place.id ? { ...place, suggestedDayId: selectedDayId } : candidate
        ),
      });
      if (isDraft) setDraft(updateCandidate);
      else setSavedPlan(updateCandidate);
      setPlaceEditor(null);
      return;
    }

    handleSaveCandidate(place);
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
        days={days}
        day={day}
        candidates={visibleCandidates}
        onSelectDay={(dayId) => {
          setSelectedDayId(dayId);
          setSelectedStopId(null);
        }}
        selectedStopId={selectedStopId}
        onSelectStop={handleSelectStop}
        isDraft={isDraft}
        onReorder={handleReorder}
        onRemoveStop={handleRemoveStop}
        onChangeTime={handleChangeTime}
        onEditStop={(stop) => setPlaceEditor({ kind: "stop", place: stop })}
        onAddCandidateToDay={handleAddCandidateToDay}
        onEditCandidate={(candidate) => setPlaceEditor({ kind: "candidate", place: candidate })}
        onOpenAddPlace={() => setPlaceEditor({ kind: "new", place: null })}
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
