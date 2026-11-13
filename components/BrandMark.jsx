import { useId } from 'react';
import { cn } from '@/lib/utils';

// Dyaus RangeSure mark: a gold route arc climbing to a destination point inside a deep
// navy tile with a hairline gold edge — "the route, and the certainty of finishing it".
export function BrandMark({ className }) {
  // Unique per instance: a shared gradient id breaks when the first copy sits in a
  // display:none container (e.g. the desktop sidebar on mobile).
  const uid = useId().replace(/:/g, '');
  const tile = `rs-tile-${uid}`;
  const gold = `rs-gold-${uid}`;
  return (
    <svg viewBox="0 0 32 32" className={cn('h-9 w-9 shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f2a5c" />
          <stop offset="1" stopColor="#0b1022" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#c9a24f" />
          <stop offset="1" stopColor="#f1d79a" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill={`url(#${tile})`} stroke="#c9a24f" strokeOpacity="0.45" />
      <path d="M7.5 23.5c4.5 0 4-6.5 8.5-6.5s4-6.5 8.5-6.5" fill="none" stroke={`url(#${gold})`} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="7.5" cy="23.5" r="1.9" fill="#ffffff" fillOpacity="0.9" />
      <circle cx="24.5" cy="10.5" r="3" fill="#f1d79a" />
      <circle cx="24.5" cy="10.5" r="1.2" fill="#0b1022" />
    </svg>
  );
}

// Full lockup: mark + product name + "by Dyaus Advisory". `tone="dark"` for the navy chrome.
export function BrandLockup({ className, compact = false, tone = 'light' }) {
  const dark = tone === 'dark';
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark className={compact ? 'h-8 w-8' : undefined} />
      <div className="leading-none">
        <div className={cn('font-display text-[19px] font-semibold tracking-[-0.01em]', dark ? 'text-white' : 'text-foreground')}>
          Dyaus <span className={dark ? 'text-[#e2c47e]' : 'text-accent'}>RangeSure</span>
        </div>
        <div
          className={cn(
            'mt-1 text-[9.5px] font-semibold uppercase tracking-[0.2em]',
            dark ? 'text-white/45' : 'text-muted-foreground'
          )}
        >
          by Dyaus Advisory
        </div>
      </div>
    </div>
  );
}

export const DYAUS_URL = 'https://dyausadvisory.live';
export const CREDIT_LINE = 'Created by Hrishikesh Kumar for Dyaus Advisory';
