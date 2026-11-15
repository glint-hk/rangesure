'use client';
import { useMemo, useRef, useState } from 'react';
import { Loader2, ShieldCheck, ArrowUpDown } from 'lucide-react';
import { VEHICLES, SHARED_PARAMS, BASELINE_TRIPS } from '@/config';
import { computeTrip, weatherPoints } from '@/lib/tripEngine';
import { priceGuarantee, estimateTripsToUnderwrite } from '@/lib/guarantee';
import { getCorridorTrips, getCorridorKey } from '@/data/corridors';
import { useSettings } from '@/lib/settingsContext';
import { fmtNum, fmtRound } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoHint } from '@/components/ui/info-hint';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import MetricTile from './MetricTile';

// Six sample trucks on common Indian corridors. annualTrips is an illustrative dispatch
// frequency (one-way runs a year) used only to size the Guarantee book's contract value.
const FLEET_PRESET = [
  { truck: 'Truck 01', origin: 'Mumbai', destination: 'Pune', payload: 4000, battery: 90, annualTrips: 250 },
  { truck: 'Truck 02', origin: 'Delhi', destination: 'Jaipur', payload: 6000, battery: 90, annualTrips: 200 },
  { truck: 'Truck 03', origin: 'Bengaluru', destination: 'Chennai', payload: 5000, battery: 75, annualTrips: 220 },
  { truck: 'Truck 04', origin: 'Ahmedabad', destination: 'Surat', payload: 3000, battery: 85, annualTrips: 260 },
  { truck: 'Truck 05', origin: 'Chennai', destination: 'Coimbatore', payload: 4500, battery: 70, annualTrips: 180 },
  { truck: 'Truck 06', origin: 'Pune', destination: 'Nashik', payload: 3500, battery: 95, annualTrips: 240 },
];

const HOUSE_GUARANTEE_PCT = 96;
// "Tight" = arrives above the reserve, but within this many points of it.
const TIGHT_MARGIN_PTS = 5;

