'use client';
import { Route, ShieldCheck, History, Truck, Zap, BarChart3, Settings, ArrowUpRight } from 'lucide-react';
import { BrandLockup, DYAUS_URL } from '@/components/BrandMark';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { key: 'plan', label: 'Plan Trip', icon: Route },
  { key: 'guarantee', label: 'Guarantee', icon: ShieldCheck },
  { key: 'trips', label: 'Trips', icon: History },
  { key: 'fleet', label: 'Fleet', icon: Truck },
  { key: 'charging', label: 'Charging', icon: Zap },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ active, onSelect }) {
  return (
    <>
      {/* Desktop sidebar */}
      <nav className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-background-alt px-3 py-6 lg:flex">
        <BrandLockup className="mb-8 px-3" />
        <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
          Workspace
        </div>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground',
                    isActive && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
        <a
          href={DYAUS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-auto block rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-primary/40"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            AI proof of concept
          </div>
          <div className="mt-1.5 text-xs leading-relaxed text-foreground">
            Created by <span className="font-semibold">Hrishikesh Kumar</span> for{' '}
            <span className="font-semibold">Dyaus Advisory</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-muted-foreground group-hover:text-primary">
            dyausadvisory.live <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </div>
        </a>
      </nav>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border bg-background-alt/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <BrandLockup compact />
        <a
          href={DYAUS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-muted-foreground"
        >
          Dyaus Advisory
        </a>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background-alt/95 backdrop-blur lg:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground',
                isActive && 'text-primary'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
