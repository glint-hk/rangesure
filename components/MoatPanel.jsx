'use client';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Card } from '@/components/ui/card';
import { priceGuarantee } from '@/lib/guarantee';
import { fmtNum } from '@/lib/format';

// The data moat: the same trip at the same guarantee level, priced as if the corridor had
// more or fewer logged trips. The risk buffer (excluding margin) falls as history grows;
// below 100 trips no price can be quoted at all.
const TRIP_SWEEP = [100, 250, 500, 1000, 1500, 3000, 5000, 10000, 25000, 50000];
const fmtTrips = (n) => (n >= 1000 ? `${n / 1000}k` : String(n));

export default function MoatPanel({
  expected_kwh_per_km,
  best_kwh_per_km,
  worst_kwh_per_km,
  tariff,
  guarantee_pct,
  margin,
  disruption_cost_per_km,
  currentTrips,
}) {
  const data = useMemo(() => {
    const sweep = [...new Set([...TRIP_SWEEP, currentTrips].filter((t) => t >= 100))].sort((a, b) => a - b);
    return sweep.map((trips) => {
      const p = priceGuarantee({
        expected_kwh_per_km,
        best_kwh_per_km,
        worst_kwh_per_km,
        tariff,
        guarantee_pct,
        corridor_trips: trips,
        margin,
        disruption_cost_per_km,
      });
      return { trips, buffer: p.risk_cost_per_km + p.disruption_load_per_km, underwritable: p.underwritable };
    });
  }, [expected_kwh_per_km, best_kwh_per_km, worst_kwh_per_km, tariff, guarantee_pct, margin, disruption_cost_per_km, currentTrips]);

  const first = data[0];
  const last = data[data.length - 1];
  const here = data.find((d) => d.trips === currentTrips);

  const Dot = (props) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const isHere = payload.trips === currentTrips;
    return (
      <circle
        key={payload.trips}
        cx={cx}
        cy={cy}
        r={isHere ? 6 : 3.5}
        fill={isHere ? 'var(--color-accent)' : 'var(--color-primary)'}
        stroke="#fff"
        strokeWidth={isHere ? 2 : 1}
      />
    );
  };

  return (
    <Card className="p-6">
      <h4 className="mb-1 font-display text-[22px] font-semibold text-foreground">Why trip history is the moat</h4>
      <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
        The same trip at the same {fmtNum(guarantee_pct, 1)}% level, priced as if the corridor had more or fewer logged
        trips. The risk buffer falls from ₹{fmtNum(first?.buffer, 2)}/km at 100 trips to ₹{fmtNum(last?.buffer, 2)}/km at{' '}
        {last?.trips.toLocaleString('en-IN')}. With fewer than 100 trips no price can be quoted, so a new competitor
        with no history cannot offer this at all.
      </p>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#e2ddd1" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="trips"
              type="number"
              scale="log"
              domain={[100, 50000]}
              ticks={[100, 500, 1500, 5000, 10000, 50000]}
              tickFormatter={fmtTrips}
              tick={{ fontSize: 11, fill: '#475069' }}
              stroke="#e2ddd1"
              label={{ value: 'Logged trips on the corridor (log scale)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#475069' }}
              height={36}
            />
            <YAxis
              tickFormatter={(v) => `₹${v.toFixed(1)}`}
              tick={{ fontSize: 11, fill: '#475069' }}
              stroke="#e2ddd1"
              width={52}
            />
            <Tooltip
              formatter={(value) => [`₹${fmtNum(value, 2)} per km`, 'Risk buffer']}
              labelFormatter={(label) => `${Number(label).toLocaleString('en-IN')} logged trips`}
              contentStyle={{ borderRadius: 10, border: '1px solid #e2ddd1', background: '#ffffff', fontSize: 12 }}
            />
            {here && <ReferenceLine x={currentTrips} stroke="var(--color-accent)" strokeDasharray="4 4" />}
            <Line type="monotone" dataKey="buffer" stroke="var(--color-primary)" strokeWidth={2.5} dot={<Dot />} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {here && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          This corridor today: {currentTrips.toLocaleString('en-IN')} trips, risk buffer ₹{fmtNum(here.buffer, 2)}/km
        </p>
      )}
    </Card>
  );
}
