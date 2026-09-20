import { useEffect, useRef } from "react";
import L from "leaflet";

function markerIcon(order, selected, locationAccuracy) {
  return L.divIcon({
    className: "trip-marker-shell",
    html: `<span class="trip-marker ${locationAccuracy === "approximate" ? "is-approximate" : ""} ${selected ? "is-selected" : ""}"><b>${order}</b></span>`,
    iconSize: selected ? [42, 42] : [34, 34],
    iconAnchor: selected ? [21, 42] : [17, 34],
    popupAnchor: [0, -38],
  });
}

function tentativeMarkerIcon(order, selected, locationAccuracy) {
  return L.divIcon({
    className: "tentative-marker-shell",
    html: `<span class="tentative-marker ${locationAccuracy === "approximate" ? "is-approximate" : ""} ${selected ? "is-selected" : ""}"><b>T${order}</b></span>`,
    iconSize: selected ? [44, 44] : [38, 38],
    iconAnchor: selected ? [22, 44] : [19, 38],
    popupAnchor: [0, -34],
  });
}

// Lucide "hotel" icon (ISC license, https://lucide.dev) — free to use, no attribution required.
const HOTEL_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 22v-6.57" /><path d="M12 11h.01" /><path d="M12 7h.01" /><path d="M14 15.43V22" /><path d="M15 16a5 5 0 0 0-6 0" /><path d="M16 11h.01" /><path d="M16 7h.01" /><path d="M8 11h.01" /><path d="M8 7h.01" /><rect x="4" y="2" width="16" height="20" rx="2" /></svg>`;

function hotelMarkerIcon(selected, isTentative, locationAccuracy) {
  return L.divIcon({
    className: "hotel-marker-shell",
    html: `<span class="hotel-marker ${isTentative ? "is-tentative" : ""} ${locationAccuracy === "approximate" ? "is-approximate" : ""} ${selected ? "is-selected" : ""}">${HOTEL_ICON_SVG}</span>`,
    iconSize: selected ? [40, 40] : [34, 34],
    iconAnchor: selected ? [20, 40] : [17, 34],
    popupAnchor: [0, -32],
  });
}

function hasCoordinates(place) {
  return Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude);
}

