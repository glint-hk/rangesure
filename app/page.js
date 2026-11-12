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

export default function Page() {
  const [active, setActive] = useState('plan');

  return (
    <SettingsProvider>
      <TripHistoryProvider>
        <LastTripProvider>
          <div className="flex min-h-screen bg-background">
            <Sidebar active={active} onSelect={setActive} />
            <main className="min-w-0 flex-1 overflow-x-hidden px-4 pb-24 pt-20 sm:px-6 lg:pb-6 lg:pt-6">
              {active === 'plan' && <DriverView />}
              {active === 'guarantee' && <GuaranteeView />}
              {active === 'trips' && <TripsView />}
              {active === 'fleet' && <FleetView />}
              {active === 'charging' && <ChargingView />}
              {active === 'reports' && <ReportsView />}
              {active === 'settings' && <SettingsView />}
              <AppFooter />
            </main>
          </div>
        </LastTripProvider>
      </TripHistoryProvider>
    </SettingsProvider>
  );
}
