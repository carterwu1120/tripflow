export default function CandidatePlaces({
  candidates,
  onEditCandidate,
  onRemoveCandidate,
}) {
  if (!candidates.length) return null;

  return (
    <section className="candidate-section" aria-labelledby="tentative-heading">
      <div className="candidate-heading-row">
        <div>
          <p className="eyebrow">Try it on the map</p>
          <h2 id="tentative-heading">Tentative places</h2>
        </div>
      </div>

      <div className="candidate-list">
        {candidates.map((candidate) => (
          <article className="candidate-card tentative-card" key={candidate.id}>
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
            </div>
            <div className="candidate-actions">
              <button className="secondary-button compact" type="button" onClick={() => onEditCandidate(candidate)}>
                Edit
              </button>
              <button
                className="candidate-delete-button"
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete ${candidate.name}?`)) onRemoveCandidate(candidate.id);
                }}
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
