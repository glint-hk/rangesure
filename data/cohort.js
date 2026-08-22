// Synthetic per-vehicle-model cohort baseline — stands in for a "battery health vs.
// fleet cohort" check that only Fleet Edge's cross-truck telematics could enable (a
// standalone route planner has no cohort to compare against). For each VEHICLES model
// this treats the trip's own calibrated kWh/km as the cohort mean (what a healthy truck
// of that model draws on average), with a small std spread across the fleet. Each model
// also carries one deterministic synthetic "unit" offset — standing in for a specific
// VIN's own recent Fleet Edge history — expressed in units of that std. A handful are
// seeded away from 0 so the demo reliably surfaces both a flagged and an unflagged
// truck; this is illustrative synthetic data, not a real degradation model.
import { VEHICLES } from '@/config';

const COHORT_STD_FRACTION = 0.05; // cohort spread as a fraction of the model's mean draw
const ANOMALY_Z_THRESHOLD = 1.5;

const UNIT_OFFSET_STD = {
  'Ace EV': 0.6,
  'Ultra E.9': 1.8, // flagged in the demo — the default Plan Trip vehicle
  'Prima E.28K': -0.4,
  'Prima E.55S': 0.9,
};

export function getCohortAnomaly(vehicleName, expected_kwh_per_km) {
  if (!expected_kwh_per_km || !Number.isFinite(expected_kwh_per_km)) return null;
  const cohortMean = expected_kwh_per_km;
  const cohortStd = Math.max(cohortMean * COHORT_STD_FRACTION, 0.01);
  const offsetStd = UNIT_OFFSET_STD[vehicleName] ?? 0;
  const recentDraw = cohortMean + offsetStd * cohortStd;
  const z = (recentDraw - cohortMean) / cohortStd;
  const pctAbove = ((recentDraw - cohortMean) / cohortMean) * 100;
  return { flagged: z > ANOMALY_Z_THRESHOLD, z, pctAbove, cohortMean, cohortStd, recentDraw };
}

export const COHORT_VEHICLE_NAMES = VEHICLES.map((v) => v.name);
