// Server-only: geocodes origin/destination (restricted to India) then requests a
// driving-hgv route with elevation from OpenRouteService. Key stays server-side
// (process.env.ORS_KEY) and is never included in the response.
import { geocodePlace } from '@/lib/ors';

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
    const [start, end] = await Promise.all([geocodePlace(key, origin), geocodePlace(key, destination)]);

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
