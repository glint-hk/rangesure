// One trip pipeline shared by Plan Trip and Fleet, so the same route always produces the
// same numbers on both screens: route geometry → smoothed segments with per-stretch
// weather → physics model (best / expected / worst) → learned calibration.
// Pure — no fetch. The fetching lives in the views; this only does the maths.
import { buildSegments, totalClimbM } from './segments';
import { runScenarios } from './scenarios';
import { calibrate, explainCalibration, CALIBRATION_TRAINED_ON } from './calibration';

// Weather is sampled at start, ~1/3, ~2/3 and end of the route.
export const WEATHER_SAMPLE_FRACTIONS = [0, 1 / 3, 2 / 3, 1];

export function weatherPoints(routeData) {
  const coords = routeData.coordinates;
  const totalKm = routeData.distance_m / 1000;
  return WEATHER_SAMPLE_FRACTIONS.map((f) => {
    const idx = Math.min(coords.length - 1, Math.round(f * (coords.length - 1)));
    const [lon, lat] = coords[idx];
    return { at_km: totalKm * f, lat, lon };
  });
}

// Points every ~30 km along the route (max 10) for a corridor charger search.
export function chargerSearchPoints(routeData) {
  const coords = routeData.coordinates;
  const totalKm = routeData.distance_m / 1000;
  const n = Math.max(2, Math.min(10, Math.ceil(totalKm / 30) + 1));
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.min(coords.length - 1, Math.round((i / (n - 1)) * (coords.length - 1)));
    const [lon, lat] = coords[idx];
    return { lat, lon };
  });
}

// Re-derives a trip's headline numbers from a (calibrated) kWh/km value — shared by the
// expected result and each best/worst scenario so they all use the same arithmetic.
function deriveFromKwhPerKm(kWh_per_km, dist_km, batteryPct, tariff, params) {
  const total_kWh = kWh_per_km * dist_km;
  const battery_kWh = params.battery_kWh > 0 ? params.battery_kWh : 1;
  const arrival_soc_pct = ((battery_kWh * (batteryPct / 100) - total_kWh) / battery_kWh) * 100;
  return {
    kWh_per_km,
    total_kWh,
    predicted_full_range_km: kWh_per_km > 0 ? battery_kWh / kWh_per_km : Infinity,
    arrival_soc_pct,
    cost_per_km: kWh_per_km * tariff,
    feasible: arrival_soc_pct >= params.reserve_pct,
  };
}

/**
 * @param routeData  { coordinates: [lon, lat, ele][], distance_m, duration_s }
 * @param samples    weather samples [{ at_km, temp_c, temp_factor, wind_ms, wind_from_deg, wet }]
 */
export function computeTrip({ routeData, samples = [], payloadKg, batteryPct, tariff, params }) {
  const segments = buildSegments(routeData.coordinates, routeData.distance_m, routeData.duration_s, samples);
  const { best, expected, worst } = runScenarios({
    segments,
    payloadKg,
    battery_pct: batteryPct,
    tariff,
    params,
  });
  const r = expected;

  // Learned calibration: a small correction on top of the physics estimate, fit on
  // synthetic trip history (lib/calibration.js). The CALIBRATED number drives every
  // verdict, range and arrival figure from here on.
  const avg_gradient =
    r.dist_km > 0 ? r.perSeg.reduce((a, s) => a + s.grade_pct * s.distance_m, 0) / (r.dist_km * 1000) : 0;
  const avg_speed_kmh = routeData.duration_s > 0 ? (routeData.distance_m / routeData.duration_s) * 3.6 : 50;
  const temps = samples.map((s) => s.temp_c).filter((t) => Number.isFinite(t));
  const temp_c = temps.length ? temps.reduce((a, t) => a + t, 0) / temps.length : 27;

  const features = { distance_km: r.dist_km, avg_gradient, payload_kg: payloadKg, temp_c, avg_speed_kmh };
  const factor = calibrate(features);

  const calibratedExpected = deriveFromKwhPerKm(r.kWh_per_km * factor, r.dist_km, batteryPct, tariff, params);

  // Physics breakdown + the learned correction as its own line, so the parts add up to the
  // calibrated total the user sees.
  const physicsTotal = r.total_kWh;
  const breakdown_kwh = { ...r.breakdown_kwh, correction: physicsTotal * (factor - 1) };

  return {
    ...r,
    ...calibratedExpected,
    physics_kWh_per_km: r.kWh_per_km,
    calibration_factor: factor,
    calibration_features: features,
    calibration_note: explainCalibration(features),
    calibration_trained_on: CALIBRATION_TRAINED_ON,
    breakdown_kwh,
    climb_m: totalClimbM(segments),
    avg_speed_kmh,
    temp_c,
    duration_s: routeData.duration_s,
    scenarios: {
      best: deriveFromKwhPerKm(best.kWh_per_km * factor, r.dist_km, batteryPct, tariff, params),
      expected: calibratedExpected,
      worst: deriveFromKwhPerKm(worst.kWh_per_km * factor, r.dist_km, batteryPct, tariff, params),
    },
  };
}
