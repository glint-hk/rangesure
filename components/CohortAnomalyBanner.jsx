'use client';
import { Activity } from 'lucide-react';
import { InfoHint } from '@/components/ui/info-hint';
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
      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden="true" />
      <span>
        <span className="font-medium">Truck health check:</span> this particular truck has recently used about{' '}
        {Math.abs(Math.round(anomaly.pctAbove))}% more energy than other {vehicleName}s on similar trips. Its battery
        may be wearing, so a service check is worth booking. This doesn&apos;t change the trip numbers above.{' '}
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          (sample fleet data)
          <InfoHint label="How is this worked out?">
            With data from a whole fleet, each truck can be compared with others of the same model. A truck using
            noticeably more energy than its peers often has a degrading battery. In this prototype the fleet data is
            simulated.
          </InfoHint>
        </span>
      </span>
    </div>
  );
}
