import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function MetricTile({ label, value, unit, trend, className }) {
  const valueStr = String(value ?? '');
  const isLong = valueStr.length > 14;

  return (
    <Card className={cn('relative min-w-0 overflow-hidden p-4', className)}>
      <div className="line-clamp-2 min-h-[2.4em] text-[10px] font-semibold uppercase leading-[1.2] tracking-[0.12em] text-muted-foreground" title={label}>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          title={valueStr}
          className={cn(
            'tabular line-clamp-2 break-words font-semibold leading-tight tracking-[-0.02em] text-foreground',
            isLong ? 'text-[15px] sm:text-base' : 'text-[22px] sm:text-[26px]'
          )}
        >
          {value}
        </span>
        {unit && <span className="text-[12.5px] font-medium text-muted-foreground">{unit}</span>}
      </div>
      {trend && <div className="mt-1 truncate text-xs text-muted-foreground" title={trend}>{trend}</div>}
    </Card>
  );
}
