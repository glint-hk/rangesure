'use client';
import { useTripHistory } from '@/lib/tripHistoryContext';
import { fmtNum, fmtRound } from '@/lib/format';
import { Card } from '@/components/ui/card';
import MetricTile from './MetricTile';

export default function ReportsView() {
  const { trips } = useTripHistory();

  if (trips.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-lg font-bold text-foreground">Reports</h2>
        <Card className="border-dashed p-5 text-sm text-muted-foreground">
          No trips logged yet — run trips on Plan Trip to build up data here.
        </Card>
      </div>
    );
  }

  const totalDistance = trips.reduce((a, t) => a + (Number.isFinite(t.dist_km) ? t.dist_km : 0), 0);
  const totalEnergy = trips.reduce((a, t) => a + (Number.isFinite(t.total_kWh) ? t.total_kWh : 0), 0);
  const totalCost = trips.reduce(
    (a, t) => a + (Number.isFinite(t.dist_km) && Number.isFinite(t.cost_per_km) ? t.dist_km * t.cost_per_km : 0),
    0
  );
  const avgCostPerKm = totalDistance > 0 ? totalCost / totalDistance : NaN;
  const needsChargeCount = trips.filter((t) => !t.feasible).length;
  const feasiblePct = Math.round(((trips.length - needsChargeCount) / trips.length) * 100);

  const stats = [
    ['Trips logged', trips.length],
    ['Total distance', `${fmtRound(totalDistance)} km`],
    ['Total energy', `${fmtNum(totalEnergy, 1)} kWh`],
    ['Total cost', `₹${fmtNum(totalCost, 0)}`],
    ['Average cost', `₹${fmtNum(avgCostPerKm, 2)}/km`],
    ['Needing a charge stop', needsChargeCount],
    ['Feasible without a stop', `${feasiblePct}%`],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="mb-1 text-lg font-bold text-foreground">Reports</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Aggregated from every trip logged on Plan Trip. Fleet runs aren't included — Fleet has its
        own dashboard.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <MetricTile key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}
