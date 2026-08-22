// Server-only: place-name suggestions for the origin/destination/city search-as-you-
// type inputs. Same ORS key/endpoint family as app/api/geocode, via lib/ors.js.
import { autocompletePlaces } from '@/lib/ors';

export async function POST(req) {
  const key = process.env.ORS_KEY;
  if (!key) {
    return Response.json({ error: 'Server is missing ORS_KEY.' }, { status: 500 });
  }

  let query;
  try {
    ({ query } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!query || query.trim().length < 2) {
    return Response.json({ suggestions: [] });
  }

  try {
    const suggestions = await autocompletePlaces(key, query.trim());
    return Response.json({ suggestions });
  } catch (err) {
    // Suggestions are a nice-to-have — fail soft with an empty list rather than
    // surfacing an error banner over a search box.
    console.error('Autocomplete error:', err);
    return Response.json({ suggestions: [] });
  }
}
