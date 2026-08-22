// Synthetic historical trip outcomes — stands in for real Fleet Edge telematics data
// (the "data flywheel" from the deck). Deterministic (seeded PRNG) so the same 1,500
// records, and the same fitted coefficients in lib/calibration.js, come out on every
// run/demo. NOT real data — documented here as a placeholder for a live feed.

// mulberry32: a small, fast, seedable PRNG (no external dependency needed for this).
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260822);
const randRange = (min, max) => min + rand() * (max - min);
function randNormal(mean, sd) {
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sd;
}

// A simplified, trip-level-aggregate physics estimate — NOT the full segment-level
// model in lib/energyModel.js (which needs the actual route geometry). This stands in
// for "what a physics baseline predicts" from the kind of trip-level summary a fleet
// telematics feed would actually log (distance, avg gradient, payload, temp, speed).
export function physicsEstimateKwhPerKm({ avg_gradient, payload_kg, temp_c, avg_speed_kmh }) {
  const BASE = 0.55; // kWh/km — flat road, no payload, mild temp, moderate speed
  const climbTerm = Math.max(0, avg_gradient) * 0.06; // climbing costs more than descents recover
  const descentRecovery = Math.min(0, avg_gradient) * 0.02;
  const payloadTerm = (payload_kg / 1000) * 0.018; // heavier load -> more rolling/tractive force
  const speedTerm = Math.max(0, avg_speed_kmh - 55) * 0.004; // aero drag grows past ~55 km/h
  const tempTerm = (temp_c < 10 ? 10 - temp_c : temp_c > 32 ? temp_c - 32 : 0) * 0.006; // HVAC load at extremes
  return Math.max(0.25, BASE + climbTerm + descentRecovery + payloadTerm + speedTerm + tempTerm);
}

// The "hidden" systematic bias a real fleet exhibits that the simplified physics
// baseline above misses — cold + heavy + hilly trips consistently draw MORE than
// physics predicts (lower cold-weather cell efficiency, understated rolling/traction
// losses under load, regen recovery overstated on real grades). This is exactly what
// lib/calibration.js's regression is meant to learn back out from the data alone —
// it's never told this formula.
function hiddenBias({ avg_gradient, payload_kg, temp_c }) {
  let bias = 1.0;
  if (temp_c < 10) bias += 0.02 + (10 - temp_c) * 0.004;
  if (payload_kg > 3000) bias += ((payload_kg - 3000) / 1000) * 0.01;
  if (avg_gradient > 3) bias += (avg_gradient - 3) * 0.015;
  return bias;
}

const RECORD_COUNT = 1500;

export const TRIP_HISTORY = Array.from({ length: RECORD_COUNT }, () => {
  const distance_km = randRange(20, 400);
  const avg_gradient = randNormal(0.5, 2.5); // %, can go negative on a net-downhill trip
  const payload_kg = randRange(0, 12000);
  const temp_c = randNormal(27, 8);
  const avg_speed_kmh = randRange(25, 75);

  const physics_kwh_per_km = physicsEstimateKwhPerKm({ avg_gradient, payload_kg, temp_c, avg_speed_kmh });
  const bias = hiddenBias({ avg_gradient, payload_kg, temp_c });
  const noise = randNormal(1, 0.03); // +/-3% day-to-day scatter
  const actual_kwh_per_km = Math.max(0.2, physics_kwh_per_km * bias * noise);

  return {
    distance_km: Number(distance_km.toFixed(1)),
    avg_gradient: Number(avg_gradient.toFixed(2)),
    payload_kg: Math.round(payload_kg),
    temp_c: Number(temp_c.toFixed(1)),
    avg_speed_kmh: Number(avg_speed_kmh.toFixed(1)),
    physics_kwh_per_km: Number(physics_kwh_per_km.toFixed(4)),
    actual_kwh_per_km: Number(actual_kwh_per_km.toFixed(4)),
  };
});
