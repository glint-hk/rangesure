// Server-side: Open-Meteo is keyless. Accepts either one point ({ lat, lon }) or several
// ({ points: [{ lat, lon }] }, fetched in ONE multi-location request) and returns, per
// point, current temperature, wind speed + direction, precipitation, and the derived
// inputs the energy model uses (temp_factor for HVAC load, wet flag for rolling resistance).

// HVAC/aux load multiplier from outside temperature: no extra load in the comfortable
// 16–28 °C band, then +3% per degree beyond it (cabin cooling in Indian summers, heating in
// winter), capped at +60%. Continuous, so 34 °C and 36 °C no longer differ by a 30% jump.
function tempFactor(temp_c) {
  if (!Number.isFinite(temp_c)) return 1;
  const beyond = Math.max(0, Math.abs(temp_c - 22) - 6);
  return Math.min(1.6, 1 + beyond * 0.03);
}

// Light drizzle barely matters; from ~0.5 mm/h the road surface is wet.
const WET_PRECIP_MM = 0.5;

function toSample(current) {
  const temp_c = current?.temperature_2m;
  const wind_kmh = current?.wind_speed_10m ?? 0;
  const precip = current?.precipitation ?? 0;
  return {
    temp_c: Number.isFinite(temp_c) ? temp_c : null,
    wind_kmh,
    wind_ms: wind_kmh / 3.6,
    wind_from_deg: current?.wind_direction_10m ?? null,
    precip,
    wet: precip >= WET_PRECIP_MM,
    temp_factor: tempFactor(temp_c),
  };
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const points = Array.isArray(body?.points) ? body.points : body?.lat != null ? [{ lat: body.lat, lon: body.lon }] : [];
  if (!points.length || points.some((p) => p?.lat == null || p?.lon == null)) {
    return Response.json({ error: 'lat/lon are required.' }, { status: 400 });
  }

  try {
    const lats = points.map((p) => Number(p.lat).toFixed(4)).join(',');
    const lons = points.map((p) => Number(p.lon).toFixed(4)).join(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather lookup failed.');
    const data = await res.json();
    // Open-Meteo returns a single object for one location, an array for several.
    const list = Array.isArray(data) ? data : [data];
    const samples = list.map((d) => toSample(d.current));
    if (samples.length !== points.length) throw new Error('Weather lookup returned an unexpected shape.');

    // Single-point callers keep the original flat response shape.
    if (!Array.isArray(body.points)) return Response.json(samples[0]);
    return Response.json({ samples });
  } catch (err) {
    return Response.json({ error: err.message || 'Weather lookup failed.' }, { status: 500 });
  }
}
