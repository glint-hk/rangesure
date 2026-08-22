'use client';
import { useMemo, useState } from 'react';
import { Loader2, TriangleAlert, ShieldCheck } from 'lucide-react';
import { VEHICLES, SHARED_PARAMS, DEFAULT_GUARANTEE_PCT, BASELINE_TRIPS } from '@/config';
import { estimateTrip } from '@/lib/energyModel';
import { buildSegments } from '@/lib/segments';
import { runScenarios } from '@/lib/scenarios';
import { priceGuarantee, estimateTripsToUnderwrite } from '@/lib/guarantee';
import { getCorridorTrips, getCorridorKey } from '@/data/corridors';
import { useSettings } from '@/lib/settingsContext';
import { fmtNum, fmtRound } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import MetricTile from './MetricTile';

// annualTrips is an illustrative dispatch-frequency assumption (one-way runs/year on
// that corridor) used only to size the Guarantee book's contract value — not a routing
// input, and not derived from anything the app measures.
const FLEET_PRESET = [
  { truck: 'Truck 01', origin: 'Mumbai', destination: 'Pune', payload: 4000, battery: 90, annualTrips: 250 },
  { truck: 'Truck 02', origin: 'Delhi', destination: 'Jaipur', payload: 6000, battery: 90, annualTrips: 200 },
  { truck: 'Truck 03', origin: 'Bengaluru', destination: 'Chennai', payload: 5000, battery: 75, annualTrips: 220 },
  { truck: 'Truck 04', origin: 'Ahmedabad', destination: 'Surat', payload: 3000, battery: 85, annualTrips: 260 },
  { truck: 'Truck 05', origin: 'Chennai', destination: 'Coimbatore', payload: 4500, battery: 70, annualTrips: 180 },
  { truck: 'Truck 06', origin: 'Pune', destination: 'Nashik', payload: 3500, battery: 95, annualTrips: 240 },
];

const HOUSE_GUARANTEE_PCT = 96;

// A trip is MARGINAL when it's feasible but the arrival SOC is within 5 points of the
// reserve buffer — likely to flip to "needs charge" on a slightly worse day.
const MARGIN_THRESHOLD_PTS = 5;

const LARGEST_BATTERY_VEHICLE = VEHICLES.reduce((a, b) => (b.battery_kWh > a.battery_kWh ? b : a));

