'use client';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import DriverView from '@/components/DriverView';
import FleetView from '@/components/FleetView';
import TripsView from '@/components/TripsView';
import ChargingView from '@/components/ChargingView';
import ReportsView from '@/components/ReportsView';
import SettingsView from '@/components/SettingsView';
import GuaranteeView from '@/components/GuaranteeView';
import { SettingsProvider } from '@/lib/settingsContext';
import { TripHistoryProvider } from '@/lib/tripHistoryContext';
import { LastTripProvider } from '@/lib/lastTripContext';
import AppFooter from '@/components/AppFooter';

const VIEWS = [
  { key: 'plan', Component: DriverView },
  { key: 'guarantee', Component: GuaranteeView },
  { key: 'trips', Component: TripsView },
  { key: 'fleet', Component: FleetView },
  { key: 'charging', Component: ChargingView },
  { key: 'reports', Component: ReportsView },
  { key: 'settings', Component: SettingsView },
];

export default function Page() {
  const [active, setActive] = useState('plan');
  const select = (key) => {
    setActive(key);
    window.scrollTo({ top: 0 });
  };

  return (
    <SettingsProvider>
      <TripHistoryProvider>
        <LastTripProvider>
          <div className="flex min-h-screen bg-background">
            <Sidebar active={active} onSelect={select} />
            <main className="min-w-0 flex-1 overflow-x-hidden px-4 pb-24 pt-20 sm:px-6 lg:pb-6 lg:pt-6">
              {/* Every view stays mounted and is only hidden, so a planned trip, a fleet run or
                  a charger search survives switching tabs and coming back. */}
              {VIEWS.map(({ key, Component }) => (
                <section key={key} hidden={active !== key} aria-hidden={active !== key}>
                  <Component onNavigate={select} active={active === key} />
                </section>
              ))}
              <AppFooter />
            </main>
          </div>
        </LastTripProvider>
      </TripHistoryProvider>
    </SettingsProvider>
  );
}
