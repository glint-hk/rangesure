'use client';
import { CheckCircle2, AlertTriangle, XCircle, ShieldAlert, Mountain, Zap, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoHint } from '@/components/ui/info-hint';
import { fmtDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

// status: 'ok' (confident go) | 'warn' (needs charging, plan found) |
// 'uncertain' (governance red-line — degraded data or a bad day breaches the reserve) |
// 'danger' (no workable plan).
const STATUS_STYLES = {
  ok: { icon: CheckCircle2, strip: 'bg-success', medal: 'bg-success/[0.08]', iconColor: 'text-success' },
  warn: { icon: Zap, strip: 'bg-primary', medal: 'bg-primary/[0.08]', iconColor: 'text-primary' },
  uncertain: { icon: ShieldAlert, strip: 'bg-warning', medal: 'bg-warning/[0.09]', iconColor: 'text-warning' },
  danger: { icon: XCircle, strip: 'bg-danger', medal: 'bg-danger/[0.08]', iconColor: 'text-danger' },
};

const CONFIDENCE_BADGE = { high: 'success', medium: 'warning', low: 'warning' };

const clampPct = (v) => Math.max(0, Math.min(100, Math.round(v)));

// Arrival-battery range across a good day / expected / bad day, on a 0–100% scale with
// the reserve marked, so "how much margin do I have" is visible at a glance.
function ArrivalBand({ band }) {
  const { worst, expected, best, reserve } = band;
  const lo = clampPct(Math.min(worst, best));
  const hi = clampPct(Math.max(worst, best));
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          Battery on arrival: bad day to good day
          <InfoHint label="What are the bad and good days?">
            We re-run the trip in two other conditions. A bad day adds a 3 m/s headwind, more AC load and a 10%
            heavier load than declared. A good day has a light tailwind and no extra AC. The dark tick is today's
            expected figure.
          </InfoHint>
        </span>
        <span className="tabular whitespace-nowrap font-medium text-foreground">
          {lo}–{hi}%
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-[#ece8de]">
        <div
          className="absolute inset-y-0 rounded-full bg-primary/35"
          style={{ left: `${lo}%`, width: `${Math.max(1.5, hi - lo)}%` }}
        />
        <div
          className="absolute -top-0.5 h-3 w-[3px] rounded-full bg-foreground"
          style={{ left: `calc(${clampPct(expected)}% - 1.5px)` }}
        />
        <div
          className="absolute -top-1 h-4 w-0 border-l-2 border-dashed border-danger/70"
          style={{ left: `${reserve}%` }}
        />
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted-foreground">
        <span className="absolute whitespace-nowrap text-danger" style={{ left: `${reserve}%` }}>
          ← {reserve}% reserve
        </span>
        <span className="absolute right-0">100%</span>
      </div>
    </div>
  );
}

function StopList({ stops }) {
  return (
    <ol className="mt-4 space-y-2.5">
      {stops.map((s, i) => (
        <li key={i} className="rounded-lg border border-border bg-surface-raised px-3.5 py-3">
          <div className="flex items-start gap-2.5">
            <span className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="break-words text-[13.5px] font-medium text-foreground">{s.charger.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                km {Math.round(s.at_km)} of the route
                {s.detour_km >= 0.5 ? ` · ${s.detour_km.toFixed(1)} km off the route` : ' · on the route'}
                {s.charger.town ? ` · ${s.charger.town}` : ''}
              </div>
              <div className="tabular mt-1.5 text-[12.5px] text-foreground">
                Arrive with {clampPct(s.arrival_soc_pct)}%, charge to {clampPct(s.depart_soc_pct)}%
                {s.charge_minutes ? ` · about ${fmtDuration(s.charge_minutes)}` : ''}
                {s.power_kw ? ` at ${Math.round(s.power_kw)} kW` : ''}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function VerdictCard({
  status = 'ok',
  headline,
  subline,
  confidence,
  reasons = [],
  band,
  stops,
  climb,
  timing,
  footnote,
}) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.ok;
  const Icon = s.icon;

  return (
    <Card className="relative overflow-hidden p-6 shadow-[0_1px_1px_rgba(18,23,43,0.03),0_12px_32px_-14px_rgba(18,23,43,0.22)]">
      <span className={cn('absolute inset-x-0 top-0 h-[3px]', s.strip)} aria-hidden="true" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Verdict</span>
        {confidence && (
          <span className="flex items-center gap-1">
            <Badge variant={CONFIDENCE_BADGE[confidence.level]}>{confidence.label}</Badge>
            <InfoHint label="How is confidence decided?">
              {confidence.detail} Confidence is High when all live data loaded and even a bad day keeps the
              battery above the reserve, Medium when a bad day would not, and Low when some data is missing.
            </InfoHint>
          </span>
        )}
      </div>

      <div className="flex items-start gap-4">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', s.medal)}>
          <Icon className={cn('h-6 w-6', s.iconColor)} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display break-words text-[25px] font-semibold leading-[1.1] text-foreground sm:text-[27px]">
            {headline}
          </h2>
          {subline && <p className="mt-1.5 break-words text-[13.5px] leading-relaxed text-muted-foreground">{subline}</p>}
        </div>
      </div>

      {reasons.length > 0 && (
        <ul className="mt-4 space-y-1.5 rounded-lg border border-warning/25 bg-warning/[0.06] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-foreground">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {band && <ArrivalBand band={band} />}
      {stops?.length > 0 && <StopList stops={stops} />}

      {climb && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-accent/25 bg-accent-soft/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-foreground">
          <Mountain className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden="true" />
          <span className="break-words">
            <span className="font-medium">Biggest climb{climb.name ? ` near ${climb.name}` : ''}:</span>{' '}
            {climb.length_km.toFixed(1)} km rising {Math.round(climb.rise_m)} m (average {climb.grade_pct.toFixed(1)}%
            grade).
            {climb.speed_kmh ? ` Hold about ${climb.speed_kmh} km/h to save energy and brakes.` : ''}
          </span>
        </div>
      )}

      {timing && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-[12.5px] text-foreground">
          <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <span className="tabular">
            {fmtDuration(timing.drive_min)} driving
            {timing.charge_min > 0 ? ` + ${fmtDuration(timing.charge_min)} charging` : ''}
            {timing.charge_min > 0 ? (
              <span className="text-muted-foreground"> = {fmtDuration(timing.drive_min + timing.charge_min)} in total</span>
            ) : null}
          </span>
          {timing.windowVerdict && (
            <Badge variant={timing.windowVerdict.onTime ? 'success' : 'danger'}>{timing.windowVerdict.label}</Badge>
          )}
        </div>
      )}

      {footnote && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{footnote}</p>}
    </Card>
  );
}
