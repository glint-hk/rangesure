'use client';
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { stripMarkdown } from '@/lib/format';

// Waits for inputs to settle before asking the model, so typing a payload like "4500"
// doesn't fire four requests (and four flickers).
const DEBOUNCE_MS = 700;

// Builds the summary the guidance writer explains. Every number is rounded exactly as the
// screen shows it, so the bullets never quote "0.823" next to a tile reading "0.82".
function buildSummary(result, chargePlan, climb, samples) {
  const temps = samples.map((s) => s.temp_c).filter(Number.isFinite);
  const winds = samples.map((s) => s.wind_kmh).filter(Number.isFinite);
  const stops = chargePlan?.stops ?? [];
  return {
    distance_km: Math.round(result.dist_km),
    climbing_m: Math.round(result.climb_m),
    kwh_per_km: Number(result.kWh_per_km.toFixed(2)),
    range_on_full_battery_km: Math.round(result.predicted_full_range_km),
    cost_per_km_inr: Number(result.cost_per_km.toFixed(2)),
    arrival_battery_pct:
      chargePlan?.status === 'infeasible' || chargePlan?.final_arrival_soc_pct == null
        ? null
        : Math.round(Math.max(0, chargePlan.final_arrival_soc_pct)),
    charging:
      chargePlan?.status === 'infeasible'
        ? 'not possible: no working charger reachable before the battery reserve'
        : stops.length === 0
        ? 'no stop needed'
        : stops
            .map(
              (s, i) =>
                `stop ${i + 1}: ${s.charger.title} at km ${Math.round(s.at_km)}, charge from ${Math.round(
                  s.arrival_soc_pct
                )}% to ${Math.round(s.depart_soc_pct)}% (~${s.charge_minutes} min)`
            )
            .join('; '),
    steepest_climb: climb
      ? {
          near: climb.name || null,
          length_km: Number(climb.length_km.toFixed(1)),
          avg_grade_pct: Number(climb.grade_pct.toFixed(1)),
          suggested_speed_kmh: climb.speed_kmh,
        }
      : null,
    weather: temps.length
      ? {
          temp_c: Math.round(temps.reduce((a, t) => a + t, 0) / temps.length),
          max_wind_kmh: winds.length ? Math.round(Math.max(...winds)) : null,
          wet_road: samples.some((s) => s.wet),
        }
      : null,
  };
}

export default function GuidancePanel({ result, chargePlan, climb, samples = [] }) {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const summary = useMemo(
    () => (result ? buildSummary(result, chargePlan, climb, samples) : null),
    [result, chargePlan, climb, samples]
  );
  const key = summary ? JSON.stringify(summary) : '';

  useEffect(() => {
    if (!summary) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      fetch('/api/guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: key,
      })
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const tp = data.tips;
          setTips(Array.isArray(tp) ? tp : typeof tp === 'string' ? tp.split('\n').filter(Boolean) : []);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message || 'Guidance unavailable.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // `key` captures every value in the summary; re-run only when one actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (loading && !tips.length) {
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
        Driver notes are unavailable right now. The numbers above are unaffected.
      </div>
    );
  }
  if (!tips.length) return null;

  return (
    <ul className={`mb-4 space-y-2 text-[13.5px] leading-relaxed text-foreground transition-opacity ${loading ? 'opacity-50' : ''}`}>
      {tips.slice(0, 4).map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-primary">•</span>
          <span className="min-w-0 break-words">{stripMarkdown(t)}</span>
        </li>
      ))}
    </ul>
  );
}
