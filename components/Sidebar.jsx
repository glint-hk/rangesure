'use client';
import { Route, ShieldCheck, History, Truck, Zap, BarChart3, Settings, ArrowUpRight } from 'lucide-react';
import { BrandLockup, DYAUS_URL } from '@/components/BrandMark';
import { cn } from '@/lib/utils';

const NAV_GROUPS = [
  {
    label: 'Plan',
    items: [
      { key: 'plan', label: 'Plan Trip', icon: Route },
      { key: 'guarantee', label: 'Guarantee', icon: ShieldCheck },
    ],
  },
  {
    label: 'Operate',
    items: [
      { key: 'fleet', label: 'Fleet', icon: Truck },
      { key: 'charging', label: 'Charging', icon: Zap },
      { key: 'trips', label: 'Trips', icon: History },
      { key: 'reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Configure',
    items: [{ key: 'settings', label: 'Settings', icon: Settings }],
  },
];
const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function Sidebar({ active, onSelect }) {
  return (
    <>
      {/* Desktop sidebar — deep navy chrome with a gold active marker */}
      <nav className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col overflow-hidden bg-background-alt px-3 py-6 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(201,162,79,0.16),transparent_65%)]"
        />
        <BrandLockup tone="dark" className="relative mb-9 px-2.5" />

        <div className="relative flex flex-col gap-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 px-3 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/35">
                {group.label}
              </div>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.key;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => onSelect(item.key)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white',
                          isActive && 'bg-white/[0.08] text-white'
                        )}
                      >
                        {isActive && (
                          <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[#d4b066]" />
                        )}
                        <Icon
                          className={cn('h-[15px] w-[15px] shrink-0', isActive ? 'text-[#e2c47e]' : 'text-white/45')}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <a
          href={DYAUS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative mt-auto block rounded-lg border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[#c9a24f]/40"
        >
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[#d4b066]">AI proof of concept</div>
          <div className="mt-2 text-[12.5px] leading-relaxed text-white/75">
            Created by <span className="font-medium text-white">Hrishikesh Kumar</span> for{' '}
            <span className="font-medium text-white">Dyaus Advisory</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-white/45 group-hover:text-[#e2c47e]">
            dyausadvisory.live <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </div>
        </a>
      </nav>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-background-alt/95 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <BrandLockup compact tone="dark" />
        <a
          href={DYAUS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70"
        >
          Dyaus
        </a>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-background-alt/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[9.5px] font-medium text-white/50',
                isActive && 'text-white'
              )}
            >
              {isActive && <span className="absolute inset-x-3 top-0 h-[2px] rounded-b bg-[#d4b066]" />}
              <Icon
                className={cn('h-[18px] w-[18px]', isActive && 'text-[#e2c47e]')}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
