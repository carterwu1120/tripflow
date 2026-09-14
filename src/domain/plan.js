function normalizeLocation(place) {
  const hasCoordinates = Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
  const locationAccuracy = place.locationAccuracy
    ?? (place.coordinatesConfirmed ? "confirmed" : hasCoordinates ? "approximate" : "missing");

  return {
    ...place,
    coordinatesConfirmed: locationAccuracy === "confirmed",
    locationAccuracy,
    locationSource: place.locationSource ?? (hasCoordinates ? "imported" : null),
  };
}

export function normalizePlan(value) {
  return {
    ...value,
    trip: {
      ...value.trip,
      days: value.trip.days.map((day) => ({
        ...day,
        stops: day.stops.map((stop) => normalizeLocation({ ...stop, status: "confirmed" })),
      })),
    },
    candidates: (value.candidates ?? []).map((place) => normalizeLocation({
      ...place,
      status: "tentative",
    })),
  };
}

export function routeStopsOf(day) {
  return day.stops.filter((stop) => stop.type !== "hotel");
}

function hasCoordinates(place) {
  return Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude);
}

export function findMissingTravelLegPairs(routeStops, travelLegs = []) {
  const existingPairs = new Set(travelLegs.map((leg) => `${leg.fromStopId}:${leg.toStopId}`));

  return routeStops.slice(0, -1).flatMap((stop, index) => {
    const nextStop = routeStops[index + 1];
    if (existingPairs.has(`${stop.id}:${nextStop.id}`)) return [];
    if (!hasCoordinates(stop) || !hasCoordinates(nextStop)) return [];
    return [{
      fromStopId: stop.id,
      toStopId: nextStop.id,
      from: { latitude: stop.latitude, longitude: stop.longitude },
      to: { latitude: nextStop.latitude, longitude: nextStop.longitude },
    }];
  });
}

export function reconcileTravelLegs(stops, travelLegs = [], invalidPlaceId = null) {
  const adjacentPairs = new Set(
    stops.slice(0, -1).map((stop, index) => `${stop.id}:${stops[index + 1].id}`),
  );

  return travelLegs.filter((leg) => {
    if (invalidPlaceId && (leg.fromStopId === invalidPlaceId || leg.toStopId === invalidPlaceId)) return false;
    return adjacentPairs.has(`${leg.fromStopId}:${leg.toStopId}`);
  });
}

function reorderStops(stops, draggedStopId, targetStopId) {
  const fromIndex = stops.findIndex((stop) => stop.id === draggedStopId);
  const targetIndex = stops.findIndex((stop) => stop.id === targetStopId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return stops;
  const reordered = [...stops];
  const [movedStop] = reordered.splice(fromIndex, 1);
  reordered.splice(targetIndex, 0, movedStop);
  return reordered;
}

function updateDay(plan, dayId, updater) {
  return {
    ...plan,
    trip: {
      ...plan.trip,
      days: plan.trip.days.map((day) => day.id === dayId ? updater(day) : day),
    },
  };
}

function commit(state, present, notice) {
  return { present, past: [...state.past.slice(-9), state.present], notice };
}

export function planReducer(state, action) {
  const plan = state.present;
  switch (action.type) {
    case "replace-plan":
      return { present: normalizePlan(action.plan), past: [], notice: null };
    case "reorder": {
      const day = plan.trip.days.find(({ id }) => id === action.dayId);
      if (!day) return state;
      const stops = reorderStops(day.stops, action.draggedStopId, action.targetStopId);
      if (stops === day.stops) return state;
      const travelLegs = reconcileTravelLegs(stops, day.travelLegs);
      const droppedLegCount = day.travelLegs.length - travelLegs.length;
      const present = updateDay(plan, action.dayId, () => ({ ...day, stops, travelLegs }));
      const notice = droppedLegCount > 0
        ? `Itinerary reordered · ${droppedLegCount} travel time${droppedLegCount > 1 ? "s" : ""} need updating`
        : "Itinerary reordered";
      return commit(state, present, notice);
    }
    case "remove-stop": {
      const removed = plan.trip.days.flatMap((day) => day.stops).find((place) => place.id === action.placeId);
      const present = updateDay(plan, action.dayId, (day) => {
        const stops = day.stops.filter((stop) => stop.id !== action.placeId);
        return { ...day, stops, travelLegs: reconcileTravelLegs(stops, day.travelLegs) };
      });
      return commit(state, present, `${removed?.name ?? "Place"} deleted`);
    }
    case "remove-tentative": {
      const removed = plan.candidates.find((place) => place.id === action.placeId);
      return commit(state, {
        ...plan,
        candidates: plan.candidates.filter((place) => place.id !== action.placeId),
      }, `${removed?.name ?? "Place"} deleted`);
    }
    case "save-place": {
      const place = action.place;
      const candidates = plan.candidates.filter(({ id }) => id !== place.id);
      const days = plan.trip.days.map((day) => {
        const originalIndex = day.stops.findIndex(({ id }) => id === place.id);
        const stops = day.stops.filter(({ id }) => id !== place.id);
        let nextStops = stops;
        if (place.status === "confirmed" && day.id === action.dayId) {
          const { suggestedDayId: _ignored, ...confirmedPlace } = place;
          nextStops = [...stops];
          nextStops.splice(originalIndex >= 0 ? originalIndex : nextStops.length, 0, {
            ...confirmedPlace,
            status: "confirmed",
          });
        }
        return {
          ...day,
          stops: nextStops,
          travelLegs: reconcileTravelLegs(nextStops, day.travelLegs, place.id),
        };
      });
      const nextCandidates = place.status === "tentative"
        ? [...candidates, { ...place, suggestedDayId: action.dayId, status: "tentative" }]
        : candidates;
      return commit(state, {
        ...plan,
        trip: { ...plan.trip, days },
        candidates: nextCandidates,
      }, place.status === "confirmed" ? `${place.name} added to itinerary` : `${place.name} saved as tentative`);
    }
    case "update-location": {
      let updatedName = "Place";
      const updatePlace = (place) => {
        if (place.id !== action.placeId) return place;
        updatedName = place.name;
        return {
          ...place,
          latitude: action.latitude,
          longitude: action.longitude,
          coordinatesConfirmed: true,
          locationAccuracy: "confirmed",
          locationSource: "manual",
        };
      };
      const days = plan.trip.days.map((day) => {
        if (!day.stops.some((place) => place.id === action.placeId)) return day;
        return {
          ...day,
          stops: day.stops.map(updatePlace),
          travelLegs: reconcileTravelLegs(day.stops, day.travelLegs, action.placeId),
        };
      });
      const candidates = plan.candidates.map(updatePlace);
      return commit(state, {
        ...plan,
        trip: { ...plan.trip, days },
        candidates,
      }, `${updatedName} location confirmed`);
    }
    case "set-travel-leg": {
      const present = updateDay(plan, action.dayId, (day) => ({
        ...day,
        travelLegs: [
          ...day.travelLegs.filter((leg) => !(leg.fromStopId === action.fromStopId && leg.toStopId === action.toStopId)),
          { fromStopId: action.fromStopId, toStopId: action.toStopId, mode: action.mode, minutes: action.minutes },
        ],
      }));
      return { ...state, present };
    }
    case "undo": {
      if (!state.past.length) return state;
      return {
        present: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
        notice: "Last change undone",
      };
    }
    case "clear-notice":
      return { ...state, notice: null };
    default:
      return state;
  }
}
