// Governance red-line: decides how much the app trusts its own verdict, and never lets
// the UI show a confident green when it shouldn't. Two independent triggers:
//  - degraded: an upstream data source failed or is missing (weather, chargers,
//    elevation) — the numbers on screen are less trustworthy than usual.
//  - uncertain: the EXPECTED case arrives above the reserve, but the WORST-case scenario
//    (lib/scenarios.js: hotter/colder, headwind, +10% load) would not — a bad day could
//    turn this into an unplanned stop.
//
// The result is a plain confidence LEVEL derived from those checks — not a made-up
// percentage:
//   high   — all data present, and even the worst case arrives above the reserve
//   medium — all data present, but the worst case would dip below the reserve
//   low    — some input data is missing, so the estimate itself is less reliable
export function assessConfidence({
  weatherFailed = false,
  chargingFailed = false,
  elevationMissing = false,
  arrival_soc_pct,
  reserve_pct,
  worstCaseArrivalPct,
}) {
  const reasons = [];
  if (weatherFailed) reasons.push('Live weather was unavailable, so typical conditions were assumed.');
  if (chargingFailed) reasons.push('Charger data was unavailable, so charging options may be missing.');
  if (elevationMissing) reasons.push('Elevation data is missing for part of the route, so climbs may be under-counted.');
  const degraded = reasons.length > 0;

  const expectedFeasible = arrival_soc_pct >= reserve_pct;
  const worstCaseBreachesReserve = worstCaseArrivalPct != null && worstCaseArrivalPct < reserve_pct;
  const uncertain = expectedFeasible && worstCaseBreachesReserve;
  if (uncertain) {
    reasons.push(
      `On a bad day (headwind, extreme heat or a 10% heavier load) the battery could drop below the ${reserve_pct}% reserve before arrival.`
    );
  }

  const level = degraded ? 'low' : uncertain ? 'medium' : 'high';
  return { degraded, uncertain, level, reasons };
}

export const CONFIDENCE_COPY = {
  high: { label: 'High confidence', detail: 'All live data loaded, and even a bad day stays above the reserve.' },
  medium: { label: 'Medium confidence', detail: 'Fine on a normal day; a bad day could need an unplanned stop.' },
  low: { label: 'Low confidence', detail: 'Some live data is missing. Treat these numbers as a rough guide.' },
};
