'use client';

// Card order and wording are fixed by the board deck — do not reorder or rename.
export default function ResultsPanel({ result, chargingNeed }) {
  if (!result) return null;

  const cards = [
    { label: 'Trip distance (km)', value: result.dist_km.toFixed(0) },
    { label: 'Energy use (kWh/km)', value: result.kWh_per_km.toFixed(2) },
    { label: 'Predicted full range (km)', value: Math.round(result.predicted_full_range_km) },
    { label: 'Energy cost (₹/km)', value: `₹${result.cost_per_km.toFixed(2)}` },
    { label: 'Arrival battery (%)', value: `${Math.round(result.arrival_soc_pct)}%` },
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
