// Server-side: Open Charge Map. Key stays server-side (process.env.OCM_KEY).
export async function POST(req) {
  try {
    const { lat, lon, distance_km } = await req.json();
    if (lat == null || lon == null) {
      return Response.json({ error: 'lat/lon are required.' }, { status: 400 });
    }

    const key = process.env.OCM_KEY;
    const radius = Math.max(25, Math.min(distance_km || 50, 100));
    const url = `https://api.openchargemap.io/v3/poi?output=json&latitude=${lat}&longitude=${lon}&distance=${radius}&distanceunit=KM&maxresults=8${
      key ? `&key=${key}` : ''
    }`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Charging station lookup failed.');
    const data = await res.json();

    const stations = (Array.isArray(data) ? data : [])
      .map((poi) => ({
        id: poi.ID,
        title: poi.AddressInfo?.Title || 'Charging station',
        lat: poi.AddressInfo?.Latitude,
        lon: poi.AddressInfo?.Longitude,
      }))
      .filter((s) => s.lat != null && s.lon != null);

    return Response.json({ stations });
  } catch (err) {
    return Response.json({ error: err.message || 'Charging station lookup failed.' }, { status: 500 });
  }
}
