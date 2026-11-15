import { haversineKm } from './utils';

// Turns "here's a list of chargers near the route" + "here's the per-segment energy draw"
// into an honest, reachability-based charging plan. Pure — no fetch.
//
// What it models (each is a real-world effect the earlier version ignored):
//  - the battery level AT each charger's actual position, not at the last safe point;
//  - the detour off the route to reach a charger and come back (costs energy and time);
//  - charging only as much as the rest of the trip needs (+ a small cushion while charging
//    is still fast), up to 100% — but at half speed above 80%, so the search weighs one long
//    charge against an extra stop;
//  - charge time from the slower of the vehicle's charging limit (Settings) and the
//    station's own rated power (30 kW assumed when a station doesn't list one), with the
//    usual slow-down above 80% state of charge.

const MAX_STOPS = 4; // give up and call it infeasible past this many hops
const CANDIDATE_BUCKET_KM = 15; // keep the best charger per stretch of this length
const MAX_CANDIDATES = 16;
const MAX_DETOUR_KM = 10; // chargers further than this off the route aren't practical for a truck
const CHARGE_CAP_PCT = 100; // charging may go to full, but slowly above TAPER_START_PCT
const TAPER_START_PCT = 80; // above this, charging runs at roughly half power
const ARRIVAL_CUSHION_PCT = 5; // charge enough to arrive with reserve + this cushion
const DETOUR_SPEED_KMH = 40; // average speed on a short detour to a charger and back
const EXTRA_STOP_OVERHEAD_MIN = 15; // pulling in, plugging in and leaving again
// Many Indian listings on Open Charge Map don't state a power rating. Assume a modest DC
// charger rather than the truck's maximum, so charge times are never optimistic.
export const UNKNOWN_POWER_KW = 30;

// Snaps each charger onto the route by nearest segment point, giving it an along-route
// position (at_km) and how far off the route line it actually sits (detour_km).
function locateChargersOnRoute(perSeg, chargers) {
  return chargers
    .map((charger) => {
      let best = null;
      let bestDist = Infinity;
      for (const seg of perSeg) {
        const d = haversineKm(charger.lat, charger.lon, seg.lat, seg.lon);
        if (d < bestDist) {
          bestDist = d;
          best = seg;
        }
      }
      if (!best) return null;
      return { charger, at_km: best.at_km, detour_km: bestDist };
    })
    .filter((c) => c && c.detour_km <= MAX_DETOUR_KM)
    .sort((a, b) => a.at_km - b.at_km);
}

// Cumulative calibrated energy (kWh) at each segment boundary, for O(log n) lookups of
// "energy needed between km A and km B".
function buildEnergyProfile(perSeg, calibrationFactor) {
  const kms = [0];
  const kwh = [0];
  for (const seg of perSeg) {
    kms.push(seg.at_km + seg.distance_m / 1000);
    kwh.push(kwh[kwh.length - 1] + (seg.wh * calibrationFactor) / 1000);
  }
  const totalKm = kms[kms.length - 1];

  const energyAt = (km) => {
    if (km <= 0) return 0;
    if (km >= totalKm) return kwh[kwh.length - 1];
    let lo = 0;
    let hi = kms.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (kms[mid] <= km) lo = mid;
      else hi = mid;
    }
    const f = (km - kms[lo]) / Math.max(kms[hi] - kms[lo], 1e-9);
    return kwh[lo] + f * (kwh[hi] - kwh[lo]);
  };

  // Furthest km reachable from fromKm spending at most budgetKwh. Energy is NOT monotonic
  // (regen on descents), so walk forward and stop at the first point the budget is exceeded.
  const reachKm = (fromKm, budgetKwh) => {
    const start = energyAt(fromKm);
    for (let i = 1; i < kms.length; i++) {
      if (kms[i] <= fromKm) continue;
      if (kwh[i] - start > budgetKwh) {
        const prevKm = Math.max(kms[i - 1], fromKm);
        const prevE = energyAt(prevKm) - start;
        const segE = kwh[i] - (start + prevE);
        const f = segE > 0 ? (budgetKwh - prevE) / segE : 0;
        return prevKm + Math.max(0, Math.min(1, f)) * (kms[i] - prevKm);
      }
    }
    return totalKm;
  };

  return { energyAt, reachKm, totalKm };
}

// Minutes to charge from socFrom% to socTo% at powerKw, with half-rate above TAPER_START_PCT.
export function chargeMinutes(batteryKwh, socFromPct, socToPct, powerKw) {
  if (!powerKw || powerKw <= 0 || socToPct <= socFromPct) return 0;
  const fast = Math.max(0, Math.min(socToPct, TAPER_START_PCT) - socFromPct);
  const slow = Math.max(0, socToPct - Math.max(socFromPct, TAPER_START_PCT));
  const hours = ((fast / 100) * batteryKwh) / powerKw + ((slow / 100) * batteryKwh) / (powerKw * 0.5);
  return Math.ceil(hours * 60);
}

/**
 * @returns {
 *   status: 'ok' | 'needs-stop' | 'infeasible',
 *   stops: [{ charger, at_km, detour_km, arrival_soc_pct, depart_soc_pct, charge_kwh, power_kw, charge_minutes }],
 *   final_arrival_soc_pct: number | null,   // at destination, after any stops
 *   total_charge_minutes: number,
 *   reserve_hit_km: number | null,          // infeasible only: where the battery would hit the reserve
 * }
 */
