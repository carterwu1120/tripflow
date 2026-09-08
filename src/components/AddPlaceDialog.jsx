import { useEffect, useState } from "react";

const TYPE_LABELS = {
  hotel: "Hotel",
  restaurant: "Food",
  attraction: "Place",
  shopping: "Shopping",
  other: "Place",
};

function coordinatesFromMapsUrl(value) {
  let url = value;
  try {
    url = decodeURIComponent(value);
  } catch {
    // Keep the original value when it contains malformed escapes.
  }

  const match = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    ?? url.match(/[?&](?:query|q)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    ?? url.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);

  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export default function AddPlaceDialog({ initialPlace, presetType = "other", onClose, onSavePlace }) {
  const [name, setName] = useState(initialPlace?.name ?? "");
  const [timeValue, setTimeValue] = useState(initialPlace?.time?.value ?? "");
  const [notes, setNotes] = useState(initialPlace?.notes ?? "");
  const [mapsUrl, setMapsUrl] = useState(initialPlace?.googleMapsUrl ?? "");
  const [coordinates, setCoordinates] = useState(() => {
    if (Number.isFinite(initialPlace?.latitude) && Number.isFinite(initialPlace?.longitude)) {
      return { latitude: initialPlace.latitude, longitude: initialPlace.longitude };
    }
    return null;
  });
  const [locationMessage, setLocationMessage] = useState("");
  const type = initialPlace?.type ?? presetType;

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function handleMapsUrl(value) {
    setMapsUrl(value);
    if (!value.trim()) {
      setCoordinates(null);
      setLocationMessage("");
      return;
    }

    const parsed = coordinatesFromMapsUrl(value.trim());
    setCoordinates(parsed);
    setLocationMessage(parsed
      ? "Location found — it will appear on the map."
      : "Link saved. This short link does not expose a map location yet.");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const hasTime = Boolean(timeValue);

    onSavePlace({
      ...initialPlace,
      id: initialPlace?.id ?? `candidate-${Date.now()}`,
      name: name.trim(),
      type,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      time: {
        kind: hasTime ? initialPlace?.time?.kind === "fixed" ? "fixed" : "approximate" : "none",
        value: hasTime ? timeValue : null,
      },
      durationMinutes: initialPlace?.durationMinutes ?? 60,
      openingHours: initialPlace?.openingHours ?? null,
      lastEntryTime: initialPlace?.lastEntryTime ?? null,
      notes: notes.trim(),
      reservationRequired: initialPlace?.reservationRequired ?? false,
      coordinatesConfirmed: mapsUrl === initialPlace?.googleMapsUrl
        ? initialPlace?.coordinatesConfirmed ?? false
        : Boolean(coordinates),
      googleMapsUrl: mapsUrl.trim()
        || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} Okinawa`)}`,
      status: initialPlace?.status ?? "candidate",
    });
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="place-dialog quick-place-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">{TYPE_LABELS[type] ?? "Place"}</p>
            <h2 id="place-editor-title">{initialPlace ? "Edit" : "Add"} {type === "hotel" ? "hotel" : "place"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </div>

        <form className="quick-place-form" onSubmit={handleSubmit}>
          <label>
            Place
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={type === "hotel" ? "Hotel name" : "Where do you want to go?"} autoFocus required />
          </label>

          <label>
            Around what time? <span>Optional</span>
            <input type="time" value={timeValue} onChange={(event) => setTimeValue(event.target.value)} />
          </label>

          <label>
            Note <span>Optional · one line</span>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Parking, food to try, reservation…" />
          </label>

          <label className="maps-link-field">
            Google Maps link <span>Optional</span>
            <input type="url" value={mapsUrl} onChange={(event) => handleMapsUrl(event.target.value)} placeholder="Paste a Google Maps link" />
            {locationMessage && <small className={coordinates ? "location-found" : ""}>{locationMessage}</small>}
          </label>

          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit">Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}
