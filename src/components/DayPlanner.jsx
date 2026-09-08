import CandidatePlaces from "./CandidatePlaces";
import ItineraryTimeline from "./ItineraryTimeline";
import TripMap from "./TripMap";

export default function DayPlanner({
  days,
  day,
  candidates,
  onSelectDay,
  selectedPlaceId,
  onSelectPlace,
  onReorder,
  onRemoveStop,
  onEditStop,
  onEditCandidate,
  onRemoveCandidate,
  onConfirmCandidate,
  onAddTentative,
  mobileView,
  onChangeMobileView,
}) {
  return (
    <main className="planner-shell">
      <div className="mobile-mode-toggle" aria-label="Planner view">
        <button
          className={mobileView === "itinerary" ? "active" : ""}
          aria-pressed={mobileView === "itinerary"}
          type="button"
          onClick={() => onChangeMobileView("itinerary")}
        >
          Itinerary
        </button>
        <button
          className={mobileView === "map" ? "active" : ""}
          aria-pressed={mobileView === "map"}
          type="button"
          onClick={() => onChangeMobileView("map")}
        >
          Map
        </button>
      </div>

      <nav className="day-tabs" aria-label="Trip days">
        {days.map((tripDay) => (
          <button
            className={tripDay.id === day.id ? "active" : ""}
            type="button"
            key={tripDay.id}
            onClick={() => onSelectDay(tripDay.id)}
            aria-current={tripDay.id === day.id ? "date" : undefined}
          >
            <strong>Day {tripDay.dayNumber}</strong>
            <span>{tripDay.dateLabel.replace(/^[A-Za-z]+, /, "")}</span>
          </button>
        ))}
      </nav>

      <div className="planner-grid">
        <section
          className={`itinerary-pane ${mobileView === "map" ? "mobile-hidden" : ""}`}
          aria-label={`Day ${day.dayNumber} itinerary`}
        >
          <div className="day-heading">
            <div>
              <p className="eyebrow">Day {day.dayNumber} · {day.dateLabel}</p>
              <h1>{day.title}</h1>
            </div>
            <span className="stop-count">{day.stops.length} stops</span>
          </div>

          <ItineraryTimeline
            day={day}
            selectedStopId={selectedPlaceId}
            onSelectStop={onSelectPlace}
            onReorder={onReorder}
            onRemoveStop={onRemoveStop}
            onEditStop={onEditStop}
          />

          <CandidatePlaces
            candidates={candidates}
            dayNumber={day.dayNumber}
            onEditCandidate={onEditCandidate}
            onRemoveCandidate={onRemoveCandidate}
            onSelectCandidate={onSelectPlace}
            selectedPlaceId={selectedPlaceId}
            onConfirmCandidate={onConfirmCandidate}
            onAddTentative={onAddTentative}
          />
        </section>

        <section
          className={`map-pane ${mobileView === "itinerary" ? "mobile-hidden" : ""}`}
          aria-label={`Day ${day.dayNumber} map`}
        >
          <TripMap
            dayId={day.id}
            stops={day.stops}
            tentativePlaces={candidates.filter((candidate) => candidate.coordinatesConfirmed)}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={onSelectPlace}
          />
          <div className="map-key">
            <span><i className="key-dot confirmed" />Confirmed</span>
            <span><i className="key-dot tentative" />Tentative</span>
            <span><i className="key-line" />Itinerary order</span>
          </div>
          {selectedPlaceId && (
            <div className="map-selection-card">
              <strong>{[...day.stops, ...candidates].find((place) => place.id === selectedPlaceId)?.name}</strong>
              <button type="button" onClick={() => onChangeMobileView("itinerary")}>View in itinerary</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
