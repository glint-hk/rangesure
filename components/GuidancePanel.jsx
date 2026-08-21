'use client';
import { useEffect, useState } from 'react';

// /api/guidance always resolves with { tips: [...] } (falling back to a rule-based
// summary server-side on any LLM failure), so this only needs to handle network errors.
export default function GuidancePanel({ result, chargingNeed, weather }) {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const tripSummary = {
      distance_km: Number(result.dist_km.toFixed(1)),
      kwh_per_km: Number(result.kWh_per_km.toFixed(3)),
      predicted_full_range_km: Math.round(result.predicted_full_range_km),
      arrival_soc_pct: Math.round(result.arrival_soc_pct),
      cost_per_km: Number(result.cost_per_km.toFixed(2)),
      charging_needed: chargingNeed,
      recommended_speed_kmh: result.recommended_speed_kmh,
      notable_climb: result.notable_climb,
      weather: weather ? { temp_c: weather.temp_c, wind_kmh: weather.wind_kmh } : null,
    };

    fetch('/api/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripSummary),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const t = data.tips;
        setTips(Array.isArray(t) ? t : typeof t === 'string' ? t.split('\n').filter(Boolean) : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Guidance unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [result, chargingNeed, weather]);

  if (loading) return <div className="guidance-loading">Generating guidance…</div>;
  if (error) return <div className="guidance-error">Guidance unavailable — computed numbers above still stand.</div>;
  if (!tips.length) return null;

  return (
    <ul className="guidance-list">
      {tips.slice(0, 4).map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