export function planChargingStops({
  perSeg,
  calibrationFactor,
  chargers,
  batteryKwh,
  startSocPct,
  reservePct,
  chargerKW,
}) {
  const empty = { status: 'ok', stops: [], final_arrival_soc_pct: null, total_charge_minutes: 0, reserve_hit_km: null };
  if (!perSeg?.length || !batteryKwh) return empty;

  const { energyAt, reachKm, totalKm } = buildEnergyProfile(perSeg, calibrationFactor);
  const kwhPerKm = totalKm > 0 ? Math.max(energyAt(totalKm), 0.1 * totalKm) / totalKm : 1; // for detour legs
  const reserveKwh = (batteryKwh * reservePct) / 100;
  const cushionKwh = (batteryKwh * ARRIVAL_CUSHION_PCT) / 100;
  const capKwh = (batteryKwh * CHARGE_CAP_PCT) / 100;
  const startKwh = (batteryKwh * startSocPct) / 100;
  const pct = (kwh) => (kwh / batteryKwh) * 100;
  const tripKwh = energyAt(totalKm);

  // No stop needed?
  if (startKwh - tripKwh >= reserveKwh) {
    return { ...empty, final_arrival_soc_pct: pct(startKwh - tripKwh) };
  }

  const power = (c) => {
    const p = Math.min(chargerKW || Infinity, c.charger.max_power_kw || UNKNOWN_POWER_KW);
    return Number.isFinite(p) ? p : null;
  };
  const taperKwh = (batteryKwh * TAPER_START_PCT) / 100;
  // Charge to finish with reserve + cushion, but only spend the cushion while charging is still
  // fast (below 80%); above that, charge just enough to arrive at the reserve.
  const finishTarget = (needNoCushion) =>
    Math.min(capKwh, Math.max(needNoCushion, Math.min(needNoCushion + cushionKwh, taperKwh)));

  // Keep the search small: the fastest (then closest-to-route) charger in each stretch.
  const byBucket = new Map();
  for (const c of locateChargersOnRoute(perSeg, chargers || [])) {
    const b = Math.floor(c.at_km / CANDIDATE_BUCKET_KM);
    const cur = byBucket.get(b);
    if (!cur || (power(c) ?? 0) > (power(cur) ?? 0) || ((power(c) ?? 0) === (power(cur) ?? 0) && c.detour_km < cur.detour_km)) {
      byBucket.set(b, c);
    }
  }
  const candidates = [...byBucket.values()].sort((a, b) => a.at_km - b.at_km).slice(0, MAX_CANDIDATES);

  // Simulates one ordered sequence of stops. At each stop it charges just enough to reach
  // the next stop (with reserve + cushion) when a faster charger is still ahead, otherwise
  // enough to finish (capped at CHARGE_CAP_PCT). Returns null if the sequence doesn't work.
  const simulate = (seq) => {
    let soc = startKwh;
    let pos = 0;
    let minutes = 0;
    const out = [];
    for (let i = 0; i < seq.length; i++) {
      const c = seq[i];
      const arrive = soc - (energyAt(c.at_km) - energyAt(pos)) - c.detour_km * kwhPerKm;
      if (arrive < reserveKwh) return null;
      const later = seq.slice(i + 1);
      const needFinish = finishTarget(tripKwh - energyAt(c.at_km) + c.detour_km * kwhPerKm + reserveKwh);
      let target;
      if (!later.length) {
        target = needFinish;
      } else {
        const next = later[0];
        const needNext =
          energyAt(next.at_km) - energyAt(c.at_km) + (c.detour_km + next.detour_km) * kwhPerKm + reserveKwh + cushionKwh;
        if (needNext > capKwh) return null;
        const fasterAhead = later.some((d) => (power(d) ?? 0) > (power(c) ?? 0));
        target = fasterAhead ? needNext : Math.min(capKwh, Math.max(needNext, needFinish));
      }
      target = Math.max(arrive, target);
      const p = power(c);
      const chargeMin = p ? chargeMinutes(batteryKwh, pct(arrive), pct(target), p) : 0;
      minutes += chargeMin + ((2 * c.detour_km) / DETOUR_SPEED_KMH) * 60 + EXTRA_STOP_OVERHEAD_MIN;
      out.push({
        charger: c.charger,
        at_km: c.at_km,
        detour_km: c.detour_km,
        arrival_soc_pct: pct(arrive),
        depart_soc_pct: pct(target),
        charge_kwh: target - arrive,
        power_kw: p,
        power_assumed: !c.charger.max_power_kw,
        charge_minutes: chargeMin,
      });
      soc = target - c.detour_km * kwhPerKm;
      pos = c.at_km;
    }
    const final = soc - (tripKwh - energyAt(pos));
    if (final < reserveKwh) return null;
    return { minutes, stops: out, final };
  };

  // Exhaustive over ordered combinations of 1..MAX_STOPS candidates (a few thousand at most).
  let best = null;
  const walk = (startIdx, seq) => {
    if (seq.length) {
      const r = simulate(seq);
      if (r && (!best || r.minutes < best.minutes)) best = r;
    }
    if (seq.length === MAX_STOPS) return;
    for (let i = startIdx; i < candidates.length; i++) walk(i + 1, [...seq, candidates[i]]);
  };
  walk(0, []);

  if (!best) {
    return {
      status: 'infeasible',
      stops: [],
      final_arrival_soc_pct: null,
      total_charge_minutes: 0,
      reserve_hit_km: startKwh > reserveKwh ? reachKm(0, startKwh - reserveKwh) : 0,
    };
  }
  return {
    status: 'needs-stop',
    stops: best.stops,
    final_arrival_soc_pct: pct(best.final),
    total_charge_minutes: best.stops.reduce((a, s) => a + s.charge_minutes, 0),
    reserve_hit_km: null,
  };
}
