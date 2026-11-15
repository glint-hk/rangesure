'use client';
import { ArrowRight } from 'lucide-react';
import { useTripHistory } from '@/lib/tripHistoryContext';
import { fmtNum, fmtRound } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import MetricTile from './MetricTile';
import { tripOutcome } from './TripsView';

export default function ReportsView({ onNavigate }) {
  const { trips } = useTripHistory();

  const heading = (
    <div className="mb-5">
      <h2 className="font-display text-[30px] font-semibold leading-tight text-foreground">Reports</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Totals across every trip saved in Trip history. Fleet runs are not included; they have their own dashboard.
      </p>
    </div>
  );

  if (trips.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        {heading}
        <Card className="flex flex-col items-start gap-3 border-dashed p-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          Nothing to report yet. Plan a few trips and the totals appear here.
          {onNavigate && (
            <Button type="button" size="sm" onClick={() => onNavigate('plan')}>
              Plan a trip <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const ok = (n) => Number.isFinite(n);
  const totalDistance = trips.reduce((a, t) => a + (ok(t.dist_km) ? t.dist_km : 0), 0);
  const totalEnergy = trips.reduce((a, t) => a + (ok(t.total_kWh) ? t.total_kWh : 0), 0);
  const totalCost = trips.reduce((a, t) => a + (ok(t.dist_km) && ok(t.cost_per_km) ? t.dist_km * t.cost_per_km : 0), 0);
  const avgCostPerKm = totalDistance > 0 ? totalCost / totalDistance : NaN;
  const avgEnergy = totalDistance > 0 ? totalEnergy / totalDistance : NaN;
  const outcomes = trips.map(tripOutcome);
  const noStop = outcomes.filter((o) => o === 'no-stop').length;
  const withStops = outcomes.filter((o) => o === 'stops').length;
  const notPossible = outcomes.filter((o) => o === 'not-possible').length;

  return (
    <div className="mx-auto max-w-5xl">
      {heading}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Trips planned" value={trips.length} />
        <MetricTile label="Total distance" value={fmtRound(totalDistance)} unit="km" />
        <MetricTile label="Total energy" value={fmtNum(totalEnergy, 0)} unit="kWh" hint="Calibrated energy for every saved trip, added up." />
        <MetricTile label="Total energy cost" value={`₹${Math.round(totalCost).toLocaleString('en-IN')}`} hint="Each trip's energy cost per km × its distance, at the tariff used for that trip." />
        <MetricTile label="Average energy use" value={fmtNum(avgEnergy, 2)} unit="kWh/km" hint="Total energy ÷ total distance." />
        <MetricTile label="Average energy cost" value={`₹${fmtNum(avgCostPerKm, 2)}`} unit="/km" hint="Total energy cost ÷ total distance." />
        <MetricTile
          label="Done without charging"
          value={`${Math.round((noStop / trips.length) * 100)}%`}
          trend={`${noStop} of ${trips.length} trips`}
          hint="Share of trips where the starting battery covered the whole route with the reserve intact."
        />
        <MetricTile
          label="Needed charging"
          value={withStops + notPossible}
          trend={notPossible ? `${notPossible} not possible as planned` : 'all with a workable charging plan'}
          hint="Trips that needed one or more charging stops, including any where no reachable charger could be found."
        />
      </div>
    </div>
  );
}
