'use client';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { stripMarkdown } from '@/lib/format';

// /api/guidance always resolves with { tips: [...] } (falling back to a rule-based
// summary server-side on any LLM failure), so this only needs to handle network errors.
//
// arrivalSocPct is the DISPLAY-safe arrival battery (post charging-plan, clamped >= 0,
// or null when infeasible) — never result.arrival_soc_pct directly, which is the raw
// single-leg physics number and can be deeply negative (e.g. "-75%"). Both the LLM
// prompt and the rule-based fallback below only ever see the safe number.
export default function GuidancePanel({ result, chargingNeed, weather, arrivalSocPct }) {
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
      arrival_soc_pct: arrivalSocPct,
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
  }, [result, chargingNeed, weather, arrivalSocPct]);

  if (loading) {
    return (
      <div className="mb-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mb-4 text-sm text-muted-foreground">
        Guidance unavailable — computed numbers above still stand.
      </div>
    );
  }
  if (!tips.length) return null;

  return (
    <ul className="mb-4 space-y-2 text-sm leading-relaxed text-foreground">
      {tips.slice(0, 4).map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-primary">•</span>
          <span className="min-w-0 break-words">{stripMarkdown(t)}</span>
        </li>
      ))}
    </ul>
  );
}
