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

function inferCheckOutDate(days, checkInDayId) {
  const index = days.findIndex((day) => day.id === checkInDayId);
  if (index < 0) return days[days.length - 1]?.date ?? null;
  return days[index + 1]?.date ?? days[index].date;
}

function migrateLegacyStays(trip, candidates) {
  const fromStops = trip.days.flatMap((day) =>
    day.stops
      .filter((stop) => stop.type === "hotel")
      .map((stop) => ({
        ...stop,
        status: "confirmed",
        checkInDate: day.date,
        checkOutDate: inferCheckOutDate(trip.days, day.id),
        checkInTime: stop.time?.value ?? null,
      })),
  );

  const fromCandidates = candidates
    .filter((candidate) => candidate.type === "hotel")
    .map((candidate) => ({
      ...candidate,
      status: "tentative",
      checkInDate: trip.days.find((day) => day.id === candidate.suggestedDayId)?.date ?? null,
      checkOutDate: inferCheckOutDate(trip.days, candidate.suggestedDayId),
      checkInTime: candidate.time?.value ?? null,
    }))
    .filter((stay) => stay.checkInDate);

  return [...fromStops, ...fromCandidates];
}

export function normalizePlan(value) {
  const days = value.trip.days.map((day) => ({
    ...day,
    stops: day.stops
      .filter((stop) => stop.type !== "hotel")
      .map((stop) => normalizeLocation({ ...stop, status: "confirmed" })),
  }));
  const candidates = (value.candidates ?? [])
    .filter((place) => place.type !== "hotel")
    .map((place) => normalizeLocation({ ...place, status: "tentative" }));
  const stays = [...(value.stays ?? []), ...migrateLegacyStays(value.trip, value.candidates ?? [])]
    .map((stay) => normalizeLocation({ ...stay, type: "hotel" }));

  return {
    ...value,
    trip: { ...value.trip, days },
    candidates,
    stays,
    tips: value.tips ?? [],
  };
}

export function staysForDay(stays, dayDate) {
  return stays.filter((stay) => stay.checkInDate <= dayDate && dayDate <= stay.checkOutDate);
}

export function routeStopsOf(day) {
  return day.stops;
}

export function stopHasOpeningHoursConflict(stop, dayDate) {
  if (!stop.openingHoursPeriods?.length || !stop.time?.value || !dayDate) return false;

  const alwaysOpen = stop.openingHoursPeriods.length === 1
    && stop.openingHoursPeriods[0].open?.day === 0 && stop.openingHoursPeriods[0].open?.hour === 0
    && stop.openingHoursPeriods[0].open?.minute === 0 && !stop.openingHoursPeriods[0].close;
  if (alwaysOpen) return false;

  const targetDay = new Date(`${dayDate}T00:00:00`).getDay();
  const [hour, minute] = stop.time.value.split(":").map(Number);
  const arrivalMinutes = hour * 60 + minute;

  const todaysPeriods = stop.openingHoursPeriods.filter((period) => period.open?.day === targetDay);
  if (!todaysPeriods.length) return true;

  return !todaysPeriods.some((period) => {
    const openMinutes = period.open.hour * 60 + period.open.minute;
    if (!period.close) return arrivalMinutes >= openMinutes;
    let closeMinutes = period.close.hour * 60 + period.close.minute;
    if (period.close.day !== period.open.day) closeMinutes += 24 * 60;
    return arrivalMinutes >= openMinutes && arrivalMinutes <= closeMinutes;
  });
}

export function summarizeDay(day) {
  const routeStops = routeStopsOf(day);
  const totalMinutes = day.travelLegs.reduce((sum, leg) => sum + (Number.isFinite(leg.minutes) ? leg.minutes : 0), 0);
  const expectedLegCount = Math.max(routeStops.length - 1, 0);
  return {
    stopCount: routeStops.length,
    totalMinutes,
    isPartial: day.travelLegs.length < expectedLegCount,
    firstTime: routeStops[0]?.time?.value ?? null,
    lastTime: routeStops[routeStops.length - 1]?.time?.value ?? null,
  };
}

function hasCoordinates(place) {
  return Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude);
}

export function findMissingTravelLegPairs(routeStops, travelLegs = []) {
  const legByPair = new Map(travelLegs.map((leg) => [`${leg.fromStopId}:${leg.toStopId}`, leg]));

  return routeStops.slice(0, -1).flatMap((stop, index) => {
    const nextStop = routeStops[index + 1];
    const existingLeg = legByPair.get(`${stop.id}:${nextStop.id}`);
    if (existingLeg?.polyline) return [];
    if (existingLeg?.mode === "walking") return [];
    if (!hasCoordinates(stop) || !hasCoordinates(nextStop)) return [];
    return [{
      fromStopId: stop.id,
      toStopId: nextStop.id,
      from: { latitude: stop.latitude, longitude: stop.longitude },
      to: { latitude: nextStop.latitude, longitude: nextStop.longitude },
      existingLeg,
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
      const stays = plan.stays.map(updatePlace);
      return commit(state, {
        ...plan,
        trip: { ...plan.trip, days },
        candidates,
        stays,
      }, `${updatedName} location confirmed`);
    }
    case "save-stay": {
      const stay = action.stay;
      const stays = [...plan.stays.filter(({ id }) => id !== stay.id), stay];
      return commit(state, { ...plan, stays },
        stay.status === "confirmed" ? `${stay.name} saved` : `${stay.name} saved as tentative`);
    }
    case "remove-stay": {
      const removed = plan.stays.find((stay) => stay.id === action.stayId);
      return commit(state, {
        ...plan,
        stays: plan.stays.filter((stay) => stay.id !== action.stayId),
      }, `${removed?.name ?? "Stay"} deleted`);
    }
    case "add-tip": {
      return commit(state, { ...plan, tips: [...plan.tips, action.tip] }, "Tip saved");
    }
    case "remove-tip": {
      return commit(state, {
        ...plan,
        tips: plan.tips.filter((tip) => tip.id !== action.tipId),
      }, "Tip deleted");
    }
    case "set-travel-leg": {
      const present = updateDay(plan, action.dayId, (day) => ({
        ...day,
        travelLegs: [
          ...day.travelLegs.filter((leg) => !(leg.fromStopId === action.fromStopId && leg.toStopId === action.toStopId)),
          { fromStopId: action.fromStopId, toStopId: action.toStopId, mode: action.mode, minutes: action.minutes, polyline: action.polyline ?? null },
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
