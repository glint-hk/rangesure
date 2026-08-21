'use client';
import { fmtNum, fmtRound } from '@/lib/format';

// Card order and wording are fixed by the board deck — do not reorder or rename.
export default function ResultsPanel({ result, chargingNeed }) {
  if (!result) return null;

  const cards = [
    { label: 'Trip distance (km)', value: fmtNum(result.dist_km, 0) },
    { label: 'Energy use (kWh/km)', value: fmtNum(result.kWh_per_km, 2) },
    { label: 'Predicted full range (km)', value: fmtRound(result.predicted_full_range_km) },
    { label: 'Energy cost (₹/km)', value: `₹${fmtNum(result.cost_per_km, 2)}` },
    { label: 'Arrival battery (%)', value: `${fmtRound(result.arrival_soc_pct)}%` },
    { label: 'Charging need', value: chargingNeed },
  ];

  return (
    <div className="card-grid">
      {cards.map((c) => (
        <div className="result-card" key={c.label}>
          <div className="result-card-label">{c.label}</div>
          <div className="result-card-value">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