const STATUS = {
  ok: { variant: 'success', label: 'Comfortable' },
  tight: { variant: 'warning', label: 'Tight' },
  charge: { variant: 'danger', label: 'Needs a charge stop' },
};

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function FleetView() {
  const { vehicle, tariff, selectVehicle, margin, disruptionCostPerKm } = useSettings();
  const [rows, setRows] = useState([]); // { ...trip, route, samples, error }
  const [rowVehicleNames, setRowVehicleNames] = useState({}); // truck -> vehicle override
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sortKey, setSortKey] = useState('truck');
  const [sortAsc, setSortAsc] = useState(true);
  const runId = useRef(0);

  const runFleet = async () => {
    const id = ++runId.current;
    setLoading(true);
    setProgress(0);
    setRowVehicleNames({});
    const results = [];
    // One truck at a time — keeps us inside the routing API's rate limits.
    for (const trip of FLEET_PRESET) {
      try {
        const route = await postJson('/api/route', { origin: trip.origin, destination: trip.destination });
        const pts = weatherPoints(route);
        let samples = [];
        try {
          const w = await postJson('/api/weather', { points: pts.map(({ lat, lon }) => ({ lat, lon })) });
          samples = (w.samples || []).map((s, i) => ({ ...s, at_km: pts[i].at_km }));
        } catch {
          // weather is optional; typical conditions are assumed without it
        }
        results.push({ ...trip, route, samples, error: null });
      } catch (err) {
        results.push({ ...trip, error: err.message || 'Could not compute this route' });
      }
      if (id !== runId.current) return;
      setProgress(results.length);
    }
    setRows(results);
    setLoading(false);
  };

  // Recomputed instantly (no refetch) when the fleet vehicle, a row's vehicle, the tariff
  // or the guarantee assumptions change. Same engine as Plan Trip.
  const computedRows = useMemo(
    () =>
      rows.map((row) => {
        if (row.error) return row;
        const vName = rowVehicleNames[row.truck] || vehicle.name;
        const params = vName === vehicle.name ? vehicle : { ...SHARED_PARAMS, ...VEHICLES.find((v) => v.name === vName) };
        const payload = Math.min(row.payload, params.payload_max_kg);
        const r = computeTrip({ routeData: row.route, samples: row.samples, payloadKg: payload, batteryPct: row.battery, tariff, params });
        const marginPts = r.arrival_soc_pct - params.reserve_pct;
        const status = marginPts < 0 ? 'charge' : marginPts <= TIGHT_MARGIN_PTS ? 'tight' : 'ok';

        const corridorTrips = getCorridorTrips(row.origin, row.destination);
        const guaranteeArgs = {
          expected_kwh_per_km: r.scenarios.expected.kWh_per_km,
          best_kwh_per_km: r.scenarios.best.kWh_per_km,
          worst_kwh_per_km: r.scenarios.worst.kWh_per_km,
          tariff,
          guarantee_pct: HOUSE_GUARANTEE_PCT,
          corridor_trips: corridorTrips,
          baseline_trips: BASELINE_TRIPS,
          margin,
          disruption_cost_per_km: disruptionCostPerKm,
        };
        const guarantee = priceGuarantee(guaranteeArgs);
        const annualKm = r.dist_km * row.annualTrips;

        return {
          ...row,
          dist_km: r.dist_km,
          kWh_per_km: r.kWh_per_km,
          total_kWh: r.total_kWh,
          cost_per_km: r.cost_per_km,
          predicted_full_range_km: r.predicted_full_range_km,
          arrival_soc_pct: r.arrival_soc_pct,
          payloadUsed: payload,
          vehicleName: vName,
          status,
          corridorKey: getCorridorKey(row.origin, row.destination),
          corridorTrips,
          guarantee,
          riskPerKm: guarantee.risk_cost_per_km + guarantee.disruption_load_per_km,
          annualKm,
          contractValue: guarantee.committed_price_per_km * annualKm,
          tripsNeeded: guarantee.underwritable ? null : estimateTripsToUnderwrite(guaranteeArgs),
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
  const needsChargeCount = validRows.filter((r) => r.status === 'charge').length;
  const tightCount = validRows.filter((r) => r.status === 'tight').length;
  const totalEnergy = validRows.reduce((a, r) => a + (r.total_kWh || 0), 0);
  const totalKm = validRows.reduce((a, r) => a + (r.dist_km || 0), 0);
  const avgCostPerKm = totalKm ? validRows.reduce((a, r) => a + r.cost_per_km * r.dist_km, 0) / totalKm : 0;

  // Guarantee book: the same corridors priced at the house guarantee level. Only
  // corridors with enough history count toward contract value; the rest are named.
  const underwritable = validRows.filter((r) => r.guarantee?.underwritable);
  const notUnderwritable = validRows.filter((r) => r.guarantee && !r.guarantee.underwritable);
  const totalContractValue = underwritable.reduce((a, r) => a + r.contractValue, 0);
  const underwritableKm = underwritable.reduce((a, r) => a + r.annualKm, 0);
  const weightedRisk = underwritableKm ? underwritable.reduce((a, r) => a + r.riskPerKm * r.annualKm, 0) / underwritableKm : 0;

  const columns = [
    { key: 'dist_km', label: 'Distance', unit: 'km', hint: 'Road distance on the truck route.' },
    { key: 'kWh_per_km', label: 'Energy use', unit: 'kWh/km', hint: 'Calibrated energy per km, the same model as Plan Trip.' },
    { key: 'cost_per_km', label: 'Energy cost', unit: '₹/km', hint: 'Energy per km × the tariff in Settings.' },
    {
      key: 'arrival_soc_pct',
      label: 'Battery on arrival',
      unit: '%',
      hint: 'Battery left at the destination if the truck drives straight through without charging. Below the reserve means it needs a stop.',
    },
  ];

  const header = (label, key, hint) => (
    <th key={key} className="px-2.5 py-2.5 text-left align-bottom text-xs font-semibold text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 text-left hover:text-foreground">
          {label}
          <ArrowUpDown className={`h-3 w-3 shrink-0 ${sortKey === key ? 'text-primary' : 'opacity-40'}`} aria-hidden="true" />
        </button>
        {hint && <InfoHint label={`About ${label}`}>{hint}</InfoHint>}
      </span>
    </th>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[30px] font-semibold leading-tight text-foreground">Fleet dashboard</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Six sample trucks on common corridors, run through the same model as Plan Trip. See which can do their run
            without charging, what each costs per km, and what a guaranteed price book would be worth.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={vehicle.name} onValueChange={selectVehicle}>
            <SelectTrigger className="w-72" aria-label="Vehicle for all trucks">
              <SelectValue placeholder="Select vehicle" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLES.map((v) => (
                <SelectItem key={v.name} value={v.name}>
                  All trucks: {v.name} · {v.battery_kWh} kWh
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={runFleet} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? `Routing ${progress + 1} of ${FLEET_PRESET.length}…` : rows.length ? 'Run again' : 'Run the fleet'}
          </Button>
        </div>
      </div>

      {rows.length === 0 && !loading && (
        <Card className="border-dashed p-6 text-sm leading-relaxed text-muted-foreground">
          Press <span className="font-medium text-foreground">Run the fleet</span> to plan all six trucks. It takes about
          half a minute, since each route is fetched with live weather. After that you can change any truck&apos;s
          vehicle and the numbers update instantly.
        </Card>
      )}
      {loading && rows.length === 0 && (
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-sm text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            Planning truck {Math.min(progress + 1, FLEET_PRESET.length)} of {FLEET_PRESET.length}…
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(progress / FLEET_PRESET.length) * 100}%` }} />
          </div>
        </Card>
      )}

      {errorCount > 0 && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2 text-sm text-danger">
          {errorCount} of {computedRows.length} routes could not be planned. The reason is shown in the row.
        </div>
      )}

      {validRows.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile
            label="Energy for all runs"
            value={fmtNum(totalEnergy, 0)}
            unit="kWh"
            trend={`one run each, ${fmtRound(totalKm)} km in total`}
            hint="Electricity needed for one trip on every route, added up."
          />
          <MetricTile
            label="Average energy cost"
            value={`₹${fmtNum(avgCostPerKm, 2)}`}
            unit="/km"
            trend="weighted by distance"
            hint="Total energy cost of all runs divided by total distance."
          />
          <MetricTile
            label="Need a charge stop"
            value={`${needsChargeCount} of ${validRows.length}`}
            tone={needsChargeCount ? 'warn' : 'good'}
            trend={tightCount ? `${tightCount} more arrive close to the reserve` : 'Others arrive with room to spare'}
            hint={`Trucks whose battery would fall below the ${vehicle.reserve_pct}% reserve before arriving. Plan them on Plan Trip to see where to charge, or assign a bigger-battery vehicle.`}
          />
        </div>
      )}

      {validRows.length > 0 && (
        <Card className="mb-4 p-5">
          <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Guarantee book at a {HOUSE_GUARANTEE_PCT}% guarantee level
            <InfoHint label="What is the guarantee book?">
              If the operator offered every corridor at a guaranteed price per km (see the Guarantee page), this is
              what a year of those contracts would look like. Corridors without enough trip history can&apos;t be priced
              and are left out.
            </InfoHint>
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">An illustrative pricing model, not an actuarial one.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricTile
              label="Contract value per year"
              value={`₹${fmtNum(totalContractValue / 100000, 1)} lakh`}
              trend="priceable corridors only"
              hint="Guaranteed price per km × distance × an assumed number of runs a year on each corridor (180–260)."
            />
            <MetricTile
              label="Average risk buffer"
              value={`₹${fmtNum(weightedRisk, 2)}`}
              unit="/km"
              trend="excluding margin"
              hint="The part of the price that covers energy-cost uncertainty, averaged over the year's kilometres."
            />
            <MetricTile
              label="Corridors priceable"
              value={`${underwritable.length} of ${validRows.length}`}
              hint="A corridor can be priced once it has at least 100 logged trips and the risk buffer is reasonable."
            />
          </div>
          {notUnderwritable.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Not yet priceable:{' '}
              {notUnderwritable
                .map((r) =>
                  r.tripsNeeded
                    ? `${r.truck} (${r.corridorKey}) needs about ${(r.tripsNeeded - r.corridorTrips).toLocaleString('en-IN')} more trips`
                    : `${r.truck} (${r.corridorKey}) can't be priced at this level`
                )
                .join('; ')}
              .
            </p>
          )}
        </Card>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse bg-surface text-sm">
            <thead className="bg-surface-raised">
              <tr>
                {header('Truck', 'truck')}
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Route and load</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Vehicle</th>
                {columns.map((c) => header(c.label, c.key, c.hint))}
                {header('Status', 'status', `Comfortable: arrives more than ${TIGHT_MARGIN_PTS} points above the reserve. Tight: within ${TIGHT_MARGIN_PTS} points of it. Needs a charge stop: would fall below it.`)}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.truck} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{r.truck}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <div className="whitespace-nowrap text-foreground">
                      {r.origin} → {r.destination}
                    </div>
                    <div className="text-xs">
                      {(r.payloadUsed ?? r.payload).toLocaleString('en-IN')} kg · starts at {r.battery}%
                    </div>
                  </td>
                  {r.error ? (
                    <td colSpan={6} className="px-3 py-2.5 text-xs text-danger">
                      {r.error}
                    </td>
                  ) : (
                    <>
                      <td className="px-2.5 py-2.5">
                        <Select value={r.vehicleName} onValueChange={(name) => setRowVehicleNames((m) => ({ ...m, [r.truck]: name }))}>
                          <SelectTrigger className="h-8 w-32 text-xs" aria-label={`Vehicle for ${r.truck}`}>
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
                      <td className="tabular whitespace-nowrap px-2.5 py-2.5">{fmtNum(r.dist_km, 0)} km</td>
                      <td className="tabular whitespace-nowrap px-2.5 py-2.5">{fmtNum(r.kWh_per_km, 2)} kWh/km</td>
                      <td className="tabular whitespace-nowrap px-2.5 py-2.5">₹{fmtNum(r.cost_per_km, 2)}/km</td>
                      <td className="tabular whitespace-nowrap px-2.5 py-2.5">
                        {r.arrival_soc_pct < 0 ? <span className="text-danger">Runs out</span> : `${fmtRound(r.arrival_soc_pct)}%`}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <Badge variant={STATUS[r.status].variant} className="whitespace-nowrap">{STATUS[r.status].label}</Badge>
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
