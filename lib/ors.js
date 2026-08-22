// Shared OpenRouteService helper used by app/api/route and app/api/geocode.
export async function geocodePlace(key, text) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${key}&text=${encodeURIComponent(
    text
  )}&boundary.country=IN&size=1`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.text();
    throw { status: res.status, error: `Geocoding failed for "${text}".`, detail };
  }
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) {
    throw { status: 404, error: `No location found for "${text}".` };
  }
  const [lon, lat] = feature.geometry.coordinates;
  return { lat, lon, label: feature.properties?.label || text };
}

// Reverse geocode a lat/lon (e.g. a climb's midpoint) to the nearest place name, so
// driver guidance can name a real town instead of a raw "km 24" marker.
export async function reverseGeocode(key, lat, lon) {
  const url = `https://api.openrouteservice.org/geocode/reverse?api_key=${key}&point.lon=${lon}&point.lat=${lat}&size=1`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.text();
    throw { status: res.status, error: 'Reverse geocoding failed.', detail };
  }
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) {
    throw { status: 404, error: 'No place found near that point.' };
  }
  return { label: feature.properties?.label || feature.properties?.name || null };
}
