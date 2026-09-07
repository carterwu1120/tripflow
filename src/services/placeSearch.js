const MOCK_RESULTS = [
  {
    id: "mock-american-village",
    name: "美浜アメリカンビレッジ",
    type: "shopping",
    latitude: 26.3159,
    longitude: 127.7576,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=美浜アメリカンビレッジ",
  },
  {
    id: "mock-sefa-utaki",
    name: "斎場御嶽",
    type: "attraction",
    latitude: 26.1735,
    longitude: 127.826,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=斎場御嶽",
  },
  {
    id: "mock-coffee",
    name: "Coffee Sentí",
    type: "restaurant",
    latitude: 26.2813,
    longitude: 127.7494,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=coffee+Okinawa",
  },
];

// This is the provider boundary. A future Google Places implementation only
// needs to return the same small, normalized shape used by this mock.
export async function searchPlaces(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return MOCK_RESULTS;
  }

  return MOCK_RESULTS.filter((place) =>
    `${place.name} ${place.type}`.toLocaleLowerCase().includes(normalizedQuery),
  );
}
