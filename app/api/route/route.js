// Server-only: geocodes origin/destination (restricted to India) then requests a
// driving-hgv route with elevation from OpenRouteService. Key stays server-side
// (process.env.ORS_KEY) and is never included in the response.
async function geocode(key, text) {
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

export async function POST(req) {
  const key = process.env.ORS_KEY;
  if (!key) {
    return Response.json({ error: 'Server is missing ORS_KEY.' }, { status: 500 });
  }

  let origin, destination;
  try {
    ({ origin, destination } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!origin || !destination) {
    return Response.json({ error: 'Origin and destination are required.' }, { status: 400 });
  }

  try {
    const [start, end] = await Promise.all([geocode(key, origin), geocode(key, destination)]);

    const dirRes = await fetch('https://api.openrouteservice.org/v2/directions/driving-hgv/geojson', {
      method: 'POST',
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [start.lon, start.lat],
          [end.lon, end.lat],
        ],
        elevation: true,
        instructions: false,
      }),
    });

    if (!dirRes.ok) {
      const detail = await dirRes.text();
      return Response.json({ error: 'Routing failed.', detail }, { status: dirRes.status });
    }

    const dirData = await dirRes.json();
    const feature = dirData.features?.[0];
    if (!feature) {
      return Response.json({ error: 'No route found between those two points.' }, { status: 502 });
    }

    return Response.json({
      start,
      end,
      distance_m: feature.properties.summary.distance,
      duration_s: feature.properties.summary.duration,
      coordinates: feature.geometry.coordinates, // [lon, lat, elevation][]
    });
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.error, detail: err.detail }, { status: err.status });
    }
    return Response.json({ error: err.message || 'Route lookup failed.' }, { status: 500 });
  }
}
