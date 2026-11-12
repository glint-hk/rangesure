import { useId } from 'react';
import { cn } from '@/lib/utils';

// Dyaus RangeSure logo mark: a route line climbing to a destination pin inside a
// rounded tile, with a small charge bolt — "the route, and the energy to finish it".
export function BrandMark({ className }) {
  // Unique per instance: a shared gradient id breaks when the first copy sits in a
  // display:none container (e.g. the desktop sidebar on mobile).
  const gid = `rs-tile-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 32 32" className={cn('h-9 w-9 shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
      <path
        d="M7 24c4 0 4-6 8-6s4-7 9-7"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="7" cy="24" r="2.2" fill="#fff" />
      <circle cx="24" cy="11" r="3.2" fill="#fbbf24" />
      <path d="M24.6 8.6l-2 2.8h1.6l-.8 2.2 2-2.8h-1.6z" fill="#1e3a8a" />
    </svg>
  );
}

// Full lockup: mark + product name + "by Dyaus Advisory".
export function BrandLockup({ className, compact = false }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className={compact ? 'h-8 w-8' : undefined} />
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight text-foreground">
          Dyaus <span className="text-primary">RangeSure</span>
        </div>
        <div className="text-[11px] font-medium text-muted-foreground">by Dyaus Advisory</div>
      </div>
    </div>
  );
}

export const DYAUS_URL = 'https://dyausadvisory.live';
export const CREDIT_LINE = 'Created by Hrishikesh Kumar for Dyaus Advisory';
