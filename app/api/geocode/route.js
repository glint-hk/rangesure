// Server-only: single-place geocoding for the Charging page's location search.
// Same ORS key/endpoint as app/api/route, factored out via lib/ors.js.
import { geocodePlace } from '@/lib/ors';

export async function POST(req) {
  const key = process.env.ORS_KEY;
  if (!key) {
    return Response.json({ error: 'Server is missing ORS_KEY.' }, { status: 500 });
  }

  let place;
  try {
    ({ place } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!place) {
    return Response.json({ error: 'A place name is required.' }, { status: 400 });
  }

  try {
    const result = await geocodePlace(key, place);
    return Response.json(result);
  } catch (err) {
    if (err && err.status) {
      return Response.json({ error: err.error, detail: err.detail }, { status: err.status });
    }
    return Response.json({ error: err.message || 'Geocoding failed.' }, { status: 500 });
  }
}
