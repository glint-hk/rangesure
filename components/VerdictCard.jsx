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

export default function VerdictCard({
  status = 'ok',
  headline,
  subline,
  confidenceLow,
  confidenceHigh,
  reasons = [],
  fallbackActive = false,
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
