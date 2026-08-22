'use client';
import { fmtNum, fmtRound } from '@/lib/format';
import MetricTile from './MetricTile';

// Card order and wording are fixed by the board deck — do not reorder or rename.
export default function ResultsPanel({ result, chargingNeed, chargePlan }) {
  if (!result) return null;

  // Arrival battery never reads negative: infeasible trips (no reachable charger)
  // show a dash instead of a number, and any other trip shows the FINAL arrival SOC
  // after the charging plan's stops (if any), clamped at 0.
  const arrivalDisplay =
    chargePlan?.status === 'infeasible'
      ? '—'
      : `${fmtRound(Math.max(0, chargePlan?.final_arrival_soc_pct ?? result.arrival_soc_pct))}%`;

  const cards = [
    { label: 'Trip distance (km)', value: fmtNum(result.dist_km, 0) },
    { label: 'Energy use (kWh/km)', value: fmtNum(result.kWh_per_km, 2) },
    { label: 'Predicted full range (km)', value: fmtRound(result.predicted_full_range_km) },
    { label: 'Energy cost (₹/km)', value: `₹${fmtNum(result.cost_per_km, 2)}` },
    { label: 'Arrival battery (%)', value: arrivalDisplay },
    { label: 'Charging need', value: chargingNeed },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <MetricTile key={c.label} label={c.label} value={c.value} />
      ))}
    </div>
  );
}
