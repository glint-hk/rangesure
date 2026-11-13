'use client';
import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { CALIBRATION_COEFFICIENTS } from '@/lib/calibration';
import { Button } from '@/components/ui/button';

// arrivalSocPct: the DISPLAY-safe arrival battery (post charging-plan, clamped >= 0, or
// null when infeasible) — sent instead of result.arrival_soc_pct, which is the raw
// single-leg physics number and can be deeply negative.
export default function AskBox({ result, arrivalSocPct }) {
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
            physics_kwh_per_km: Number(result.physics_kWh_per_km?.toFixed(3)),
            calibrated_kwh_per_km: Number(result.kWh_per_km.toFixed(3)),
            predicted_full_range_km: Math.round(result.predicted_full_range_km),
            arrival_soc_pct: arrivalSocPct,
            cost_per_km: Number(result.cost_per_km.toFixed(2)),
            feasible: result.feasible,
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
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Ask about this trip
      </div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="e.g. what if I add 3 tonnes?"
          className="h-10 flex-1 text-[13.5px] rounded-lg border border-border bg-surface px-3 text-foreground shadow-[0_1px_1px_rgba(18,23,43,0.03)] outline-none transition-colors placeholder:text-muted-foreground/80 hover:border-[#d6d0c2] focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
        />
        <Button type="button" size="icon" onClick={ask} disabled={loading || !question.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      {answer && <p className="mt-3 text-sm leading-relaxed text-foreground">{answer}</p>}
    </div>
  );
}
