import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function MetricTile({ label, value, unit, trend, className }) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-bold text-foreground sm:text-2xl">{value}</span>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </div>
      {trend && <div className="mt-1 text-xs text-muted-foreground">{trend}</div>}
    </Card>
  );
}
