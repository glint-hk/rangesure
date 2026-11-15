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
        className="flex items-center gap-1.5 text-left text-xs font-medium text-primary hover:underline"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <BrainCircuit className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        What the AI learned
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="AI model coefficients"
          className="absolute bottom-full right-0 z-20 mb-2 w-[min(360px,90vw)] rounded-xl border border-border bg-surface p-4 shadow-[0_16px_40px_-12px_rgba(18,23,43,0.3)]"
        >
          <div className="mb-1 text-sm font-semibold text-foreground">Learned correction model</div>
          <p className="mb-2.5 text-[11px] leading-relaxed text-muted-foreground">
            A simple, transparent model (linear regression) fitted on {CALIBRATION_TRAINED_ON.toLocaleString()}{' '}
            past trips. It learns how much real energy use differed from the physics estimate, and predicts a
            correction factor for each new trip. A positive weight means that feature pushes energy use up. The
            trip history is simulated here, standing in for a real fleet&apos;s telematics.
          </p>
          <table className="mb-1 w-full border-collapse text-xs">
            <tbody>
              {CALIBRATION_COEFFICIENTS.map((c) => (
                <tr key={c.name} className="border-b border-border">
                  <td className="py-1 text-muted-foreground">{LABELS[c.name] || c.name}</td>
                  <td className="py-1 text-right tabular font-semibold text-foreground">
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
