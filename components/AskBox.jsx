'use client';
import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { CALIBRATION_COEFFICIENTS } from '@/lib/calibration';
import { Button } from '@/components/ui/button';

export default function AskBox({ result }) {
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
            arrival_soc_pct: Math.round(result.arrival_soc_pct),
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
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Ask about this trip
      </div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="e.g. what if I add 3 tonnes?"
          className="h-10 flex-1 rounded-xl border border-border bg-surface-raised px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
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
