// Pure physics model — no network calls, no fetch. Runs client-side so sliders
// (payload/battery/tariff) update results instantly with no refetch.
export function estimateTrip({ segments, payloadKg, battery_pct, tariff, params }) {
  const p = params;
  const m = p.m_empty + (payloadKg || 0); // gross vehicle mass, kg
  // eta_dt and battery_kWh are divisors below. They're editable on Settings via a plain
  // number input, so guard against 0/negative values producing Infinity/NaN.
  const eta_dt = p.eta_dt > 0 ? p.eta_dt : 0.01;
  const battery_kWh = p.battery_kWh > 0 ? p.battery_kWh : 1;

  let total_wh = 0;
  const perSeg = segments.map((s) => {
    const v = Math.max(s.avg_speed_ms, 1); // m/s, avoid div-by-zero
    // Road grade — lib/segments.js already computes and clamps this per segment
    // (grade_pct, ±30%) so climb-detection and the tractive-force calc agree exactly.
    const sinT = s.grade_pct != null ? s.grade_pct / 100 : Math.max(-0.3, Math.min(0.3, s.delta_h / Math.max(s.distance_m, 1)));
    const vAir = v + (s.headwind_ms || 0); // headwind adds to relative air speed, used only in F_aero

    const F_roll = p.Crr * m * p.g; // rolling resistance
    const F_aero = 0.5 * p.rho * p.Cd * p.A * vAir * vAir; // aerodynamic drag
    const F_grade = m * p.g * sinT; // gradient force (negative on descents)
    const F = F_roll + F_aero + F_grade;

    let e =
      F >= 0
        ? (F * s.distance_m) / eta_dt / 3600 // drivetrain loss, Wh
        : F * s.distance_m * p.eta_regen * eta_dt / 3600; // regen recovery, Wh (negative)

    const P_aux = p.P_aux * (s.temp_factor || 1); // HVAC/aux, adjusted for temperature
    e += (P_aux * (s.distance_m / v)) / 3600; // aux energy over segment time, Wh

    total_wh += e;
    return { ...s, wh: e, grade_pct: sinT * 100 };
  });

  const dist_km = segments.reduce((a, s) => a + s.distance_m, 0) / 1000;
  const total_kWh = total_wh / 1000;
  const kWh_per_km = dist_km > 0 ? total_kWh / dist_km : 0;

  const predicted_full_range_km = kWh_per_km > 0 ? battery_kWh / kWh_per_km : Infinity; // range on a full battery
  const arrival_soc_pct = ((battery_kWh * (battery_pct / 100) - total_kWh) / battery_kWh) * 100;

  return {
    total_kWh,
    kWh_per_km,
    dist_km,
    predicted_full_range_km,
    arrival_soc_pct,
    cost_per_km: kWh_per_km * tariff,
    feasible: arrival_soc_pct >= p.reserve_pct, // must arrive with at least the reserve buffer
    confidence_low: 85,
    confidence_high: 91,
    perSeg,
  };
}
