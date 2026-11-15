'use client';
import { fmtNum } from '@/lib/format';
import { InfoHint } from '@/components/ui/info-hint';

// "Where the energy goes" — splits the trip's calibrated energy into the physical causes
// the model computed (lib/energyModel.js), plus the learned correction, so the total on
// screen is explained rather than just stated. Parts always add up to the total.
const PARTS = [
  {
    key: 'aero',
    label: 'Air resistance',
    color: 'bg-primary',
    help: 'Pushing the truck through the air. Grows with the square of speed, and with any headwind.',
  },
  {
    key: 'rolling',
    label: 'Tyres on the road',
    color: 'bg-[#5b7bd6]',
    help: 'Rolling resistance. Grows with the total weight, so payload matters here. Higher on wet roads.',
  },
  {
    key: 'climbing',
    label: 'Climbing (after regen)',
    color: 'bg-accent',
    help: 'Lifting the truck up hills, minus what regenerative braking recovers on the way down.',
  },
  {
    key: 'aux',
    label: 'AC and auxiliaries',
    color: 'bg-[#8a93a8]',
    help: 'Cabin cooling or heating and other on-board systems, over the trip time. Rises in very hot or cold weather.',
  },
  {
    key: 'correction',
    label: 'Learned correction',
    color: 'bg-[#c9b38a]',
    help: 'What 1,500 past trips show real trucks use beyond the physics estimate in conditions like these.',
  },
];

export default function EnergyBreakdown({ breakdown, totalKwh }) {
  if (!breakdown) return null;
  const rows = PARTS.map((p) => ({ ...p, kwh: breakdown[p.key] ?? 0 }));
  // Negative parts (e.g. a net-downhill route recovers more than it climbs) can't be drawn
  // as a bar segment; they're listed with their sign instead.
  const positiveTotal = rows.reduce((a, r) => a + Math.max(0, r.kwh), 0);

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Where the energy goes
        <InfoHint label="How is the energy split?">
          The physics model adds up the force needed on every stretch of road, using real elevation, live
          weather and your load. These parts add up to the trip total of {fmtNum(totalKwh, 0)} kWh.
        </InfoHint>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-raised">
        {rows.map((r) =>
          r.kwh > 0 ? (
            <div key={r.key} className={r.color} style={{ width: `${(r.kwh / positiveTotal) * 100}%` }} />
          ) : null
        )}
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {rows
          .filter((r) => Math.abs(r.kwh) >= 0.05)
          .map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="flex min-w-0 items-center gap-2 text-foreground">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${r.color}`} />
                <span className="truncate">{r.label}</span>
                <InfoHint label={`What is "${r.label}"?`}>{r.help}</InfoHint>
              </span>
              <span className="tabular shrink-0 text-muted-foreground">
                <span className="font-medium text-foreground">
                  {r.kwh < 0 ? '−' : ''}
                  {fmtNum(Math.abs(r.kwh), 1)} kWh
                </span>
                {totalKwh > 0 && r.kwh > 0 ? ` · ${Math.round((r.kwh / totalKwh) * 100)}%` : ''}
              </span>
            </li>
          ))}
        <li className="flex items-center justify-between border-t border-border pt-1.5 text-[13px] font-semibold text-foreground">
          <span>Total for this trip</span>
          <span className="tabular">{fmtNum(totalKwh, 1)} kWh</span>
        </li>
      </ul>
    </div>
  );
}
