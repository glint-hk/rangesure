// Server-side: Open-Meteo is keyless. Returns current temp/wind/precip plus the
// derived temp_factor (the energy model's P_aux multiplier). The caller (DriverView)
// derives its own headwind estimate from wind_ms.
export async function POST(req) {
  try {
    const { lat, lon } = await req.json();
    if (lat == null || lon == null) {
      return Response.json({ error: 'lat/lon are required.' }, { status: 400 });
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather lookup failed.');
    const data = await res.json();

    const temp_c = data.current?.temperature_2m ?? 25;
    const wind_kmh = data.current?.wind_speed_10m ?? 0;
    const precip = data.current?.precipitation ?? 0;

    const temp_factor = temp_c < 5 || temp_c > 35 ? 1.3 : 1.0; // +30% aux outside 5-35°C
    const wind_ms = wind_kmh / 3.6;

    return Response.json({ temp_c, wind_ms, precip, temp_factor });
  } catch (err) {
    return Response.json({ error: err.message || 'Weather lookup failed.' }, { status: 500 });
  }
}
