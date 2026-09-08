export default function CandidatePlaces({
  candidates,
  onEditCandidate,
  onRemoveCandidate,
  onSelectCandidate,
  selectedPlaceId,
  onConfirmCandidate,
  onAddTentative,
}) {
  return (
    <section className="candidate-section" aria-labelledby="tentative-heading">
      <div className="candidate-heading-row">
        <div>
          <p className="eyebrow">Try it on the map</p>
          <h2 id="tentative-heading">Tentative places</h2>
        </div>
        <button className="secondary-button compact" type="button" onClick={onAddTentative}>+ Add tentative</button>
      </div>

      <div className="candidate-list">
        {!candidates.length && (
          <div className="empty-candidates">
            Add hotels or places here first, then compare them with your itinerary on the map.
          </div>
        )}
        {candidates.map((candidate) => (
          <article className={`candidate-card tentative-card ${selectedPlaceId === candidate.id ? "selected" : ""}`} key={candidate.id}>
            <div className="candidate-content">
              <div className="candidate-labels">
                <span className="candidate-type">{candidate.type.replace("-", " ")}</span>
                <span className="status-badge tentative">Tentative</span>
              </div>
              <h3>{candidate.name}</h3>
              <div className="candidate-summary">
                {candidate.time?.value && <span>~{candidate.time.value}</span>}
                {candidate.notes && <span>{candidate.notes}</span>}
              </div>
              {!candidate.coordinatesConfirmed && (
                <p className="location-warning">Not shown on map — add a full Google Maps link with location.</p>
              )}
            </div>
            <div className="candidate-actions">
              <button className="secondary-button compact" type="button" onClick={() => onSelectCandidate(candidate.id)} disabled={!candidate.coordinatesConfirmed}>
                Show on map
              </button>
              <button className="primary-button compact" type="button" onClick={() => onConfirmCandidate(candidate)}>
                Add to itinerary
              </button>
              <button className="secondary-button compact" type="button" onClick={() => onEditCandidate(candidate)}>
                Edit
              </button>
              <button
                className="candidate-delete-button"
                type="button"
                onClick={() => onRemoveCandidate(candidate.id)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
