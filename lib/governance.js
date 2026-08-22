// Governance red-line: decides whether the app is confident enough to show a
// confident green go/no-go verdict, or must fall back to an amber "manual planning
// advised" state instead. Two independent triggers:
//  - degraded: an upstream data source failed or is missing (weather, chargers,
//    elevation) — the numbers on screen are less trustworthy than usual.
//  - uncertain: even in the WORST case, the trip's margin over the reserve buffer is
//    thin enough that day-to-day variance could flip a "feasible" trip into "needs a
//    stop." Only flagged when the EXPECTED case still looks feasible — if the expected
//    case already breaches reserve, that's a clear "needs charge," not an uncertain one.
export function assessConfidence({
  weatherFailed = false,
  chargingFailed = false,
  elevationMissing = false,
  arrival_soc_pct,
  reserve_pct,
  worstCaseArrivalPct,
}) {
  const reasons = [];
  if (weatherFailed) reasons.push('Weather data unavailable — using default conditions.');
  if (chargingFailed) reasons.push('Nearby charger data unavailable — charging options may be incomplete.');
  if (elevationMissing) reasons.push('Elevation data missing for part of the route — climbs may be under-counted.');
  const degraded = reasons.length > 0;

  const expectedFeasible = arrival_soc_pct >= reserve_pct;
  const worstCaseBreachesReserve = worstCaseArrivalPct != null && worstCaseArrivalPct < reserve_pct;
  const uncertain = expectedFeasible && worstCaseBreachesReserve;
  if (uncertain) {
    reasons.push('Arrival margin is within the uncertainty band — a worse-than-expected day could require a stop.');
  }

  return { degraded, uncertain, reasons };
}

// Stand-in worst-case penalty applied to expected consumption, used until P1-2 wires
// in the real best/expected/worst scenario run (which will replace this flat guess
// with an actual worst-case simulation — see DriverView's worstCaseArrivalPct).
export const STANDIN_WORST_CASE_PENALTY = 0.15;
