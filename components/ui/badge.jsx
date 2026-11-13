import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset',
  {
    variants: {
      variant: {
        default: 'bg-primary/[0.06] text-primary ring-primary/15',
        success: 'bg-success/[0.07] text-success ring-success/20',
        warning: 'bg-warning/[0.08] text-warning ring-warning/25',
        danger: 'bg-danger/[0.07] text-danger ring-danger/20',
        muted: 'bg-surface-raised text-muted-foreground ring-border',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