// Decodes Google's encoded polyline format (precision 5) into [lat, lng] pairs.
function decodePolyline(encoded) {
  if (!encoded) return [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const points = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export default function TripMap({
  dayId,
  stops,
  travelLegs,
  tentativePlaces,
  stays,
  selectedPlaceId,
  onSelectPlace,
  adjustingPlaceId,
  onLocationChange,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const hasFitBoundsRef = useRef(false);
  const renderedDayIdRef = useRef(null);
  const renderedTentativesRef = useRef("");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([26.47, 127.88], 9);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    routeLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      routeLayerRef.current = null;
      hasFitBoundsRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    routeLayerRef.current?.clearLayers();

    const mappedStops = stops.filter(hasCoordinates);
    const coordinates = mappedStops.map((stop) => [stop.latitude, stop.longitude]);
    const tentativeCoordinates = tentativePlaces.filter(hasCoordinates).map((place) => [place.latitude, place.longitude]);
    const tentativeSignature = tentativePlaces.map((place) => `${place.id}:${place.latitude}:${place.longitude}`).join("|");

    if (renderedDayIdRef.current !== dayId || renderedTentativesRef.current !== tentativeSignature) {
      renderedDayIdRef.current = dayId;
      renderedTentativesRef.current = tentativeSignature;
      hasFitBoundsRef.current = false;
    }

    const legByPair = new Map((travelLegs ?? []).map((leg) => [`${leg.fromStopId}:${leg.toStopId}`, leg]));

    mappedStops.slice(0, -1).forEach((stop, index) => {
      const nextStop = mappedStops[index + 1];
      const leg = legByPair.get(`${stop.id}:${nextStop.id}`);
      const drivingPath = leg?.polyline ? decodePolyline(leg.polyline) : null;

      L.polyline(drivingPath ?? [[stop.latitude, stop.longitude], [nextStop.latitude, nextStop.longitude]], {
        color: "#145c52",
        weight: 4,
        opacity: 0.72,
        dashArray: drivingPath ? null : "8 9",
        lineCap: "round",
      }).addTo(routeLayerRef.current);
    });

    mappedStops.forEach((stop) => {
      const index = stops.findIndex(({ id }) => id === stop.id);
      const marker = L.marker([stop.latitude, stop.longitude], {
        icon: markerIcon(index + 1, stop.id === selectedPlaceId, stop.locationAccuracy),
        riseOnHover: true,
        title: `${index + 1}. ${stop.name}`,
        draggable: stop.id === adjustingPlaceId,
      });

      marker.bindTooltip(stop.name, {
        direction: "top",
        offset: [0, -28],
        opacity: 0.95,
      });
      marker.on("click", () => onSelectPlace(stop.id));
      marker.on("dragend", (event) => {
        const { lat, lng } = event.target.getLatLng();
        onLocationChange(stop.id, lat, lng);
      });
      marker.addTo(markerLayer);
    });

    stays.filter((stay) => stay.status === "confirmed" && hasCoordinates(stay)).forEach((stay) => {
      const marker = L.marker([stay.latitude, stay.longitude], {
        icon: hotelMarkerIcon(stay.id === selectedPlaceId, false, stay.locationAccuracy),
        riseOnHover: true,
        title: `Stay: ${stay.name}`,
        draggable: stay.id === adjustingPlaceId,
      });
      marker.bindTooltip(`Stay · ${stay.name}`, {
        direction: "top",
        offset: [0, -30],
        opacity: 0.95,
      });
      marker.on("click", () => onSelectPlace(stay.id));
      marker.on("dragend", (event) => {
        const { lat, lng } = event.target.getLatLng();
        onLocationChange(stay.id, lat, lng);
      });
      marker.addTo(markerLayer);
    });

    tentativePlaces.filter(hasCoordinates).forEach((place, index) => {
      const marker = L.marker([place.latitude, place.longitude], {
        icon: tentativeMarkerIcon(index + 1, place.id === selectedPlaceId, place.locationAccuracy),
        riseOnHover: true,
        title: `Tentative ${index + 1}: ${place.name}`,
        draggable: place.id === adjustingPlaceId,
      });
      marker.bindTooltip(`T${index + 1} · ${place.name}`, {
        direction: "top",
        offset: [0, -30],
        opacity: 0.95,
      });
      marker.on("click", () => onSelectPlace(place.id));
      marker.on("dragend", (event) => {
        const { lat, lng } = event.target.getLatLng();
        onLocationChange(place.id, lat, lng);
      });
      marker.addTo(markerLayer);
    });

    stays.filter((stay) => stay.status === "tentative" && hasCoordinates(stay)).forEach((stay) => {
      const marker = L.marker([stay.latitude, stay.longitude], {
        icon: hotelMarkerIcon(stay.id === selectedPlaceId, true, stay.locationAccuracy),
        riseOnHover: true,
        title: `Considering stay: ${stay.name}`,
        draggable: stay.id === adjustingPlaceId,
      });
      marker.bindTooltip(`Considering · ${stay.name}`, {
        direction: "top",
        offset: [0, -30],
        opacity: 0.95,
      });
      marker.on("click", () => onSelectPlace(stay.id));
      marker.on("dragend", (event) => {
        const { lat, lng } = event.target.getLatLng();
        onLocationChange(stay.id, lat, lng);
      });
      marker.addTo(markerLayer);
    });

    const stayCoordinates = stays.filter(hasCoordinates).map((stay) => [stay.latitude, stay.longitude]);
    const visibleCoordinates = [...coordinates, ...tentativeCoordinates, ...stayCoordinates];
    if (!hasFitBoundsRef.current && visibleCoordinates.length) {
      map.fitBounds(visibleCoordinates, { padding: [60, 60] });
      hasFitBoundsRef.current = true;
    }

    const selectedPlace = [...stops, ...tentativePlaces, ...stays].find((place) => place.id === selectedPlaceId);
    if (hasCoordinates(selectedPlace)) {
      map.flyTo(
        [selectedPlace.latitude, selectedPlace.longitude],
        Math.max(map.getZoom(), 13),
        { duration: 0.65 },
      );
    }
  }, [dayId, stops, travelLegs, tentativePlaces, stays, selectedPlaceId, onSelectPlace, adjustingPlaceId, onLocationChange]);

  return <div className="map-container" ref={containerRef} />;
}
