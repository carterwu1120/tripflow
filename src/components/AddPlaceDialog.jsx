import { useEffect, useRef, useState } from "react";
import { coordinatesFromMapsUrl } from "../domain/location";
import { resolvePlace } from "../services/placeResolver";

const TYPE_LABELS = {
  hotel: "Hotel",
  restaurant: "Food",
  attraction: "Place",
  shopping: "Shopping",
  other: "Place",
};

export default function AddPlaceDialog({ initialPlace, presetType = "other", presetStatus = "confirmed", dayLabel, onClose, onSavePlace }) {
  const [type, setType] = useState(initialPlace?.type ?? presetType);
  const [status, setStatus] = useState(initialPlace?.status ?? presetStatus);
  const dialogRef = useRef(null);
  const [name, setName] = useState(initialPlace?.name ?? "");
  const [timeValue, setTimeValue] = useState(initialPlace?.time?.value ?? "");
  const [notes, setNotes] = useState(initialPlace?.notes ?? "");
  const [mapsUrl, setMapsUrl] = useState(initialPlace?.googleMapsUrl ?? "");
  const [coordinates, setCoordinates] = useState(() => {
    if (Number.isFinite(initialPlace?.latitude) && Number.isFinite(initialPlace?.longitude)) {
      return {
        latitude: initialPlace.latitude,
        longitude: initialPlace.longitude,
        accuracy: initialPlace.locationAccuracy ?? (initialPlace.coordinatesConfirmed ? "confirmed" : "approximate"),
        source: initialPlace.locationSource ?? "imported",
      };
    }
    return null;
  });
  const [locationMessage, setLocationMessage] = useState("");
  const [resolveStatus, setResolveStatus] = useState("idle");
  const [resolveError, setResolveError] = useState("");
  const [resolvedDetails, setResolvedDetails] = useState({
    googlePlaceId: initialPlace?.googlePlaceId ?? null,
    formattedAddress: initialPlace?.formattedAddress ?? null,
  });

  useEffect(() => {
    const previousFocus = document.activeElement;
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll('button, input, select, [href], [tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  function handleMapsUrl(value) {
    setMapsUrl(value);
    setResolveStatus("idle");
    setResolveError("");
    setResolvedDetails({ googlePlaceId: null, formattedAddress: null });
    if (!value.trim()) {
      setCoordinates(null);
      setLocationMessage("");
      return;
    }

    const parsed = coordinatesFromMapsUrl(value.trim());
    setCoordinates(parsed);
    setLocationMessage(parsed
      ? parsed.accuracy === "confirmed"
        ? "Exact place coordinates found — it will appear on the map."
        : "Approximate map-center coordinates found — verify the pin before relying on it."
      : "Link saved. This short link does not expose a map location yet.");
  }

  async function handleResolveLocation() {
    setResolveStatus("loading");
    setResolveError("");
    try {
      const result = await resolvePlace({ name: name.trim(), url: mapsUrl.trim() });
      setCoordinates({
        latitude: result.latitude,
        longitude: result.longitude,
        accuracy: "confirmed",
        source: result.source,
      });
      setResolvedDetails({
        googlePlaceId: result.googlePlaceId ?? null,
        formattedAddress: result.formattedAddress ?? null,
      });
      if (!name.trim() && result.name) setName(result.name);
      setLocationMessage(result.formattedAddress
        ? `Exact location found: ${result.formattedAddress}`
        : "Exact location found.");
      setResolveStatus("success");
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : "Unable to resolve this place.");
      setResolveStatus("error");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const hasTime = Boolean(timeValue);

    onSavePlace({
      ...initialPlace,
      id: initialPlace?.id ?? `candidate-${Date.now()}`,
      name: name.trim(),
      type,
      status,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      time: {
        kind: hasTime ? initialPlace?.time?.kind === "fixed" ? "fixed" : "approximate" : "none",
        value: hasTime ? timeValue : null,
      },
      durationMinutes: initialPlace?.durationMinutes ?? null,
      openingHours: initialPlace?.openingHours ?? null,
      lastEntryTime: initialPlace?.lastEntryTime ?? null,
      notes: notes.trim(),
      reservationRequired: initialPlace?.reservationRequired ?? false,
      coordinatesConfirmed: coordinates?.accuracy === "confirmed",
      locationAccuracy: coordinates?.accuracy ?? "missing",
      locationSource: coordinates?.source ?? null,
      googlePlaceId: resolvedDetails.googlePlaceId,
      formattedAddress: resolvedDetails.formattedAddress,
      googleMapsUrl: mapsUrl.trim()
        || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} Okinawa`)}`,
    });
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
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
            <p className="dialog-context">{dayLabel}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </div>

        <form className="quick-place-form" onSubmit={handleSubmit}>
          <div className="quick-choice-row">
            <label>
              Type
              <select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="other">Place</option>
                <option value="attraction">Attraction</option>
                <option value="restaurant">Food</option>
                <option value="hotel">Hotel</option>
                <option value="shopping">Shopping</option>
                <option value="rest-stop">Rest stop</option>
                <option value="rental-car">Rental car</option>
                <option value="airport">Airport</option>
              </select>
            </label>
            <fieldset className="status-choice">
              <legend>Status</legend>
              <div>
                <button aria-pressed={status === "confirmed"} className={status === "confirmed" ? "active" : ""} type="button" onClick={() => setStatus("confirmed")}>Confirmed</button>
                <button aria-pressed={status === "tentative"} className={status === "tentative" ? "active tentative" : ""} type="button" onClick={() => setStatus("tentative")}>Tentative</button>
              </div>
            </fieldset>
          </div>
          <p className="status-explanation">
            {status === "confirmed" ? "Included in the itinerary route." : "Shown on the map for comparison, but not added to the route."}
          </p>

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
          {mapsUrl.trim() && coordinates?.accuracy !== "confirmed" && (
            <div className="resolve-location-row">
              <button
                className="secondary-button"
                type="button"
                disabled={resolveStatus === "loading"}
                onClick={handleResolveLocation}
              >
                {resolveStatus === "loading" ? "Finding location…" : "Find exact location"}
              </button>
              <small>The link is sent securely to the configured location resolver.</small>
            </div>
          )}
          {resolveError && <p className="field-error" role="alert">{resolveError}</p>}

          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit">Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}
