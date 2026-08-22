'use client';
import { useTripHistory } from '@/lib/tripHistoryContext';
import { fmtNum, fmtRound } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function TripsView() {
  const { trips, clearHistory } = useTripHistory();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Trip history</h2>
        {trips.length > 0 && (
          <Button type="button" variant="secondary" size="sm" onClick={clearHistory}>
            Clear history
          </Button>
        )}
      </div>

      {trips.length === 0 ? (
        <Card className="border-dashed p-5 text-sm text-muted-foreground">
          No trips yet — trips you run on Plan Trip are logged here automatically. Fleet runs
          aren't logged (Fleet has its own dashboard).
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse bg-surface text-sm">
            <thead>
              <tr>
                {['When', 'Route', 'Distance (km)', 'kWh/km', '₹/km', 'Arrival (%)', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-2.5 text-muted-foreground">{formatTime(t.timestamp)}</td>
                  <td className="px-3 py-2.5 text-foreground">
                    {t.origin} → {t.destination}
                  </td>
                  <td className="px-3 py-2.5">{fmtNum(t.dist_km, 0)}</td>
                  <td className="px-3 py-2.5">{fmtNum(t.kWh_per_km, 2)}</td>
                  <td className="px-3 py-2.5">₹{fmtNum(t.cost_per_km, 2)}</td>
                  <td className="px-3 py-2.5">{fmtRound(t.arrival_soc_pct)}%</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={t.feasible ? 'success' : 'warning'}>
                      {t.feasible ? 'Feasible' : 'Needs charge'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
