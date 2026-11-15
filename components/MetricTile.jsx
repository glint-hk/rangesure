import { Card } from '@/components/ui/card';
import { InfoHint } from '@/components/ui/info-hint';
import { cn } from '@/lib/utils';

// One labelled number. `hint` adds an (i) that explains in plain words what the number
// means and how it was worked out; `trend` is a short line under the value.
export default function MetricTile({ label, value, unit, trend, hint, tone, className }) {
  const valueStr = String(value ?? '');
  const isLong = valueStr.length > 12;

  return (
    <Card className={cn('relative min-w-0 overflow-hidden p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase leading-[1.25] tracking-[0.1em] text-muted-foreground">
          {label}
        </div>
        {hint && (
          <InfoHint label={`What does "${label}" mean?`} className="-mr-1 -mt-0.5">
            {hint}
          </InfoHint>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          title={valueStr}
          className={cn(
            'tabular break-words font-semibold leading-tight tracking-[-0.02em]',
            tone === 'good' ? 'text-success' : tone === 'warn' ? 'text-warning' : tone === 'bad' ? 'text-danger' : 'text-foreground',
            isLong ? 'text-[16px] sm:text-[17px]' : 'text-[22px] sm:text-[26px]'
          )}
        >
          {value}
        </span>
        {unit && <span className="text-[13px] font-medium text-muted-foreground">{unit}</span>}
      </div>
      {trend && <div className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground" title={trend}>{trend}</div>}
    </Card>
  );
}
