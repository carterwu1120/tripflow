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

function hotelMarkerIcon(selected, isTentative, locationAccuracy) {
  return L.divIcon({
    className: "hotel-marker-shell",
    html: `<span class="hotel-marker ${isTentative ? "is-tentative" : ""} ${locationAccuracy === "approximate" ? "is-approximate" : ""} ${selected ? "is-selected" : ""}">🛏</span>`,
    iconSize: selected ? [40, 40] : [34, 34],
    iconAnchor: selected ? [20, 40] : [17, 34],
    popupAnchor: [0, -32],
  });
}

function hasCoordinates(place) {
  return Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude);
}

export default function TripMap({
  dayId,
  stops,
  tentativePlaces,
  selectedPlaceId,
  onSelectPlace,
  adjustingPlaceId,
  onLocationChange,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const routeRef = useRef(null);
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

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      routeRef.current = null;
      hasFitBoundsRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    if (routeRef.current) routeRef.current.remove();

    const routeStops = stops.filter((stop) => stop.type !== "hotel");
    const hotelStops = stops.filter((stop) => stop.type === "hotel" && hasCoordinates(stop));
    const routeTentatives = tentativePlaces.filter((place) => place.type !== "hotel");
    const hotelTentatives = tentativePlaces.filter((place) => place.type === "hotel" && hasCoordinates(place));

    const mappedStops = routeStops.filter(hasCoordinates);
    const coordinates = mappedStops.map((stop) => [stop.latitude, stop.longitude]);
    const tentativeCoordinates = tentativePlaces.filter(hasCoordinates).map((place) => [place.latitude, place.longitude]);
    const tentativeSignature = tentativePlaces.map((place) => `${place.id}:${place.latitude}:${place.longitude}`).join("|");

    if (renderedDayIdRef.current !== dayId || renderedTentativesRef.current !== tentativeSignature) {
      renderedDayIdRef.current = dayId;
      renderedTentativesRef.current = tentativeSignature;
      hasFitBoundsRef.current = false;
    }

    routeRef.current = L.polyline(coordinates, {
      color: "#145c52",
      weight: 4,
      opacity: 0.72,
      dashArray: "8 9",
      lineCap: "round",
    }).addTo(map);
    routeRef.current.bringToBack();

    mappedStops.forEach((stop) => {
      const index = routeStops.findIndex(({ id }) => id === stop.id);
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

    hotelStops.forEach((stop) => {
      const marker = L.marker([stop.latitude, stop.longitude], {
        icon: hotelMarkerIcon(stop.id === selectedPlaceId, false, stop.locationAccuracy),
        riseOnHover: true,
        title: `Stay: ${stop.name}`,
        draggable: stop.id === adjustingPlaceId,
      });
      marker.bindTooltip(`Stay · ${stop.name}`, {
        direction: "top",
        offset: [0, -30],
        opacity: 0.95,
      });
      marker.on("click", () => onSelectPlace(stop.id));
      marker.on("dragend", (event) => {
        const { lat, lng } = event.target.getLatLng();
        onLocationChange(stop.id, lat, lng);
      });
      marker.addTo(markerLayer);
    });

    routeTentatives.filter(hasCoordinates).forEach((place, index) => {
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

    hotelTentatives.forEach((place) => {
      const marker = L.marker([place.latitude, place.longitude], {
        icon: hotelMarkerIcon(place.id === selectedPlaceId, true, place.locationAccuracy),
        riseOnHover: true,
        title: `Considering stay: ${place.name}`,
        draggable: place.id === adjustingPlaceId,
      });
      marker.bindTooltip(`Considering · ${place.name}`, {
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

    const hotelCoordinates = hotelStops.map((stop) => [stop.latitude, stop.longitude]);
    const visibleCoordinates = [...coordinates, ...tentativeCoordinates, ...hotelCoordinates];
    if (!hasFitBoundsRef.current && visibleCoordinates.length) {
      map.fitBounds(visibleCoordinates, { padding: [60, 60] });
      hasFitBoundsRef.current = true;
    }

    const selectedPlace = [...stops, ...tentativePlaces].find((place) => place.id === selectedPlaceId);
    if (hasCoordinates(selectedPlace)) {
      map.flyTo(
        [selectedPlace.latitude, selectedPlace.longitude],
        Math.max(map.getZoom(), 13),
        { duration: 0.65 },
      );
    }
  }, [dayId, stops, tentativePlaces, selectedPlaceId, onSelectPlace, adjustingPlaceId, onLocationChange]);

  return <div className="map-container" ref={containerRef} />;
}
