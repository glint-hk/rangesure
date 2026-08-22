// Server-only: reverse-geocodes a lat/lon to a place name, used to name the steepest
// climb on a route in driver guidance. Same ORS key/endpoint family as app/api/geocode.
import { reverseGeocode } from '@/lib/ors';

export async function POST(req) {
  const key = process.env.ORS_KEY;
  if (!key) {
    return Response.json({ error: 'Server is missing ORS_KEY.' }, { status: 500 });
  }

  let lat, lon;
  try {
    ({ lat, lon } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (lat == null || lon == null) {
    return Response.json({ error: 'lat/lon are required.' }, { status: 400 });
  }

  try {
    const result = await reverseGeocode(key, lat, lon);
    return Response.json(result);
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.error, detail: err.detail }, { status: err.status });
    }
    return Response.json({ error: err.message || 'Reverse geocoding failed.' }, { status: 500 });
  }
}
