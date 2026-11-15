'use client';
import { fmtNum, fmtRound } from '@/lib/format';
import MetricTile from './MetricTile';

// The six headline numbers, in the board deck's order. Every tile carries an (i) that
// says in plain words what the number means and how it was worked out.
export default function ResultsPanel({ result, chargePlan, tariff, reservePct, batteryKwh }) {
  if (!result) return null;

  const infeasible = chargePlan?.status === 'infeasible';
  const stopCount = chargePlan?.stops?.length ?? 0;
  const arrival = infeasible ? null : Math.max(0, chargePlan?.final_arrival_soc_pct ?? result.arrival_soc_pct);

  const chargingValue = infeasible ? 'Not possible' : stopCount === 0 ? 'None' : stopCount === 1 ? '1 stop' : `${stopCount} stops`;
  const chargingTrend = infeasible
    ? 'No working charger is reachable in time'
    : stopCount === 1
    ? chargePlan.stops[0].charger.title
    : stopCount > 1
    ? `${fmtRound(chargePlan.total_charge_minutes)} min of charging in total`
    : 'Enough charge for the whole trip';

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
      <MetricTile
        label="Trip distance"
        value={fmtNum(result.dist_km, 0)}
        unit="km"
        trend={`${fmtRound(result.climb_m)} m of climbing`}
        hint="Road distance on the route a heavy truck is allowed to take (from OpenRouteService's truck profile), which can differ from a car route."
      />
      <MetricTile
        label="Energy use"
        value={fmtNum(result.kWh_per_km, 2)}
        unit="kWh/km"
        trend={`${fmtNum(result.total_kWh, 0)} kWh for the trip`}
        hint="Electricity the truck uses per km on this route, including hills, load, wind, temperature and AC. It's the physics estimate, corrected by what 1,500 past trips show."
      />
      <MetricTile
        label="Range on a full battery"
        value={fmtRound(result.predicted_full_range_km)}
        unit="km"
        trend={`${fmtNum(batteryKwh, 0)} kWh battery`}
        hint="How far a 100% charged battery would last at this trip's energy use. It's battery size divided by energy per km, before keeping any reserve."
      />
      <MetricTile
        label="Energy cost"
        value={`₹${fmtNum(result.cost_per_km, 2)}`}
        unit="/km"
        trend={`₹${fmtNum(result.cost_per_km * result.dist_km, 0)} for the trip`}
        hint={`Energy use × your electricity tariff (₹${fmtNum(tariff, 2)}/kWh). It covers electricity only, not driver, tolls or maintenance.`}
      />
      <MetricTile
        label="Battery on arrival"
        value={arrival == null ? '—' : `${fmtRound(arrival)}%`}
        tone={arrival == null ? 'bad' : arrival < reservePct ? 'bad' : arrival < reservePct + 5 ? 'warn' : undefined}
        trend={stopCount > 0 ? 'after the planned charging' : `${reservePct}% is kept as a reserve`}
        hint={`Battery left when you reach the destination, after any planned charging stops. The plan never lets the battery fall below the ${reservePct}% safety reserve.`}
      />
      <MetricTile
        label="Charging stops"
        value={chargingValue}
        tone={infeasible ? 'bad' : undefined}
        trend={chargingTrend}
        hint="Working public chargers within 10 km of the route, from Open Charge Map. A stop is planned only if the battery would otherwise fall below the reserve, and it charges just enough to finish."
      />
    </div>
  );
}
