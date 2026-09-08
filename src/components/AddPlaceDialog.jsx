import { useEffect, useState } from "react";
import { searchPlaces } from "../services/placeSearch";

const DEFAULT_COORDINATES = { latitude: 26.47, longitude: 127.88 };

export default function AddPlaceDialog({ onClose, onSaveCandidate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [urlName, setUrlName] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");

  useEffect(() => {
    searchPlaces("").then(setResults);
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    setResults(await searchPlaces(query));
  }

  function saveResult(place) {
    onSaveCandidate({
      ...place,
      id: `${place.id}-${Date.now()}`,
      time: { kind: "none", value: null },
      durationMinutes: 60,
      openingHours: null,
      lastEntryTime: null,
      notes: "Added from mock place search.",
      reservationRequired: false,
      coordinatesConfirmed: false,
      status: "candidate",
    });
  }

  function saveUrl(event) {
    event.preventDefault();
    if (!urlName.trim() || !mapsUrl.trim()) return;

    onSaveCandidate({
      id: `candidate-${Date.now()}`,
      name: urlName.trim(),
      type: "other",
      ...DEFAULT_COORDINATES,
      time: { kind: "none", value: null },
      durationMinutes: 60,
      openingHours: null,
      lastEntryTime: null,
      notes: "Coordinates need confirmation before routing.",
      reservationRequired: false,
      coordinatesConfirmed: false,
      googleMapsUrl: mapsUrl.trim(),
      status: "candidate",
    });
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="place-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-place-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Candidate places</p>
            <h2 id="add-place-title">Save a place</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <label htmlFor="place-query">Search places</label>
          <div className="input-row">
            <input
              id="place-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try attraction, food, or a place name"
              autoFocus
            />
            <button type="submit">Search</button>
          </div>
          <p className="provider-note">Prototype results · a real provider can replace this service later.</p>
        </form>

        <div className="search-results" aria-live="polite">
          {results.length ? results.map((place) => (
            <article key={place.id}>
              <div>
                <span>{place.type}</span>
                <h3>{place.name}</h3>
              </div>
              <button type="button" onClick={() => saveResult(place)}>Save</button>
            </article>
          )) : <p className="no-results">No mock results match that search.</p>}
        </div>

        <div className="dialog-divider"><span>or paste from Google Maps</span></div>

        <form className="url-form" onSubmit={saveUrl}>
          <label htmlFor="url-place-name">Place name</label>
          <input
            id="url-place-name"
            value={urlName}
            onChange={(event) => setUrlName(event.target.value)}
            placeholder="Name this place"
            required
          />
          <label htmlFor="maps-url">Google Maps URL</label>
          <div className="input-row">
            <input
              id="maps-url"
              type="url"
              value={mapsUrl}
              onChange={(event) => setMapsUrl(event.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              required
            />
            <button type="submit">Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}
