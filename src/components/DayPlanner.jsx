import { useEffect, useState } from "react";
import { routeStopsOf, staysForDay, summarizeDay } from "../domain/plan";
import CandidatePlaces from "./CandidatePlaces";
import ItineraryTimeline from "./ItineraryTimeline";
import MapSheet from "./MapSheet";
import StaySection from "./StaySection";
import TripMap from "./TripMap";

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export default function DayPlanner({
  days,
  day,
  candidates,
  stays,
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
  onEditStay,
  onRemoveStay,
  onConfirmStay,
  onUpdateLocation,
  pendingLegPairs,
  mapSheetSnap,
  onChangeMapSheetSnap,
}) {
  const [adjustingPlaceId, setAdjustingPlaceId] = useState(null);
  const todaysStays = staysForDay(stays, day.date);
  const confirmedStays = todaysStays.filter((stay) => stay.status === "confirmed");
  const tentativeStays = todaysStays.filter((stay) => stay.status === "tentative");
  const selectedPlace = [...day.stops, ...candidates, ...todaysStays].find((place) => place.id === selectedPlaceId);
  const routeStops = routeStopsOf(day);
  const summary = summarizeDay(day);

  useEffect(() => setAdjustingPlaceId(null), [day.id]);

  return (
    <main className="planner-shell">
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
          className="itinerary-pane"
          aria-label={`Day ${day.dayNumber} itinerary`}
        >
          <div className="day-heading">
            <div>
              <p className="eyebrow">Day {day.dayNumber} · {day.dateLabel}</p>
              <h1>{day.title}</h1>
            </div>
            <span className="stop-count">{routeStops.length} stops</span>
          </div>

          {(summary.totalMinutes > 0 || summary.firstTime || summary.lastTime) && (
            <p className="day-summary">
              {[
                summary.firstTime && summary.lastTime ? `${summary.firstTime} → ${summary.lastTime}` : null,
                summary.totalMinutes > 0 ? `~${formatDuration(summary.totalMinutes)} driving${summary.isPartial ? " so far" : ""}` : null,
              ].filter(Boolean).join(" · ")}
            </p>
          )}

          <StaySection
            confirmedStays={confirmedStays}
            tentativeStays={tentativeStays}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={onSelectPlace}
            onEditStay={onEditStay}
            onRemoveStay={onRemoveStay}
            onConfirmStay={onConfirmStay}
          />

          <ItineraryTimeline
            day={day}
            selectedStopId={selectedPlaceId}
            onSelectStop={onSelectPlace}
            onReorder={onReorder}
            onRemoveStop={onRemoveStop}
            onEditStop={onEditStop}
            pendingLegPairs={pendingLegPairs}
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

        <MapSheet snap={mapSheetSnap} onSnapChange={onChangeMapSheetSnap} ariaLabel={`Day ${day.dayNumber} map`}>
          <TripMap
            dayId={day.id}
            stops={day.stops}
            travelLegs={day.travelLegs}
            tentativePlaces={candidates.filter((candidate) => candidate.locationAccuracy !== "missing")}
            stays={todaysStays}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={onSelectPlace}
            adjustingPlaceId={adjustingPlaceId}
            onLocationChange={(placeId, latitude, longitude) => {
              onUpdateLocation(placeId, latitude, longitude);
              setAdjustingPlaceId(null);
            }}
          />
          <div className="map-key">
            <span><i className="key-dot confirmed" />Confirmed</span>
            <span><i className="key-dot tentative" />Tentative</span>
            <span><i className="key-dot hotel" />Stay</span>
            <span><i className="key-dot approximate" />Approximate location</span>
            <span><i className="key-line" />Itinerary order</span>
          </div>
          {selectedPlace && (
            <div className="map-selection-card">
              <strong>{selectedPlace.name}</strong>
              <span className={`location-state ${selectedPlace.locationAccuracy}`}>
                {selectedPlace.locationAccuracy === "confirmed"
                  ? "Confirmed location"
                  : selectedPlace.locationAccuracy === "approximate"
                    ? "Approximate location"
                    : "Location missing"}
              </span>
              {selectedPlace.locationAccuracy !== "missing" && (
                adjustingPlaceId === selectedPlace.id ? (
                  <>
                    <p>Drag the highlighted pin to its exact location.</p>
                    <button type="button" onClick={() => setAdjustingPlaceId(null)}>Cancel adjustment</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setAdjustingPlaceId(selectedPlace.id)}>Adjust pin</button>
                )
              )}
              <button type="button" onClick={() => onChangeMapSheetSnap("peek")}>Collapse map</button>
            </div>
          )}
        </MapSheet>
      </div>
    </main>
  );
}
