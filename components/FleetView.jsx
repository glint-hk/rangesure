'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { estimateTrip } from '@/lib/energyModel';
import { buildSegments } from '@/lib/segments';
import { useSettings } from '@/lib/settingsContext';
import { fmtNum, fmtRound } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MetricTile from './MetricTile';

const FLEET_PRESET = [
  { truck: 'Truck 01', origin: 'Mumbai', destination: 'Pune', payload: 4000, battery: 80 },
  { truck: 'Truck 02', origin: 'Delhi', destination: 'Jaipur', payload: 6000, battery: 90 },
  { truck: 'Truck 03', origin: 'Bengaluru', destination: 'Chennai', payload: 5000, battery: 75 },
  { truck: 'Truck 04', origin: 'Ahmedabad', destination: 'Surat', payload: 3000, battery: 85 },
  { truck: 'Truck 05', origin: 'Chennai', destination: 'Coimbatore', payload: 4500, battery: 70 },
  { truck: 'Truck 06', origin: 'Pune', destination: 'Nashik', payload: 3500, battery: 95 },
];

export default function FleetView() {
  const { vehicle, tariff } = useSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('truck');
  const [sortAsc, setSortAsc] = useState(true);

  const runFleet = async () => {
    setLoading(true);
    const results = [];
    // Sequential, not Promise.all — keeps us under ORS/OCM rate limits.
    for (const trip of FLEET_PRESET) {
      try {
        const routeRes = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origin: trip.origin, destination: trip.destination }),
        });
        const routeData = await routeRes.json();
        if (!routeRes.ok) throw new Error(routeData.error || 'Route failed');
        const segments = buildSegments(routeData.coordinates, routeData.distance_m, routeData.duration_s);
        const r = estimateTrip({
          segments,
          payloadKg: trip.payload,
          battery_pct: trip.battery,
          tariff,
          params: vehicle,
        });
        results.push({ ...trip, ...r, error: null });
      } catch (err) {
        results.push({ ...trip, error: err.message || 'Failed to compute' });
      }
    }
    setRows(results);
    setLoading(false);
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? va - vb : vb - va;
  });

  const validRows = rows.filter((r) => !r.error);
  const errorCount = rows.length - validRows.length;
  const needsChargeCount = validRows.filter((r) => !r.feasible).length;
  const totalEnergy = validRows.reduce((a, r) => a + (r.total_kWh || 0), 0);
  const avgCostPerKm = validRows.length
    ? validRows.reduce((a, r) => a + r.cost_per_km, 0) / validRows.length
    : 0;

  const columns = [
    { key: 'dist_km', label: 'Distance (km)' },
    { key: 'kWh_per_km', label: 'kWh/km' },
    { key: 'cost_per_km', label: '₹/km' },
    { key: 'predicted_full_range_km', label: 'Range (km)' },
    { key: 'arrival_soc_pct', label: 'Arrival (%)' },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Fleet dashboard</h2>
        <Button type="button" onClick={runFleet} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {loading ? 'Running fleet…' : 'Run fleet'}
        </Button>
      </div>

      {rows.length === 0 && !loading && (
        <Card className="border-dashed p-5 text-sm text-muted-foreground">
          Click "Run fleet" to compute range and cost for 6 sample trucks using the same physics
          model as Plan Trip.
        </Card>
      )}
      {loading && rows.length === 0 && (
        <Card className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Running each truck's route through the model…
        </Card>
      )}

      {errorCount > 0 && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {errorCount} of {rows.length} trucks failed to load — see the row for details.
        </div>
      )}

      {rows.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <MetricTile label="kWh total" value={fmtNum(totalEnergy, 1)} />
          <MetricTile label="avg ₹/km" value={`₹${fmtNum(avgCostPerKm, 2)}`} />
          <MetricTile label="Trips needing a charge stop" value={needsChargeCount} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse bg-surface text-sm">
            <thead>
              <tr>
                <th
                  className="cursor-pointer px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                  onClick={() => toggleSort('truck')}
                >
                  Truck
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Route</th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="cursor-pointer px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.truck} className="border-t border-border">
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.truck}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {r.origin} → {r.destination}
                  </td>
                  {r.error ? (
                    <td colSpan={6} className="px-3 py-2.5 text-xs text-danger">
                      {r.error}
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2.5">{fmtNum(r.dist_km, 0)}</td>
                      <td className="px-3 py-2.5">{fmtNum(r.kWh_per_km, 2)}</td>
                      <td className="px-3 py-2.5">₹{fmtNum(r.cost_per_km, 2)}</td>
                      <td className="px-3 py-2.5">{fmtRound(r.predicted_full_range_km)}</td>
                      <td className="px-3 py-2.5">{fmtRound(r.arrival_soc_pct)}%</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={r.feasible ? 'success' : 'warning'}>
                          {r.feasible ? 'Feasible' : 'Needs charge'}
                        </Badge>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
