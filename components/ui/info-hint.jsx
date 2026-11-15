'use client';
import { useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// A small (i) that explains a number or a label in plain words. Unlike a tooltip it also
// opens on tap, so the explanations work on phones; on desktop it opens on hover/focus.
export function InfoHint({ children, label = 'What does this mean?', className, side = 'top', align = 'center' }) {
  const [open, setOpen] = useState(false);
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          // Hover only for real mice — a tap fires pointerenter too, and opening there would
          // let the click that follows immediately close it again.
          onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded p-0.5 align-middle text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            className
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-50 max-w-[18rem] rounded-md bg-background-alt px-3 py-2 text-xs normal-case leading-relaxed tracking-normal text-white/90 shadow-[0_12px_32px_-8px_rgba(13,18,38,0.5)]"
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
