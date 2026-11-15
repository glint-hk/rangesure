// Server-side: Open Charge Map. Key stays server-side (process.env.OCM_KEY).
// Two modes:
//  - { lat, lon, distance_km }   one circle (Charging page: "chargers near this city")
//  - { points: [{lat, lon}], radius_km }   a corridor search along a route: one query per
//    point, merged and de-duplicated, so chargers along the WHOLE route are found instead
//    of only those near its midpoint.
const MAX_POINTS = 10;

// Current type 30 = DC in OCM's reference data.
const DC_CURRENT_TYPE_ID = 30;

// OCM status type IDs that mean "you can't charge here": 30 temporarily unavailable,
// 100 not operational, 150 planned, 200/210 removed. (compact=true returns IDs, not objects.)
const UNAVAILABLE_STATUS_IDS = new Set([30, 100, 150, 200, 210]);

function isOperational(poi) {
  if (poi.StatusType && typeof poi.StatusType.IsOperational === 'boolean') return poi.StatusType.IsOperational;
  if (poi.StatusTypeID != null) return !UNAVAILABLE_STATUS_IDS.has(poi.StatusTypeID);
  return null;
}

function toStation(poi) {
  const connections = Array.isArray(poi.Connections) ? poi.Connections : [];
  const powers = connections.map((c) => Number(c.PowerKW)).filter((kw) => Number.isFinite(kw) && kw > 0);
  return {
    id: poi.ID,
    title: poi.AddressInfo?.Title || 'Charging station',
    town: poi.AddressInfo?.Town || poi.AddressInfo?.StateOrProvince || null,
    lat: poi.AddressInfo?.Latitude,
    lon: poi.AddressInfo?.Longitude,
    max_power_kw: powers.length ? Math.max(...powers) : null,
    dc: connections.some((c) => c.CurrentTypeID === DC_CURRENT_TYPE_ID || Number(c.PowerKW) >= 25),
    // null = OCM doesn't know; false = explicitly reported not operational.
    operational: isOperational(poi),
    points: poi.NumberOfPoints ?? null,
  };
}

async function queryOcm(lat, lon, radiusKm, maxResults) {
  const key = process.env.OCM_KEY;
  const url = `https://api.openchargemap.io/v3/poi?output=json&latitude=${lat}&longitude=${lon}&distance=${radiusKm}&distanceunit=KM&maxresults=${maxResults}&compact=true&verbose=false${
    key ? `&key=${key}` : ''
  }`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Charging station lookup failed.');
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(toStation);
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    let stations;
    if (Array.isArray(body?.points) && body.points.length) {
      const pts = body.points.slice(0, MAX_POINTS).filter((p) => p?.lat != null && p?.lon != null);
      const radius = Math.max(5, Math.min(Number(body.radius_km) || 15, 30));
      const results = await Promise.allSettled(pts.map((p) => queryOcm(p.lat, p.lon, radius, 25)));
      if (results.every((r) => r.status === 'rejected')) throw new Error('Charging station lookup failed.');
      const seen = new Map();
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const s of r.value) if (s.id != null && !seen.has(s.id)) seen.set(s.id, s);
      }
      stations = [...seen.values()];
    } else {
      if (body?.lat == null || body?.lon == null) {
        return Response.json({ error: 'lat/lon are required.' }, { status: 400 });
      }
      const radius = Math.max(10, Math.min(Number(body.distance_km) || 50, 100));
      stations = await queryOcm(body.lat, body.lon, radius, 30);
    }

    stations = stations.filter((s) => s.lat != null && s.lon != null && s.operational !== false);
    return Response.json({ stations });
  } catch (err) {
    return Response.json({ error: err.message || 'Charging station lookup failed.' }, { status: 500 });
  }
}
