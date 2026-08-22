'use client';
import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ShieldAlert, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// status: 'ok' (confident go) | 'warn' (needs a charge stop, but confident) |
// 'uncertain' (governance red-line — degraded data or worst-case breaches reserve).
const STATUS_STYLES = {
  ok: {
    icon: CheckCircle2,
    ring: 'ring-success/30',
    iconColor: 'text-success',
    badgeVariant: 'success',
    badgeLabel: 'Go',
  },
  warn: {
    icon: AlertTriangle,
    ring: 'ring-warning/30',
    iconColor: 'text-warning',
    badgeVariant: 'warning',
    badgeLabel: 'Charge stop needed',
  },
  uncertain: {
    icon: ShieldAlert,
    ring: 'ring-warning/40',
    iconColor: 'text-warning',
    badgeVariant: 'warning',
    badgeLabel: 'Low confidence',
  },
  danger: {
    icon: XCircle,
    ring: 'ring-danger/30',
    iconColor: 'text-danger',
    badgeVariant: 'danger',
    badgeLabel: 'Not feasible',
  },
};

// Fixed scale so the repeatability gauge reads consistently trip-to-trip, including
// deeply infeasible ones (a small van on a highway route can show a large negative
// arrival %).
const SCALE_MIN = -40;
const SCALE_MAX = 100;
const scalePct = (v) => Math.max(0, Math.min(100, ((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));

export default function VerdictCard({
  status = 'ok',
  headline,
  subline,
  confidenceLow,
  confidenceHigh,
  reasons = [],
  fallbackActive = false,
  scenarios,
  chargeInfo,
  chargerTitle,
  why,
  children,
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const s = STATUS_STYLES[status] || STATUS_STYLES.ok;
  const Icon = s.icon;

  return (
    <Card className={cn('relative overflow-hidden p-6 ring-1', s.ring)}>
      <div className="flex items-start gap-4">
        <Icon className={cn('h-9 w-9 shrink-0', s.iconColor)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant={s.badgeVariant}>{s.badgeLabel}</Badge>
            {fallbackActive && <Badge variant="warning">Safe fallback active</Badge>}
          </div>
          <h2 className="text-xl font-bold leading-snug text-foreground sm:text-2xl">{headline}</h2>
          {subline && <p className="mt-1 text-sm text-muted-foreground">{subline}</p>}

          {reasons.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-warning">
              {reasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}

          {(confidenceLow != null && confidenceHigh != null) && (
            <div className="mt-4 text-sm font-medium text-primary">
              Confidence: {confidenceLow}–{confidenceHigh}%
            </div>
          )}

          {scenarios && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Repeatability — arrival battery</span>
                <span className="font-medium text-foreground">
                  {Math.round(scenarios.worst.arrival_soc_pct)}–{Math.round(scenarios.best.arrival_soc_pct)}%
                  <span className="text-muted-foreground"> (expected {Math.round(scenarios.expected.arrival_soc_pct)}%)</span>
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="absolute inset-y-0 rounded-full bg-primary/50"
                  style={{
                    left: `${scalePct(scenarios.worst.arrival_soc_pct)}%`,
                    width: `${Math.max(2, scalePct(scenarios.best.arrival_soc_pct) - scalePct(scenarios.worst.arrival_soc_pct))}%`,
                  }}
                />
                <div
                  className="absolute inset-y-0 w-[3px] rounded-full bg-foreground"
                  style={{ left: `${scalePct(scenarios.expected.arrival_soc_pct)}%` }}
                />
              </div>
            </div>
          )}

          {chargeInfo?.charge_minutes != null && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-foreground">
              <span>
                Add ~{chargeInfo.charge_minutes} min at {chargerTitle || 'a nearby charger'}
              </span>
              {chargeInfo.windowVerdict && (
                <Badge variant={chargeInfo.windowVerdict.onTime ? 'success' : 'danger'}>
                  {chargeInfo.windowVerdict.label}
                </Badge>
              )}
            </div>
          )}

          {children}

          {why && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setWhyOpen((o) => !o)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                aria-expanded={whyOpen}
              >
                Why? <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', whyOpen && 'rotate-180')} />
              </button>
              {whyOpen && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{why}</p>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
