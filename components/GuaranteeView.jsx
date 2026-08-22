'use client';
import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useLastTrip } from '@/lib/lastTripContext';
import { useSettings } from '@/lib/settingsContext';
import { priceGuarantee } from '@/lib/guarantee';
import { getCorridorTrips, getCorridorKey } from '@/data/corridors';
import { fmtNum } from '@/lib/format';
import { DEFAULT_GUARANTEE_PCT, BASELINE_TRIPS } from '@/config';
import CohortAnomalyBanner from './CohortAnomalyBanner';
import MoatPanel from './MoatPanel';

const GUARANTEE_MIN = 90;
const GUARANTEE_MAX = 99.5;

export default function GuaranteeView() {
  const { lastTrip } = useLastTrip();
  const { margin, disruptionCostPerKm } = useSettings();
  const [guaranteePct, setGuaranteePct] = useState(DEFAULT_GUARANTEE_PCT);

  const corridorTrips = lastTrip ? getCorridorTrips(lastTrip.origin, lastTrip.destination) : 0;
  const corridorKey = lastTrip ? getCorridorKey(lastTrip.origin, lastTrip.destination) : '';

  const priced = useMemo(() => {
    if (!lastTrip) return null;
    return priceGuarantee({
      expected_kwh_per_km: lastTrip.expected_kwh_per_km,
      best_kwh_per_km: lastTrip.best_kwh_per_km,
      worst_kwh_per_km: lastTrip.worst_kwh_per_km,
      tariff: lastTrip.tariff,
      guarantee_pct: guaranteePct,
      corridor_trips: corridorTrips,
      baseline_trips: BASELINE_TRIPS,
      margin,
      disruption_cost_per_km: disruptionCostPerKm,
    });
  }, [lastTrip, guaranteePct, corridorTrips, margin, disruptionCostPerKm]);

  if (!lastTrip) {
    return (
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 text-lg font-bold text-foreground">Route Guarantee</h2>
        <Card className="flex items-start gap-3 border-dashed p-5 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          Compute a trip on Plan Trip first — the Route Guarantee prices Tata's commitment from
          that trip's expected/best/worst energy numbers, not a fresh calculation.
        </Card>
      </div>
    );
  }

  const breakdown = priced
    ? [
        { label: 'Energy cost', value: priced.expected_cost_per_km, variant: 'primary' },
        { label: 'Risk buffer', value: priced.risk_cost_per_km + priced.disruption_load_per_km, variant: 'warning' },
        { label: 'Margin', value: priced.margin_per_km, variant: 'muted' },
      ]
    : [];
  const breakdownTotal = breakdown.reduce((a, b) => a + Math.max(0, b.value), 0);

  const BAR_COLORS = {
    primary: 'bg-primary',
    warning: 'bg-warning',
    muted: 'bg-muted-foreground/50',
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-4 text-lg font-bold text-foreground">Route Guarantee</h2>

      <CohortAnomalyBanner
        vehicleName={lastTrip.vehicleName}
        expectedKwhPerKm={lastTrip.expected_kwh_per_km}
        className="mb-4"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {/* Left: hero + slider */}
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            {priced.underwritable ? (
              <>
                <div className="mb-2">
                  <Badge variant="default">{fmtNum(guaranteePct, 1)}% completion guarantee</Badge>
                </div>
                <h3 className="text-xl font-bold leading-snug text-foreground sm:text-2xl">
                  Tata can commit ₹{fmtNum(priced.committed_price_per_km, 2)}/km on {lastTrip.origin} →{' '}
                  {lastTrip.destination}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Expected ₹{fmtNum(priced.expected_cost_per_km, 2)}/km · risk buffer ₹
                  {fmtNum(priced.committed_price_per_km - priced.expected_cost_per_km, 2)}/km · priced from{' '}
                  {corridorTrips.toLocaleString()} corridor trips.
                </p>
              </>
            ) : (
              <>
                <Badge variant="danger">Not yet underwritable</Badge>
                <h3 className="mt-2 text-xl font-bold leading-snug text-foreground sm:text-2xl">
                  Not yet underwritable on {lastTrip.origin} → {lastTrip.destination}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Insufficient trip history at this guarantee level — only {corridorTrips.toLocaleString()} corridor
                  trips logged. Lower the guarantee % or wait for more Fleet Edge trips on this corridor.
                </p>
              </>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
              <span>Guarantee level</span>
              <span className="font-mono text-primary">{fmtNum(guaranteePct, 1)}%</span>
            </div>
            <Slider
              min={GUARANTEE_MIN}
              max={GUARANTEE_MAX}
              step={0.5}
              value={[guaranteePct]}
              onValueChange={([v]) => setGuaranteePct(v)}
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{GUARANTEE_MIN}%</span>
              <span>{GUARANTEE_MAX}%</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Tighter guarantee → larger buffer. Certainty has a price, and this is what it costs.
            </p>
          </Card>
        </div>

        {/* Right: breakdown + assumptions context */}
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What the CFO is paying for (₹/km)
            </h4>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-raised">
              {breakdown.map((b) => (
                <div
                  key={b.label}
                  className={BAR_COLORS[b.variant]}
                  style={{ width: `${breakdownTotal > 0 ? (Math.max(0, b.value) / breakdownTotal) * 100 : 0}%` }}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {breakdown.map((b) => (
                <li key={b.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={`h-2.5 w-2.5 rounded-full ${BAR_COLORS[b.variant]}`} />
                    {b.label}
                  </span>
                  <span className="font-mono text-foreground">₹{fmtNum(b.value, 2)}</span>
                </li>
              ))}
              <li className="mt-1 flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                <span className="text-foreground">Committed price</span>
                <span className="font-mono text-primary">₹{fmtNum(priced.committed_price_per_km, 2)}</span>
              </li>
            </ul>
          </Card>

          <Card className="border-dashed p-5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Illustrative underwriting model</span> — not
            actuarial. Corridor: {corridorKey || '—'}. Assumptions: {corridorTrips.toLocaleString()} logged
            corridor trips (synthetic, stands in for Fleet Edge history), risked against a{' '}
            {BASELINE_TRIPS.toLocaleString()}-trip baseline band, {fmtNum(margin * 100, 0)}% margin, ₹
            {fmtNum(disruptionCostPerKm, 1)}/km disruption load — all editable on Settings.
          </Card>
        </div>
      </div>

      <div className="mt-4">
        <MoatPanel
          expected_kwh_per_km={lastTrip.expected_kwh_per_km}
          best_kwh_per_km={lastTrip.best_kwh_per_km}
          worst_kwh_per_km={lastTrip.worst_kwh_per_km}
          tariff={lastTrip.tariff}
          guarantee_pct={guaranteePct}
          margin={margin}
          disruption_cost_per_km={disruptionCostPerKm}
        />
      </div>
    </div>
  );
}
