export default function CandidatePlaces({
  candidates,
  dayNumber,
  isDraft,
  onAddToDay,
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
              <div>
                <span className="candidate-type">{candidate.type.replace("-", " ")}</span>
                <h3>{candidate.name}</h3>
                {candidate.notes && <p>{candidate.notes}</p>}
              </div>
              {isDraft ? (
                <button type="button" onClick={() => onAddToDay(candidate.id)}>
                  Add to Day {dayNumber}
                </button>
              ) : (
                <span className="edit-hint">Edit Plan to schedule</span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
