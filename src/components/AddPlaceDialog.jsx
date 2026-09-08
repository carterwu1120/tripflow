import { useEffect, useState } from "react";
import { searchPlaces } from "../services/placeSearch";

const DEFAULT_COORDINATES = { latitude: 26.47, longitude: 127.88 };

const PLACE_TYPES = [
  ["attraction", "Attraction"],
  ["restaurant", "Food"],
  ["hotel", "Hotel"],
  ["shopping", "Shopping"],
  ["rest-stop", "Rest stop"],
  ["rental-car", "Rental car"],
  ["airport", "Airport"],
  ["other", "Other"],
];

function formFromPlace(place) {
  return {
    name: place?.name ?? "",
    type: place?.type ?? "other",
    latitude: String(place?.latitude ?? DEFAULT_COORDINATES.latitude),
    longitude: String(place?.longitude ?? DEFAULT_COORDINATES.longitude),
    timeKind: place?.time?.kind ?? "none",
    timeValue: place?.time?.value ?? "09:00",
    durationMinutes: String(place?.durationMinutes ?? 60),
    openingHours: place?.openingHours ?? "",
    lastEntryTime: place?.lastEntryTime ?? "",
    notes: place?.notes ?? "",
    reservationRequired: place?.reservationRequired ?? false,
    googleMapsUrl: place?.googleMapsUrl ?? "",
    coordinatesConfirmed: place?.coordinatesConfirmed ?? false,
  };
}

function coordinatesFromMapsUrl(value) {
  let url = value;
  try {
    url = decodeURIComponent(value);
  } catch {
    // Keep the original URL when it contains malformed escape sequences.
  }

  const coordinateMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    ?? url.match(/[?&](?:query|q)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    ?? url.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);

  if (!coordinateMatch) return null;
  const latitude = Number(coordinateMatch[1]);
  const longitude = Number(coordinateMatch[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export default function AddPlaceDialog({ initialPlace, onClose, onSavePlace }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [form, setForm] = useState(() => formFromPlace(initialPlace));
  const [urlMessage, setUrlMessage] = useState("");

  useEffect(() => {
    searchPlaces("").then(setResults);
  }, []);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSearch(event) {
    event.preventDefault();
    setResults(await searchPlaces(query));
  }

  function useSearchResult(place) {
    setForm((current) => ({
      ...current,
      name: place.name,
      type: place.type,
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      googleMapsUrl: place.googleMapsUrl,
      coordinatesConfirmed: false,
    }));
  }

  function parseMapsUrl() {
    if (!form.googleMapsUrl.trim()) {
      setUrlMessage("");
      return;
    }
    const coordinates = coordinatesFromMapsUrl(form.googleMapsUrl.trim());
    if (!coordinates) {
      setForm((current) => ({ ...current, coordinatesConfirmed: false }));
      setUrlMessage("This link does not expose coordinates. Enter them below or use a full Google Maps URL.");
      return;
    }
    setForm((current) => ({
      ...current,
      latitude: String(coordinates.latitude),
      longitude: String(coordinates.longitude),
      coordinatesConfirmed: true,
    }));
    setUrlMessage("Coordinates found in the Google Maps URL.");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    onSavePlace({
      ...initialPlace,
      id: initialPlace?.id ?? `candidate-${Date.now()}`,
      name: form.name.trim(),
      type: form.type,
      latitude,
      longitude,
      time: {
        kind: form.timeKind,
        value: form.timeKind === "none" ? null : form.timeValue,
      },
      durationMinutes: Math.max(0, Number(form.durationMinutes) || 0),
      openingHours: form.openingHours.trim() || null,
      lastEntryTime: form.lastEntryTime || null,
      notes: form.notes.trim(),
      reservationRequired: form.reservationRequired,
      coordinatesConfirmed: form.coordinatesConfirmed,
      googleMapsUrl: form.googleMapsUrl.trim()
        || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.name} Okinawa`)}`,
      status: initialPlace?.status ?? "candidate",
    });
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="place-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Place details</p>
            <h2 id="place-editor-title">{initialPlace ? "Edit place" : "Add a place"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </div>

        {!initialPlace && (
          <>
            <form className="search-form" onSubmit={handleSearch}>
              <label htmlFor="place-query">Search prototype places</label>
              <div className="input-row">
                <input id="place-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or type" />
                <button type="submit">Search</button>
              </div>
            </form>
            <div className="search-results compact-results" aria-live="polite">
              {results.map((place) => (
                <article key={place.id}>
                  <div><span>{place.type}</span><h3>{place.name}</h3></div>
                  <button type="button" onClick={() => useSearchResult(place)}>Use</button>
                </article>
              ))}
            </div>
            <div className="dialog-divider"><span>place details</span></div>
          </>
        )}

        <form className="place-editor-form" onSubmit={handleSubmit}>
          <div className="form-grid two-columns">
            <label>
              Place name
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} autoFocus={Boolean(initialPlace)} required />
            </label>
            <label>
              Type
              <select value={form.type} onChange={(event) => updateField("type", event.target.value)}>
                {PLACE_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <label>
            Google Maps URL
            <div className="input-row">
              <input type="url" value={form.googleMapsUrl} onChange={(event) => setForm((current) => ({ ...current, googleMapsUrl: event.target.value, coordinatesConfirmed: false }))} onBlur={parseMapsUrl} placeholder="Paste a full Google Maps URL" />
              <button className="secondary-button" type="button" onClick={parseMapsUrl}>Read location</button>
            </div>
            {urlMessage && <small className="form-help">{urlMessage}</small>}
          </label>

          <div className="form-grid two-columns">
            <label>
              Latitude
              <input type="number" step="any" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value, coordinatesConfirmed: false }))} required />
            </label>
            <label>
              Longitude
              <input type="number" step="any" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value, coordinatesConfirmed: false }))} required />
            </label>
          </div>

          <div className="form-grid three-columns">
            <label>
              Time style
              <select value={form.timeKind} onChange={(event) => updateField("timeKind", event.target.value)}>
                <option value="fixed">Fixed</option>
                <option value="approximate">Approximate</option>
                <option value="none">Sequence only</option>
              </select>
            </label>
            <label>
              Time
              <input type="time" value={form.timeValue} onChange={(event) => updateField("timeValue", event.target.value)} disabled={form.timeKind === "none"} />
            </label>
            <label>
              Stay (minutes)
              <input type="number" min="0" step="5" value={form.durationMinutes} onChange={(event) => updateField("durationMinutes", event.target.value)} />
            </label>
          </div>

          <div className="form-grid two-columns">
            <label>
              Opening hours
              <input value={form.openingHours} onChange={(event) => updateField("openingHours", event.target.value)} placeholder="e.g. 10:00–18:00" />
            </label>
            <label>
              Last entry
              <input type="time" value={form.lastEntryTime} onChange={(event) => updateField("lastEntryTime", event.target.value)} />
            </label>
          </div>

          <label>
            Notes
            <textarea rows="3" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Reservation, parking, food to try…" />
          </label>

          <label className="checkbox-field">
            <input type="checkbox" checked={form.reservationRequired} onChange={(event) => updateField("reservationRequired", event.target.checked)} />
            Reservation required
          </label>

          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit">{initialPlace ? "Save changes" : "Save candidate"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
