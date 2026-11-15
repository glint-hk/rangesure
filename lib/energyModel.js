// Pure physics model — no network calls, no fetch. Runs client-side so input changes
// (payload/battery/tariff/vehicle) update results instantly with no refetch.

// Wet roads raise rolling resistance (water film at the tyre contact patch). ~15% is a
// conservative middle of published truck-tyre wet/dry rolling-resistance ratios.
const WET_CRR_FACTOR = 1.15;

export function estimateTrip({ segments, payloadKg, battery_pct, tariff, params }) {
  const p = params;
  const m = p.m_empty + (payloadKg || 0); // gross vehicle mass, kg
  // eta_dt and battery_kWh are divisors below. They're editable on Settings via a plain
  // number input, so guard against 0/negative values producing Infinity/NaN.
  const eta_dt = p.eta_dt > 0 ? p.eta_dt : 0.01;
  const battery_kWh = p.battery_kWh > 0 ? p.battery_kWh : 1;

  // Where the energy goes (Wh), so the UI can explain the number instead of just stating it.
  const breakdown_wh = { rolling: 0, aero: 0, climbing: 0, aux: 0 };
  let total_wh = 0;

  const perSeg = segments.map((s) => {
    const v = Math.max(s.avg_speed_ms, 1); // m/s, avoid div-by-zero
    // Road grade — lib/segments.js already computes and clamps this per segment
    // (grade_pct, ±30%) so climb-detection and the tractive-force calc agree exactly.
    const sinT = s.grade_pct != null ? s.grade_pct / 100 : Math.max(-0.3, Math.min(0.3, s.delta_h / Math.max(s.distance_m, 1)));
    // Air speed relative to the truck: road speed + the headwind component for this
    // segment's heading (negative = tailwind). Floored at 0 — a tailwind faster than the
    // truck is not modelled as a push.
    const vAir = Math.max(0, v + (s.headwind_ms || 0));

    const Crr = p.Crr * (s.wet ? WET_CRR_FACTOR : 1);
    const F_roll = Crr * m * p.g; // rolling resistance: Crr · m · g
    const F_aero = 0.5 * p.rho * p.Cd * p.A * vAir * vAir; // aerodynamic drag: ½ · ρ · Cd · A · v_air²
    const F_grade = m * p.g * sinT; // gradient force: m · g · sinθ (negative on descents)
    const F = F_roll + F_aero + F_grade;

    let e;
    if (F >= 0) {
      // Positive tractive force: battery energy = F · d / η_drivetrain (Wh), split by force.
      const k = s.distance_m / eta_dt / 3600;
      e = F * k;
      breakdown_wh.rolling += F_roll * k;
      breakdown_wh.aero += F_aero * k;
      breakdown_wh.climbing += F_grade * k;
    } else {
      // Net negative force on a descent: regen recovers F · d · η_regen · η_drivetrain (Wh,
      // negative). Gravity is paying for rolling + drag here, so it all books to "climbing".
      e = (F * s.distance_m * p.eta_regen * eta_dt) / 3600;
      breakdown_wh.climbing += e;
    }

    const P_aux = p.P_aux * (s.temp_factor || 1); // HVAC/aux load (W), adjusted for temperature
    const e_aux = (P_aux * (s.distance_m / v)) / 3600; // aux energy over segment time, Wh
    breakdown_wh.aux += e_aux;
    e += e_aux;

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
    breakdown_kwh: {
      rolling: breakdown_wh.rolling / 1000,
      aero: breakdown_wh.aero / 1000,
      climbing: breakdown_wh.climbing / 1000,
      aux: breakdown_wh.aux / 1000,
    },
    perSeg,
  };
}
