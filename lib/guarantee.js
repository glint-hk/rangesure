// lib/guarantee.js — illustrative underwriting model (NOT actuarial); every number is explainable.
// Turns the trip engine's confidence band into a priced commitment: "Tata can commit
// X ₹/km on this corridor with a Y% completion guarantee." See
// ../../DTAI_RangeSure_Route_Guarantee.md for the full derivation and defaults.

// Acklam inverse-normal approximation:
function invNorm(p) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pl = 0.02425, ph = 1 - pl; let q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p <= ph) { q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export function priceGuarantee({
  expected_kwh_per_km, best_kwh_per_km, worst_kwh_per_km, tariff,
  guarantee_pct, corridor_trips,
  baseline_trips = 1500, margin = 0.08, disruption_cost_per_km = 2.0,
}) {
  const sigma0 = Math.max((worst_kwh_per_km - best_kwh_per_km) / 4, 0.001);
  const data_scale = Math.sqrt(baseline_trips / Math.max(corridor_trips, 1));
  const sigma = sigma0 * data_scale;
  const z = invNorm(Math.min(Math.max(guarantee_pct / 100, 0.5), 0.999));
  const committed_kwh = expected_kwh_per_km + z * sigma;
  const expected_cost = expected_kwh_per_km * tariff;
  const risk_cost = committed_kwh * tariff - expected_cost;
  const disruption_load = (1 - guarantee_pct / 100) * disruption_cost_per_km;
  const buffer = risk_cost + disruption_load;
  const committed_price = (expected_cost + buffer) * (1 + margin);
  const underwritable = corridor_trips >= 100 && isFinite(committed_price) && buffer < expected_cost * 3;
  return {
    committed_price_per_km: committed_price, expected_cost_per_km: expected_cost,
    buffer_per_km: committed_price - expected_cost, sigma, underwritable, guarantee_pct, corridor_trips,
    risk_cost_per_km: risk_cost, disruption_load_per_km: disruption_load, margin_per_km: committed_price - (expected_cost + buffer),
  };
}

// Not part of the reference model — a demo-support helper for the Fleet "Guarantee
// book" (G5): binary-searches upward from a corridor's current trip count to find how
// many corridor trips it would take to flip underwritable=false -> true, so the fleet
// insight line can say "~N more trips" instead of just "needs more history." Returns
// null if not reachable within a generous search ceiling.
export function estimateTripsToUnderwrite(baseArgs, ceiling = 200000) {
  if (priceGuarantee({ ...baseArgs, corridor_trips: baseArgs.corridor_trips }).underwritable) return baseArgs.corridor_trips;
  if (!priceGuarantee({ ...baseArgs, corridor_trips: ceiling }).underwritable) return null;
  let lo = Math.max(100, baseArgs.corridor_trips);
  let hi = ceiling;
  while (hi - lo > 25) {
    const mid = Math.floor((lo + hi) / 2);
    if (priceGuarantee({ ...baseArgs, corridor_trips: mid }).underwritable) hi = mid;
    else lo = mid;
  }
  return hi;
}
