'use client';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Dot } from 'recharts';
import { Card } from '@/components/ui/card';
import { priceGuarantee } from '@/lib/guarantee';
import { fmtNum } from '@/lib/format';

// G3: sweeps corridor_trips across the SAME trip/guarantee level to show the buffer
// falling as trip history grows — the data flywheel that a new entrant (0 trips) can't
// replicate. Fixed sweep points and labels per the Route Guarantee doc, independent of
// whichever corridor is actually selected on the view.
const TRIP_SWEEP = [0, 100, 500, 1500, 10000, 50000];
const ANNOTATIONS = {
  0: 'New entrant (0 trips) — cannot underwrite',
  1500: 'Tata today (~1,500)',
  10000: 'Tata Year-2 (~10,000)',
};

function AnnotatedDot(props) {
  const { cx, cy, payload } = props;
  const note = ANNOTATIONS[payload.trips];
  if (!note) return <Dot cx={cx} cy={cy} r={3.5} fill="var(--color-primary)" />;
  return (
    <g>
      <Dot cx={cx} cy={cy} r={5} fill={payload.trips === 0 ? 'var(--color-danger)' : 'var(--color-primary)'} />
    </g>
  );
}

export default function MoatPanel({
  expected_kwh_per_km,
  best_kwh_per_km,
  worst_kwh_per_km,
  tariff,
  guarantee_pct,
  margin,
  disruption_cost_per_km,
}) {
  const data = useMemo(
    () =>
      TRIP_SWEEP.map((trips) => {
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
        return { trips, tripsLabel: trips.toLocaleString(), buffer: p.buffer_per_km, underwritable: p.underwritable };
      }),
    [expected_kwh_per_km, best_kwh_per_km, worst_kwh_per_km, tariff, guarantee_pct, margin, disruption_cost_per_km]
  );

  return (
    <Card className="p-6">
      <h4 className="mb-1 text-sm font-bold text-foreground">Why only Tata can price this</h4>
      <p className="mb-4 text-xs text-muted-foreground">
        Illustrative underwriting model — same trip, same {fmtNum(guarantee_pct, 1)}% guarantee, plotted across
        how many corridor trips have been logged.
      </p>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="#e7dfc7" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="tripsLabel" tick={{ fontSize: 11, fill: '#6b7280' }} stroke="#e7dfc7" />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} stroke="#e7dfc7" width={56} />
            <Tooltip
              formatter={(value) => [`₹${fmtNum(value, 2)}/km`, 'Risk buffer']}
              labelFormatter={(label) => `${label} corridor trips`}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e7dfc7',
                background: '#ffffff',
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="buffer"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={<AnnotatedDot />}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        <span className="flex items-center gap-1.5 text-danger">
          <span className="h-2 w-2 rounded-full bg-danger" /> New entrant (0 trips) — cannot underwrite
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" /> Tata today (~1,500)
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" /> Tata Year-2 (~10,000)
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Every completed trip on Fleet Edge tightens the guarantee and lowers the price — a moat that
        compounds, and a new entrant starts at zero.
      </p>
    </Card>
  );
}
