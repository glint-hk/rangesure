'use client';
import { useTripHistory } from '@/lib/tripHistoryContext';
import { fmtNum, fmtRound } from '@/lib/format';

export default function ReportsView() {
  const { trips } = useTripHistory();

  if (trips.length === 0) {
    return (
      <div className="reports-view">
        <h2>Reports</h2>
        <div className="empty-state">No trips logged yet — run trips on Plan Trip to build up data here.</div>
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
    <div className="reports-view">
      <h2>Reports</h2>
      <p className="settings-hint">
        Aggregated from every trip logged on Plan Trip. Fleet runs aren't included — Fleet has
        its own dashboard.
      </p>
      <div className="card-grid reports-grid">
        {stats.map(([label, value]) => (
          <div className="result-card" key={label}>
            <div className="result-card-label">{label}</div>
            <div className="result-card-value">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
