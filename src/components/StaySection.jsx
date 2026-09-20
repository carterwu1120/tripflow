function formatDateShort(iso) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatStayRange(stay) {
  const range = `${formatDateShort(stay.checkInDate)} → ${formatDateShort(stay.checkOutDate)}`;
  return stay.checkInTime ? `${range} · arriving ~${stay.checkInTime}` : range;
}

function StayCard({ place, isTentative, isSelected, onSelect, onEdit, onRemove, onConfirm }) {
  return (
    <article className={`candidate-card stay-card ${isSelected ? "selected" : ""}`}>
      <div className="candidate-content">
        <div className="candidate-labels">
          <span className="candidate-type">Hotel</span>
          <span className={`status-badge ${isTentative ? "tentative" : "confirmed"}`}>
            {isTentative ? "Considering" : "Confirmed"}
          </span>
        </div>
        <h3>{place.name}</h3>
        <div className="candidate-summary">
          <span>{formatStayRange(place)}</span>
          {place.notes && <span>{place.notes}</span>}
        </div>
        {place.locationAccuracy === "missing" && (
          <p className="location-warning">Not shown on map — add a full Google Maps link with location.</p>
        )}
        {place.locationAccuracy === "approximate" && (
          <p className="location-warning">Approximate location — verify this pin before comparing distance.</p>
        )}
      </div>
      <div className="candidate-actions">
        <button
          className="secondary-button compact"
          type="button"
          onClick={() => onSelect(place.id)}
          disabled={place.locationAccuracy === "missing"}
        >
          Show on map
        </button>
        {isTentative && (
          <button className="primary-button compact" type="button" onClick={() => onConfirm(place)}>
            Add to itinerary
          </button>
        )}
        <button className="secondary-button compact" type="button" onClick={() => onEdit(place)}>
          Edit
        </button>
        <button className="candidate-delete-button" type="button" onClick={() => onRemove(place.id)}>
          Delete
        </button>
      </div>
    </article>
  );
}

export default function StaySection({
  confirmedStays,
  tentativeStays,
  selectedPlaceId,
  onSelectPlace,
  onEditStay,
  onRemoveStay,
  onConfirmStay,
}) {
  if (!confirmedStays.length && !tentativeStays.length) return null;

  return (
    <section className="candidate-section stay-section" aria-labelledby="stay-heading">
      <div className="candidate-heading-row">
        <div>
          <p className="eyebrow">Where you're staying</p>
          <h2 id="stay-heading">This day's stay</h2>
        </div>
      </div>

      <div className="candidate-list">
        {confirmedStays.map((stay) => (
          <StayCard
            key={stay.id}
            place={stay}
            isTentative={false}
            isSelected={selectedPlaceId === stay.id}
            onSelect={onSelectPlace}
            onEdit={onEditStay}
            onRemove={onRemoveStay}
          />
        ))}
        {tentativeStays.map((stay) => (
          <StayCard
            key={stay.id}
            place={stay}
            isTentative
            isSelected={selectedPlaceId === stay.id}
            onSelect={onSelectPlace}
            onEdit={onEditStay}
            onRemove={onRemoveStay}
            onConfirm={onConfirmStay}
          />
        ))}
      </div>
    </section>
  );
}
