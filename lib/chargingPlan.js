import { haversineKm } from './utils';

// Turns "here's a list of nearby chargers" + "here's the per-segment energy draw
// along the route" into an honest, reachability-based charging plan — replacing the
// old "just recommend stations[0]" behaviour (which ignored battery level and route
// position entirely, so it named the same charger regardless of starting SOC and
// could recommend a stop the truck could never actually reach).
//
// Pure — no fetch, same constraints as lib/energyModel.js / lib/scenarios.js.

const MAX_STOPS = 4; // give up and call it infeasible past this many hops
const NEAR_BREACH_WINDOW_KM = 25; // "reachable candidates near the breach"
const MAX_DETOUR_KM = 30; // ignore chargers absurdly far off the route line

// Snaps each charger onto the route by nearest segment point, giving it an
// along-route position (at_km) and how far off the route line it actually sits
// (detour_km) — both needed to judge reachability and to prefer the closest option.
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
    .filter((c) => c && c.detour_km <= MAX_DETOUR_KM);
}

// Walks the cumulative (calibrated) energy draw along the route from a starting SOC
// at from_km, returning the km at which SOC would first drop below reserve_pct.
// last_safe_km/last_safe_soc_kwh is the last point BEFORE that breach — the frontier
// a charger must be at or before to count as "reachable."
function walkToBreach(perSeg, calibrationFactor, batteryKwh, startSocPct, reservePct, fromKm) {
  let socKwh = batteryKwh * (startSocPct / 100);
  const reserveKwh = batteryKwh * (reservePct / 100);
  let lastSafeKm = fromKm;
  let lastSafeSocKwh = socKwh;

  for (const seg of perSeg) {
    const segEndKm = seg.at_km + seg.distance_m / 1000;
    if (segEndKm <= fromKm) continue;
    socKwh -= (seg.wh * calibrationFactor) / 1000;
    if (socKwh >= reserveKwh) {
      lastSafeKm = segEndKm;
      lastSafeSocKwh = socKwh;
    } else {
      return { breached: true, breachKm: segEndKm, lastSafeKm, lastSafeSocKwh };
    }
  }
  return { breached: false, lastSafeKm, lastSafeSocKwh, endSocKwh: socKwh };
}

// Among chargers reachable before the breach, the LAST one reachable (closest to the
// breach point) wins; ties within a window near that frontier are broken by smallest
// detour off the route.
function pickStop(located, lastSafeKm) {
  const reachable = located.filter((c) => c.at_km <= lastSafeKm);
  if (!reachable.length) return null;
  const frontierKm = Math.max(...reachable.map((c) => c.at_km));
  const nearBreach = reachable.filter((c) => c.at_km >= frontierKm - NEAR_BREACH_WINDOW_KM);
  nearBreach.sort((a, b) => a.detour_km - b.detour_km);
  return nearBreach[0];
}

/**
 * @returns {
 *   status: 'ok' | 'needs-stop' | 'infeasible',
 *   stops: [{ charger, at_km, detour_km, arrival_soc_pct }],
 *   final_arrival_soc_pct: number | null,   // at destination, after any stops
 * }
 */
export function planChargingStops({ perSeg, calibrationFactor, chargers, batteryKwh, startSocPct, reservePct }) {
  if (!perSeg?.length || !batteryKwh) return { status: 'ok', stops: [], final_arrival_soc_pct: null };

  const located = locateChargersOnRoute(perSeg, chargers || []);
  const stops = [];
  let fromKm = 0;
  let socPct = startSocPct;

  for (let i = 0; i < MAX_STOPS; i++) {
    const walk = walkToBreach(perSeg, calibrationFactor, batteryKwh, socPct, reservePct, fromKm);
    if (!walk.breached) {
      return {
        status: stops.length ? 'needs-stop' : 'ok',
        stops,
        final_arrival_soc_pct: (walk.endSocKwh / batteryKwh) * 100,
      };
    }

    const stop = pickStop(located, walk.lastSafeKm);
    if (!stop) {
      return { status: 'infeasible', stops, final_arrival_soc_pct: null };
    }

    // The stop is charged to 100% before continuing — arrival SOC at the stop is
    // approximated by the last-safe frontier SOC (the stop sits at or just before it),
    // which is always >= reserve_pct, so it's never a negative/nonsense number.
    stops.push({
      charger: stop.charger,
      at_km: stop.at_km,
      detour_km: stop.detour_km,
      arrival_soc_pct: (walk.lastSafeSocKwh / batteryKwh) * 100,
    });
    fromKm = stop.at_km;
    socPct = 100;
  }

  return { status: 'infeasible', stops, final_arrival_soc_pct: null };
}

// Charge time (minutes) to take a stop from its approximate arrival SOC up to 100%,
// at the given DC charger power (kW) — consistent with planChargingStops' assumption
// that every stop tops all the way up before continuing.
export function chargeMinutesForStop(stop, batteryKwh, chargerKW) {
  if (!chargerKW || chargerKW <= 0) return null;
  const kWhNeeded = Math.max(0, batteryKwh - (batteryKwh * stop.arrival_soc_pct) / 100);
  return Math.ceil((kWhNeeded / chargerKW) * 60);
}