export default function FleetView() {
  const { vehicle, tariff, selectVehicle, margin, disruptionCostPerKm } = useSettings();
  const [rows, setRows] = useState([]); // { truck, origin, destination, payload, battery, segments, error }
  const [rowVehicleNames, setRowVehicleNames] = useState({}); // truck -> vehicle name override
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('truck');
  const [sortAsc, setSortAsc] = useState(true);

  const runFleet = async () => {
    setLoading(true);
    setRowVehicleNames({});
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
        results.push({ ...trip, segments, error: null });
      } catch (err) {
        results.push({ ...trip, error: err.message || 'Failed to compute' });
      }
    }
    setRows(results);
    setLoading(false);
  };

  // Re-derives each row's numbers from its stored segments whenever the fleet-wide
  // vehicle, a per-row override, or the tariff changes — no re-fetch needed, mirrors
  // Plan Trip's live-recompute pattern. Also runs the best/expected/worst scenario band
  // (not just a single physics estimate) so each corridor can be priced by the
  // Guarantee book (G5) the same way Plan Trip prices a single trip.
  const computedRows = useMemo(
    () =>
      rows.map((row) => {
        if (row.error) return row;
        const vName = rowVehicleNames[row.truck] || vehicle.name;
        const params = vName === vehicle.name ? vehicle : { ...SHARED_PARAMS, ...VEHICLES.find((v) => v.name === vName) };
        const { best, expected, worst } = runScenarios({
          segments: row.segments,
          payloadKg: row.payload,
          battery_pct: row.battery,
          tariff,
          params,
        });
        const r = expected;
        const marginPts = r.arrival_soc_pct - params.reserve_pct;
        const status = marginPts < 0 ? 'infeasible' : marginPts <= MARGIN_THRESHOLD_PTS ? 'marginal' : 'feasible';

        const corridorTrips = getCorridorTrips(row.origin, row.destination);
        const guaranteeArgs = {
          expected_kwh_per_km: expected.kWh_per_km,
          best_kwh_per_km: best.kWh_per_km,
          worst_kwh_per_km: worst.kWh_per_km,
          tariff,
          guarantee_pct: HOUSE_GUARANTEE_PCT,
          corridor_trips: corridorTrips,
          baseline_trips: BASELINE_TRIPS,
          margin,
          disruption_cost_per_km: disruptionCostPerKm,
        };
        const guarantee = priceGuarantee(guaranteeArgs);
        const annualKm = r.dist_km * row.annualTrips;
        const tripsNeeded = guarantee.underwritable ? null : estimateTripsToUnderwrite(guaranteeArgs);

        return {
          ...row,
          ...r,
          vehicleName: vName,
          status,
          corridorKey: getCorridorKey(row.origin, row.destination),
          corridorTrips,
          guarantee,
          annualKm,
          contractValue: guarantee.committed_price_per_km * annualKm,
          tripsNeeded,
        };
      }),
    [rows, rowVehicleNames, vehicle, tariff, margin, disruptionCostPerKm]
  );

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sorted = [...computedRows].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? va - vb : vb - va;
  });

  const validRows = computedRows.filter((r) => !r.error);
  const errorCount = computedRows.length - validRows.length;
  const needsChargeCount = validRows.filter((r) => r.status === 'infeasible').length;
  const marginalCount = validRows.filter((r) => r.status === 'marginal').length;
  const totalEnergy = validRows.reduce((a, r) => a + (r.total_kWh || 0), 0);
  const avgCostPerKm = validRows.length
    ? validRows.reduce((a, r) => a + r.cost_per_km, 0) / validRows.length
    : 0;

  // G5: the Guarantee book — same corridors, priced at the house guarantee level
  // (HOUSE_GUARANTEE_PCT) instead of a per-trip picked one. Only underwritable
  // corridors count toward the book's contract value; the rest are flagged, not
  // silently priced anyway.
  const underwritableRows = validRows.filter((r) => r.guarantee?.underwritable);
  const notUnderwritableRows = validRows.filter((r) => r.guarantee && !r.guarantee.underwritable);
  const totalContractValue = underwritableRows.reduce((a, r) => a + r.contractValue, 0);
  const totalUnderwritableKm = underwritableRows.reduce((a, r) => a + r.annualKm, 0);
  const weightedAvgBuffer = totalUnderwritableKm
    ? underwritableRows.reduce((a, r) => a + (r.guarantee.committed_price_per_km - r.guarantee.expected_cost_per_km) * r.annualKm, 0) /
      totalUnderwritableKm
    : 0;

  const STATUS_BADGE = {
    feasible: { variant: 'success', label: 'Feasible' },
    marginal: { variant: 'warning', label: 'Marginal' },
    infeasible: { variant: 'danger', label: 'Infeasible' },
  };

  const columns = [
    { key: 'dist_km', label: 'Distance (km)' },
    { key: 'kWh_per_km', label: 'kWh/km' },
    { key: 'cost_per_km', label: '₹/km' },
    { key: 'predicted_full_range_km', label: 'Range (km)' },
    { key: 'arrival_soc_pct', label: 'Arrival (%)' },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Fleet dashboard</h2>
        <div className="flex items-center gap-2">
          <Select value={vehicle.name} onValueChange={selectVehicle}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select vehicle" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLES.map((v) => (
                <SelectItem key={v.name} value={v.name}>
                  {v.name} · {v.battery_kWh} kWh
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={runFleet} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? 'Running fleet…' : 'Run fleet'}
          </Button>
        </div>
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
          {errorCount} of {computedRows.length} trucks failed to load — see the row for details.
        </div>
      )}

      {rows.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <MetricTile label="kWh total" value={fmtNum(totalEnergy, 1)} />
          <MetricTile label="avg ₹/km" value={`₹${fmtNum(avgCostPerKm, 2)}`} />
          <MetricTile label="Trips needing a charge stop" value={needsChargeCount} />
        </div>
      )}

      {marginalCount > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {marginalCount} route{marginalCount === 1 ? ' is' : 's are'} marginal (within{' '}
          {MARGIN_THRESHOLD_PTS} pts of reserve) — assign the {LARGEST_BATTERY_VEHICLE.name} or add
          a planned charge.
        </div>
      )}

      {validRows.length > 0 && (
        <Card className="mb-4 p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Guarantee book · {HOUSE_GUARANTEE_PCT}% house guarantee
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricTile
              label="Guaranteed contract value"
              value={`₹${(totalContractValue / 100000).toFixed(2)}L`}
              trend="annualized, underwritable corridors only"
            />
            <MetricTile label="Weighted avg risk buffer" value={`₹${fmtNum(weightedAvgBuffer, 2)}`} unit="/km" />
            <MetricTile
              label="Corridors underwritable"
              value={`${underwritableRows.length} of ${validRows.length}`}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {notUnderwritableRows.length === 0
              ? `All ${validRows.length} corridors are underwritable today at the ${HOUSE_GUARANTEE_PCT}% house guarantee.`
              : `${underwritableRows.length} of ${validRows.length} corridors are underwritable today; ${
                  notUnderwritableRows.length
                } need${notUnderwritableRows.length === 1 ? 's' : ''} more trip history — ${notUnderwritableRows
                  .map((r) =>
                    r.tripsNeeded
                      ? `${r.truck} (~${(r.tripsNeeded - r.corridorTrips).toLocaleString()} more)`
                      : `${r.truck} (not reachable at this guarantee level)`
                  )
                  .join(', ')}.`}
          </p>
        </Card>
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
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Vehicle</th>
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
                    <td colSpan={7} className="px-3 py-2.5 text-xs text-danger">
                      {r.error}
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2.5">
                        <Select
                          value={r.vehicleName}
                          onValueChange={(name) => setRowVehicleNames((m) => ({ ...m, [r.truck]: name }))}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VEHICLES.map((v) => (
                              <SelectItem key={v.name} value={v.name}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">{fmtNum(r.dist_km, 0)}</td>
                      <td className="px-3 py-2.5">{fmtNum(r.kWh_per_km, 2)}</td>
                      <td className="px-3 py-2.5">₹{fmtNum(r.cost_per_km, 2)}</td>
                      <td className="px-3 py-2.5">{fmtRound(r.predicted_full_range_km)}</td>
                      <td className="px-3 py-2.5">{fmtRound(r.arrival_soc_pct)}%</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={STATUS_BADGE[r.status].variant}>{STATUS_BADGE[r.status].label}</Badge>
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
