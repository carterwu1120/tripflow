export default function CandidatePlaces({
  candidates,
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
        <div className="candidate-heading-actions">
          <button className="secondary-button compact" type="button" onClick={() => onOpenAddPlace("other")}>
            + Place
          </button>
          <button className="secondary-button compact" type="button" onClick={() => onOpenAddPlace("hotel")}>
            + Hotel
          </button>
        </div>
      </div>

      {candidates.length === 0 ? (
        <p className="empty-candidates">No saved places for this day yet.</p>
      ) : (
        <div className="candidate-list">
          {candidates.map((candidate) => (
            <article className="candidate-card" key={candidate.id}>
              <div className="candidate-content">
                <span className="candidate-type">{candidate.type.replace("-", " ")}</span>
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
