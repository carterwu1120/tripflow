import CandidatePlaces from "./CandidatePlaces";
import ItineraryTimeline from "./ItineraryTimeline";
import TripMap from "./TripMap";

export default function DayPlanner({
  day,
  candidates,
  selectedStopId,
  onSelectStop,
  isDraft,
  onReorder,
  onRemoveStop,
  onChangeTime,
  onAddCandidateToDay,
  onOpenAddPlace,
  mobileView,
  onChangeMobileView,
}) {
  return (
    <main className="planner-shell">
      <div className="mobile-mode-toggle" aria-label="Planner view">
        <button
          className={mobileView === "itinerary" ? "active" : ""}
          type="button"
          onClick={() => onChangeMobileView("itinerary")}
        >
          Itinerary
        </button>
        <button
          className={mobileView === "map" ? "active" : ""}
          type="button"
          onClick={() => onChangeMobileView("map")}
        >
          Map
        </button>
      </div>

      <div className="planner-grid">
        <section
          className={`itinerary-pane ${mobileView === "map" ? "mobile-hidden" : ""}`}
          aria-label="Day 3 itinerary"
        >
          <div className="day-heading">
            <div>
              <p className="eyebrow">Day {day.dayNumber} · {day.dateLabel}</p>
              <h1>{day.title}</h1>
            </div>
            <span className="stop-count">{day.stops.length} stops</span>
          </div>

          {isDraft && (
            <div className="draft-notice" role="status">
              <span>Draft workspace</span>
              Drag stops or use the arrow buttons. Nothing changes until you apply.
            </div>
          )}

          <ItineraryTimeline
            day={day}
            selectedStopId={selectedStopId}
            onSelectStop={onSelectStop}
            isDraft={isDraft}
            onReorder={onReorder}
            onRemoveStop={onRemoveStop}
            onChangeTime={onChangeTime}
          />

          <CandidatePlaces
            candidates={candidates}
            isDraft={isDraft}
            onAddToDay={onAddCandidateToDay}
            onOpenAddPlace={onOpenAddPlace}
          />
        </section>

        <section
          className={`map-pane ${mobileView === "itinerary" ? "mobile-hidden" : ""}`}
          aria-label="Day 3 map"
        >
          <TripMap
            stops={day.stops}
            selectedStopId={selectedStopId}
            onSelectStop={onSelectStop}
          />
          <div className="map-key">
            <span><i className="key-dot selected" />Selected stop</span>
            <span><i className="key-line" />Planned order</span>
          </div>
        </section>
      </div>
    </main>
  );
}
