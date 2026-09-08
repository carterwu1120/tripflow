function distanceKm(from, to) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(from.latitude))
      * Math.cos(toRadians(to.latitude))
      * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasCoordinates(place) {
  return Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude);
}

function HotelDistanceSummary({ hotel, day, nextDay }) {
  if (!hasCoordinates(hotel)) return null;

  const dayPlaces = day.stops.filter((stop) => stop.type !== "hotel" && hasCoordinates(stop));
  if (!dayPlaces.length) return null;

  const distances = dayPlaces.map((stop) => distanceKm(hotel, stop));
  const average = distances.reduce((total, distance) => total + distance, 0) / distances.length;
  const farthest = Math.max(...distances);
  const nextStop = nextDay?.stops.find((stop) => stop.type !== "hotel" && hasCoordinates(stop));
  const nextDistance = nextStop ? distanceKm(hotel, nextStop) : null;

  return (
    <div className="hotel-distance">
      <strong>Hotel location check</strong>
      <span>Day {day.dayNumber} places: avg. {average.toFixed(1)} km · farthest {farthest.toFixed(1)} km</span>
      {nextStop && (
        <span>Next morning to {nextStop.name}: {nextDistance.toFixed(1)} km</span>
      )}
      <small>
        {hotel.coordinatesConfirmed === false && "Coordinates unconfirmed · "}
        Straight-line distance only; actual driving time may differ.
      </small>
    </div>
  );
}

export default function CandidatePlaces({
  candidates,
  day,
  nextDay,
  dayNumber,
  isDraft,
  onAddToDay,
  onEditCandidate,
  onOpenAddPlace,
}) {
  return (
    <section className="candidate-section" aria-labelledby="candidate-heading">
      <div className="candidate-heading-row">
        <div>
          <p className="eyebrow">Saved for later</p>
          <h2 id="candidate-heading">Candidate places</h2>
        </div>
        <button className="secondary-button compact" type="button" onClick={onOpenAddPlace}>
          + Add place
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="empty-candidates">No unassigned places. Add one whenever inspiration strikes.</p>
      ) : (
        <div className="candidate-list">
          {candidates.map((candidate) => (
            <article className="candidate-card" key={candidate.id}>
              <div className="candidate-content">
                <span className="candidate-type">{candidate.type.replace("-", " ")}</span>
                <h3>{candidate.name}</h3>
                {candidate.notes && <p>{candidate.notes}</p>}
                {candidate.type === "hotel" && (
                  <HotelDistanceSummary hotel={candidate} day={day} nextDay={nextDay} />
                )}
              </div>
              <div className="candidate-actions">
                <button className="secondary-button compact" type="button" onClick={() => onEditCandidate(candidate)}>
                  Edit
                </button>
                {isDraft ? (
                  <button type="button" onClick={() => onAddToDay(candidate.id)}>
                    Add to Day {dayNumber}
                  </button>
                ) : (
                  <span className="edit-hint">Edit Plan to schedule</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
