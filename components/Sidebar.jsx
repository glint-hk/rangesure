'use client';
import { Route, ShieldCheck, History, Truck, Zap, BarChart3, Settings } from 'lucide-react';
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
      <nav className="hidden w-60 shrink-0 flex-col border-r border-border bg-background-alt px-3 py-6 lg:flex">
        <div className="mb-6 px-3">
          <div className="text-[15px] font-bold text-foreground">Tata RangeSure</div>
          <div className="text-[11px] font-medium text-muted-foreground">EV Trip Planner</div>
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
      </nav>

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
