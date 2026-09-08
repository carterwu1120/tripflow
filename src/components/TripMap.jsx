import { useEffect, useRef } from "react";
import L from "leaflet";

function markerIcon(order, selected) {
  return L.divIcon({
    className: "trip-marker-shell",
    html: `<span class="trip-marker ${selected ? "is-selected" : ""}"><b>${order}</b></span>`,
    iconSize: selected ? [42, 42] : [34, 34],
    iconAnchor: selected ? [21, 42] : [17, 34],
    popupAnchor: [0, -38],
  });
}

function hotelMarkerIcon(order) {
  return L.divIcon({
    className: "hotel-marker-shell",
    html: `<span class="hotel-marker"><b>H${order}</b></span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -34],
  });
}

function hasCoordinates(place) {
  return Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude);
}

export default function TripMap({ dayId, stops, hotelCandidates, selectedStopId, onSelectStop }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const routeRef = useRef(null);
  const hasFitBoundsRef = useRef(false);
  const renderedDayIdRef = useRef(null);
  const renderedHotelsRef = useRef("");

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

    const mappedStops = stops.filter(hasCoordinates);
    const coordinates = mappedStops.map((stop) => [stop.latitude, stop.longitude]);
    const hotelCoordinates = hotelCandidates.filter(hasCoordinates).map((hotel) => [hotel.latitude, hotel.longitude]);
    const hotelSignature = hotelCandidates.map((hotel) => `${hotel.id}:${hotel.latitude}:${hotel.longitude}`).join("|");

    if (renderedDayIdRef.current !== dayId || renderedHotelsRef.current !== hotelSignature) {
      renderedDayIdRef.current = dayId;
      renderedHotelsRef.current = hotelSignature;
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
      const index = stops.findIndex(({ id }) => id === stop.id);
      const marker = L.marker([stop.latitude, stop.longitude], {
        icon: markerIcon(index + 1, stop.id === selectedStopId),
        riseOnHover: true,
        title: `${index + 1}. ${stop.name}`,
      });

      marker.bindTooltip(stop.name, {
        direction: "top",
        offset: [0, -28],
        opacity: 0.95,
      });
      marker.on("click", () => onSelectStop(stop.id));
      marker.addTo(markerLayer);
    });

    hotelCandidates.filter(hasCoordinates).forEach((hotel, index) => {
      const marker = L.marker([hotel.latitude, hotel.longitude], {
        icon: hotelMarkerIcon(index + 1),
        riseOnHover: true,
        title: `Hotel candidate ${index + 1}: ${hotel.name}`,
      });
      marker.bindTooltip(`H${index + 1} · ${hotel.name}`, {
        direction: "top",
        offset: [0, -30],
        opacity: 0.95,
      });
      marker.addTo(markerLayer);
    });

    const visibleCoordinates = [...coordinates, ...hotelCoordinates];
    if (!hasFitBoundsRef.current && visibleCoordinates.length) {
      map.fitBounds(visibleCoordinates, { padding: [60, 60] });
      hasFitBoundsRef.current = true;
    }

    const selectedStop = stops.find((stop) => stop.id === selectedStopId);
    if (hasCoordinates(selectedStop)) {
      map.flyTo(
        [selectedStop.latitude, selectedStop.longitude],
        Math.max(map.getZoom(), 13),
        { duration: 0.65 },
      );
    }
  }, [dayId, stops, hotelCandidates, selectedStopId, onSelectStop]);

  return <div className="map-container" ref={containerRef} />;
}
