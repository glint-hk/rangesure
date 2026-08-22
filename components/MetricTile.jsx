import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function MetricTile({ label, value, unit, trend, className }) {
  const valueStr = String(value ?? '');
  const isLong = valueStr.length > 14;

  return (
    <Card className={cn('min-w-0 overflow-hidden p-4', className)}>
      <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground" title={label}>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          title={valueStr}
          className={cn(
            'line-clamp-2 break-words font-bold leading-tight text-foreground',
            isLong ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'
          )}
        >
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </div>
      {trend && <div className="mt-1 truncate text-xs text-muted-foreground" title={trend}>{trend}</div>}
    </Card>
  );
}
