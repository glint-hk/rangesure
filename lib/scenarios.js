import { estimateTrip } from './energyModel';

// Runs the physics model three times over the same route with different day-to-day
// conditions, so the app can show a real range instead of a flat +/-band:
//  - BEST: no HVAC/aux penalty, a light tailwind assist, payload as entered.
//  - EXPECTED: current measured conditions, unmodified.
//  - WORST: a hotter/colder aux-load penalty, a headwind, and +10% payload uncertainty
//    (unweighed cargo is heavier than logged) — this is the "day it doesn't go your way."
// "Repeatability: can this route be trusted day after day?"
export function runScenarios({ segments, payloadKg, battery_pct, tariff, params }) {
  const expected = estimateTrip({ segments, payloadKg, battery_pct, tariff, params });

  const best = estimateTrip({
    segments: segments.map((s) => ({
      ...s,
      temp_factor: 1,
      headwind_ms: (s.headwind_ms || 0) - 2, // tailwind assist
    })),
    payloadKg,
    battery_pct,
    tariff,
    params,
  });

  const worst = estimateTrip({
    segments: segments.map((s) => ({
      ...s,
      temp_factor: Math.max(s.temp_factor || 1, 1) * 1.3,
      headwind_ms: (s.headwind_ms || 0) + 3,
    })),
    payloadKg: payloadKg * 1.1,
    battery_pct,
    tariff,
    params,
  });

  return { best, expected, worst };
}
