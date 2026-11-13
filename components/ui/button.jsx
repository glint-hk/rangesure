'use client';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium tracking-[-0.005em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-b from-[#26326a] to-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(18,23,43,0.2),0_6px_16px_-8px_rgba(27,37,80,0.6)] hover:from-[#2c3a78] hover:to-[#202c5e]',
        secondary:
          'bg-surface text-foreground border border-border shadow-[0_1px_1px_rgba(18,23,43,0.04)] hover:border-[#d6d0c2] hover:bg-surface-raised',
        outline: 'border border-border bg-transparent text-foreground hover:bg-surface hover:border-[#d6d0c2]',
        ghost: 'bg-transparent text-foreground hover:bg-surface',
        destructive: 'bg-danger text-danger-foreground hover:bg-danger/90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-[12.5px]',
        lg: 'h-11 px-6 text-[14.5px]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
