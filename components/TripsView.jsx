'use client';
import { useTripHistory } from '@/lib/tripHistoryContext';
import { fmtNum, fmtRound } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

// Older entries (before charging-aware logging) only stored `feasible`.
export function tripOutcome(t) {
  if (t.outcome) return t.outcome;
  return t.feasible ? 'no-stop' : 'stops';
}

const OUTCOME_BADGE = {
  'no-stop': { variant: 'success', label: 'No stop needed' },
  stops: { variant: 'default', label: 'Charging stop' },
  'not-possible': { variant: 'danger', label: 'Not possible' },
};

export default function TripsView({ onNavigate }) {
  const { trips, clearHistory } = useTripHistory();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[30px] font-semibold leading-tight text-foreground">Trip history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every trip you plan is saved here, in this browser only, newest first.
          </p>
        </div>
        {trips.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (window.confirm('Delete all saved trips from this browser?')) clearHistory();
            }}
          >
            Clear history
          </Button>
        )}
      </div>

      {trips.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 border-dashed p-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          No trips yet. Each trip you plan on Plan Trip is saved here automatically.
          {onNavigate && (
            <Button type="button" size="sm" onClick={() => onNavigate('plan')}>
              Plan a trip <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse bg-surface text-sm">
            <thead className="bg-surface-raised">
              <tr>
                {['When', 'Route', 'Vehicle and load', 'Distance', 'Energy use', 'Energy cost', 'Battery on arrival', 'Charging'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => {
                const outcome = tripOutcome(t);
                const badge = OUTCOME_BADGE[outcome];
                const label = outcome === 'stops' && t.stops > 1 ? `${t.stops} charging stops` : badge.label;
                return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatTime(t.timestamp)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-foreground">
                      {t.origin} → {t.destination}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {t.vehicleName || '—'}
                      {t.payload != null ? ` · ${Number(t.payload).toLocaleString('en-IN')} kg` : ''}
                    </td>
                    <td className="tabular whitespace-nowrap px-3 py-2.5">{fmtNum(t.dist_km, 0)} km</td>
                    <td className="tabular whitespace-nowrap px-3 py-2.5">{fmtNum(t.kWh_per_km, 2)} kWh/km</td>
                    <td className="tabular whitespace-nowrap px-3 py-2.5">₹{fmtNum(t.cost_per_km, 2)}/km</td>
                    <td className="tabular px-3 py-2.5">
                      {outcome === 'not-possible' || t.arrival_soc_pct == null ? '—' : `${fmtRound(Math.max(0, t.arrival_soc_pct))}%`}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={badge.variant}>{label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
