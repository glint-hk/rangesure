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
      className={`flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning ${className || ''}`}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Fleet insight: this truck is drawing ~{Math.abs(Math.round(anomaly.pctAbove))}% above its {vehicleName}{' '}
        cohort — possible battery degradation; schedule a check.{' '}
        <span className="text-muted-foreground">(derived from fleet-cohort comparison — synthetic demo data)</span>
      </span>
    </div>
  );
}
