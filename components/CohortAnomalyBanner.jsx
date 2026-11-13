'use client';
import { TriangleAlert } from 'lucide-react';
import { getCohortAnomaly } from '@/data/cohort';

// G4: a pre-trip anomaly check only fleet-wide data could enable — compares this
// truck's expected draw against its model cohort (data/cohort.js) and flags a possible
// battery-degradation signal. Renders nothing when there's no trip yet or the truck
// isn't flagged.
export default function CohortAnomalyBanner({ vehicleName, expectedKwhPerKm, className }) {
  const anomaly = getCohortAnomaly(vehicleName, expectedKwhPerKm);
  if (!anomaly || !anomaly.flagged) return null;

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border border-accent/25 border-l-[3px] border-l-accent bg-accent-soft/70 px-3.5 py-3 text-[12.5px] leading-relaxed text-foreground ${className || ''}`}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden="true" />
      <span>
        Fleet insight: this truck is drawing ~{Math.abs(Math.round(anomaly.pctAbove))}% above its {vehicleName}{' '}
        cohort — possible battery degradation; schedule a check.{' '}
        <span className="text-muted-foreground">(derived from fleet-cohort comparison — synthetic demo data)</span>
      </span>
    </div>
  );
}
