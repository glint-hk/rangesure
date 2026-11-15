'use client';
import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { CALIBRATION_COEFFICIENTS } from '@/lib/calibration';
import { Button } from '@/components/ui/button';

// Sends the model the numbers on screen: calibrated energy, and the arrival battery AFTER
// the charging plan (null when the trip isn't possible) — never the raw single-leg figure,
// which can be deeply negative.
export default function AskBox({ result, chargePlan }) {
  const arrivalSocPct =
    !chargePlan || chargePlan.status === 'infeasible' || chargePlan.final_arrival_soc_pct == null
      ? null
      : Math.round(Math.max(0, chargePlan.final_arrival_soc_pct));
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    const q = question.trim();
    if (!q || !result) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          trip: {
            distance_km: Number(result.dist_km.toFixed(1)),
            physics_kwh_per_km: Number(result.physics_kWh_per_km?.toFixed(2)),
            calibrated_kwh_per_km: Number(result.kWh_per_km.toFixed(2)),
            range_on_full_battery_km: Math.round(result.predicted_full_range_km),
            arrival_battery_pct_after_charging: arrivalSocPct,
            charging_stops: chargePlan?.status === 'infeasible' ? 'not possible' : chargePlan?.stops?.length ?? 0,
            cost_per_km_inr: Number(result.cost_per_km.toFixed(2)),
            climbing_m: Math.round(result.climb_m),
          },
          calibration: {
            factor: result.calibration_factor,
            coefficients: CALIBRATION_COEFFICIENTS,
            features: result.calibration_features,
          },
        }),
      });
      const data = await res.json();
      setAnswer(data.answer || 'No answer available.');
    } catch {
      setAnswer('Ask is unavailable right now — the numbers above are still accurate.');
    } finally {
      setLoading(false);
    }
  };

  if (!result) return null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Ask about this trip
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Ask a what-if in plain words. The AI explains the likely direction of the change; to get exact numbers,
        change the inputs and the results update.
      </p>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && ask()}
          placeholder="e.g. What if I leave at 30% battery?"
          className="h-10 flex-1 text-[13.5px] rounded-lg border border-border bg-surface px-3 text-foreground shadow-[0_1px_1px_rgba(18,23,43,0.03)] outline-none transition-colors placeholder:text-muted-foreground/80 hover:border-[#d6d0c2] focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
        />
        <Button type="button" size="icon" aria-label="Ask" onClick={ask} disabled={loading || !question.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      {answer && <p className="mt-3 rounded-lg bg-surface-raised px-3 py-2.5 text-[13px] leading-relaxed text-foreground">{answer}</p>}
    </div>
  );
}
