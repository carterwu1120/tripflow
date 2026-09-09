export function coordinatesFromMapsUrl(value) {
  let url = value;
  try {
    url = decodeURIComponent(value);
  } catch {
    // Keep malformed URLs editable and attempt to parse the original value.
  }

  const placeMatch = url.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
  const queryMatch = url.match(/[?&](?:query|q)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const viewportMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const match = placeMatch ?? queryMatch ?? viewportMatch;

  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return {
    latitude,
    longitude,
    accuracy: placeMatch || queryMatch ? "confirmed" : "approximate",
    source: "maps-url",
  };
}
