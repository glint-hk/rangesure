'use client';
import { useMemo, useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { InfoHint } from '@/components/ui/info-hint';
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

const BAR_COLORS = { energy: 'bg-primary', risk: 'bg-accent', margin: 'bg-muted-foreground/50' };

export default function GuaranteeView({ onNavigate, active = true }) {
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

  const title = (
    <div className="mb-5">
      <h2 className="font-display text-[30px] font-semibold leading-tight text-foreground">Route Guarantee</h2>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        A fixed electricity price per km that an operator could promise a customer for this route, sized from the
        trip&apos;s good-day to bad-day energy range and from how many trips have already been run on the corridor.
      </p>
    </div>
  );

  if (!lastTrip) {
    return (
      <div className="mx-auto max-w-6xl">
        {title}
        <Card className="flex flex-col items-start gap-3 border-dashed p-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            Plan a trip first. The guarantee is priced from that trip&apos;s energy numbers.
          </span>
          {onNavigate && (
            <Button type="button" size="sm" onClick={() => onNavigate('plan')}>
              Go to Plan Trip <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const riskPerKm = priced.risk_cost_per_km + priced.disruption_load_per_km;
  const breakdown = [
    {
      key: 'energy',
      label: 'Expected energy cost',
      value: priced.expected_cost_per_km,
      help: `Expected energy per km × the tariff (₹${fmtNum(lastTrip.tariff, 2)}/kWh), the same figure as on Plan Trip.`,
    },
    {
      key: 'risk',
      label: 'Risk buffer',
      value: riskPerKm,
      help: `Extra charged so that on ${fmtNum(guaranteePct, 1)} out of 100 trips the real energy cost stays under the price, plus a small charge for the rare trip that goes over. It shrinks as more trips are logged on the corridor.`,
    },
    {
      key: 'margin',
      label: 'Operator margin',
      value: priced.margin_per_km,
      help: `The operator's ${fmtNum(margin * 100, 0)}% margin on cost plus risk. Editable in Settings.`,
    },
  ];
  const breakdownTotal = breakdown.reduce((a, b) => a + Math.max(0, b.value), 0);

  return (
    <div className="mx-auto max-w-6xl">
      {title}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-[13px] text-muted-foreground">
        <span>
          Based on your last planned trip:{' '}
          <span className="font-medium text-foreground">
            {lastTrip.origin} → {lastTrip.destination}
          </span>{' '}
          · {lastTrip.vehicleName}
          {lastTrip.payload != null ? ` · ${lastTrip.payload.toLocaleString('en-IN')} kg` : ''} · {fmtNum(lastTrip.dist_km, 0)} km
        </span>
        {onNavigate && (
          <button type="button" onClick={() => onNavigate('plan')} className="font-medium text-primary hover:underline">
            Change trip
          </button>
        )}
      </div>

      <CohortAnomalyBanner vehicleName={lastTrip.vehicleName} expectedKwhPerKm={lastTrip.expected_kwh_per_km} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            {priced.underwritable ? (
              <>
                <div className="mb-2 flex items-center gap-1.5">
                  <Badge variant="default">{fmtNum(guaranteePct, 1)}% guarantee level</Badge>
                  <InfoHint label="What does the guarantee level mean?">
                    How often the promise must hold. At {fmtNum(guaranteePct, 1)}%, the real energy cost stays under
                    the guaranteed price on about {fmtNum(guaranteePct, 1)} of every 100 trips. The operator absorbs
                    the cost on the rest.
                  </InfoHint>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display tabular text-[44px] font-semibold leading-none text-foreground sm:text-[52px]">
                    ₹{fmtNum(priced.committed_price_per_km, 2)}
                  </span>
                  <span className="text-base text-muted-foreground">per km</span>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
                  A fixed energy price for {lastTrip.origin} → {lastTrip.destination}. It covers the expected cost of ₹
                  {fmtNum(priced.expected_cost_per_km, 2)}/km, a risk buffer of ₹{fmtNum(riskPerKm, 2)}/km and a margin of ₹
                  {fmtNum(priced.margin_per_km, 2)}/km. Priced from {corridorTrips.toLocaleString('en-IN')} past trips on
                  this corridor.
                </p>
              </>
            ) : (
              <>
                <Badge variant="danger">Can&apos;t quote a price yet</Badge>
                <h3 className="font-display mt-3 text-[26px] font-semibold leading-[1.1] text-foreground">
                  Not enough history on {lastTrip.origin} → {lastTrip.destination}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                  Only {corridorTrips.toLocaleString('en-IN')} trips have been logged on this corridor. With so little
                  history the risk buffer would be too large to be a fair price, so no price is shown. Lower the
                  guarantee level, or log more trips on this route first.
                </p>
              </>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
              <span className="flex items-center gap-1">
                Guarantee level
                <InfoHint label="About the guarantee level">
                  Slide right for a stronger promise. A stronger promise needs a bigger risk buffer, so the price goes
                  up.
                </InfoHint>
              </span>
              <span className="tabular text-primary">{fmtNum(guaranteePct, 1)}%</span>
            </div>
            <Slider
              min={GUARANTEE_MIN}
              max={GUARANTEE_MAX}
              step={0.5}
              value={[guaranteePct]}
              onValueChange={([v]) => setGuaranteePct(v)}
              aria-label="Guarantee level"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{GUARANTEE_MIN}% (cheaper)</span>
              <span>{GUARANTEE_MAX}% (safer)</span>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              What the price is made of (₹ per km)
            </h4>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-raised">
              {breakdown.map((b) => (
                <div
                  key={b.key}
                  className={BAR_COLORS[b.key]}
                  style={{ width: `${breakdownTotal > 0 ? (Math.max(0, b.value) / breakdownTotal) * 100 : 0}%` }}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {breakdown.map((b) => (
                <li key={b.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-foreground">
                    <span className={`h-2.5 w-2.5 rounded-sm ${BAR_COLORS[b.key]}`} />
                    {b.label}
                    <InfoHint label={`What is "${b.label}"?`}>{b.help}</InfoHint>
                  </span>
                  <span className="tabular text-foreground">₹{fmtNum(b.value, 2)}</span>
                </li>
              ))}
              <li className="mt-1 flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                <span className="text-foreground">Guaranteed price</span>
                <span className="tabular text-primary">
                  {priced.underwritable ? `₹${fmtNum(priced.committed_price_per_km, 2)}` : 'Not quoted'}
                </span>
              </li>
            </ul>
          </Card>

          <Card className="border-dashed p-5 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">An illustrative pricing model, not an actuarial one.</span>{' '}
            Corridor: {corridorKey || '—'}, with {corridorTrips.toLocaleString('en-IN')} logged trips (simulated, standing
            in for real fleet telematics). The buffer is sized against a {BASELINE_TRIPS.toLocaleString('en-IN')}-trip
            reference, with a {fmtNum(margin * 100, 0)}% margin and a ₹{fmtNum(disruptionCostPerKm, 1)}/km charge for
            the rare trip that goes over. Margin and that charge are editable in Settings.
          </Card>
        </div>
      </div>

      {/* Charts measure their container; only render while this tab is visible. */}
      {active && <div className="mt-4">
        <MoatPanel
          expected_kwh_per_km={lastTrip.expected_kwh_per_km}
          best_kwh_per_km={lastTrip.best_kwh_per_km}
          worst_kwh_per_km={lastTrip.worst_kwh_per_km}
          tariff={lastTrip.tariff}
          guarantee_pct={guaranteePct}
          margin={margin}
          disruption_cost_per_km={disruptionCostPerKm}
          currentTrips={corridorTrips}
        />
      </div>}
    </div>
  );
}
