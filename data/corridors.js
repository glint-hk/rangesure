// Synthetic per-corridor completed-trip counts — stands in for real Fleet Edge
// corridor history (the data flywheel behind the Route Guarantee: more trips on a
// corridor -> tighter uncertainty -> a cheaper, more confident committed price).
// A few named corridors are seeded with real-looking volumes; anything else falls back
// to a modest default so new/rare corridors still price (just with a wider buffer).
const CORRIDOR_TRIPS = {
  'mumbai-pune': 1500,
  'delhi-jaipur': 900,
  'chennai-bengaluru': 2200,
};

const DEFAULT_CORRIDOR_TRIPS = 300;

// Corridors are quoted by their first place-name component, so a full autocomplete
// label ("Mumbai, Maharashtra, India") and a plain preset string ("Mumbai") key the
// same corridor.
function normalizePlace(place) {
  return (place || '').split(',')[0].trim().toLowerCase();
}

function titleCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Corridors are bidirectional — "Mumbai-Pune" and "Pune-Mumbai" are the same lane.
export function getCorridorTrips(start, end) {
  const s = normalizePlace(start);
  const e = normalizePlace(end);
  if (!s || !e) return DEFAULT_CORRIDOR_TRIPS;
  return CORRIDOR_TRIPS[`${s}-${e}`] ?? CORRIDOR_TRIPS[`${e}-${s}`] ?? DEFAULT_CORRIDOR_TRIPS;
}

export function getCorridorKey(start, end) {
  const s = normalizePlace(start);
  const e = normalizePlace(end);
  if (!s || !e) return '';
  return `${titleCase(s)} → ${titleCase(e)}`;
}
