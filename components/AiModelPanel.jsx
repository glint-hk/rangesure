'use client';
import { useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { CALIBRATION_COEFFICIENTS, CALIBRATION_TRAINED_ON } from '@/lib/calibration';

const LABELS = {
  intercept: 'Baseline (intercept)',
  distance_km: 'Trip distance',
  avg_gradient: 'Average gradient',
  payload_kg: 'Payload',
  temp_c: 'Temperature',
  avg_speed_kmh: 'Average speed',
};

export default function AiModelPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <BrainCircuit className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        AI model — what it learned
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="AI model coefficients"
          className="absolute bottom-full right-0 z-10 mb-2 w-[min(340px,90vw)] rounded-xl border border-border bg-surface-raised p-4 shadow-2xl"
        >
          <div className="mb-1 text-sm font-semibold text-foreground">Learned correction model</div>
          <p className="mb-2.5 text-[11px] leading-relaxed text-muted-foreground">
            A linear regression fit on {CALIBRATION_TRAINED_ON.toLocaleString()} synthetic past
            trips (stand-in for real Fleet Edge outcomes), mapping trip features to a correction
            factor applied on top of the physics estimate.
          </p>
          <table className="mb-1 w-full border-collapse text-xs">
            <tbody>
              {CALIBRATION_COEFFICIENTS.map((c) => (
                <tr key={c.name} className="border-b border-border">
                  <td className="py-1 text-muted-foreground">{LABELS[c.name] || c.name}</td>
                  <td className="py-1 text-right font-mono font-semibold text-foreground">
                    {c.value >= 0 ? '+' : ''}
                    {c.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
