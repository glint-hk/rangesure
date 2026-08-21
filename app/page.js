'use client';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import DriverView from '@/components/DriverView';
import FleetView from '@/components/FleetView';
import TripsView from '@/components/TripsView';
import ChargingView from '@/components/ChargingView';
import ReportsView from '@/components/ReportsView';
import SettingsView from '@/components/SettingsView';
import { SettingsProvider } from '@/lib/settingsContext';
import { TripHistoryProvider } from '@/lib/tripHistoryContext';

export default function Page() {
  const [active, setActive] = useState('plan');

  return (
    <SettingsProvider>
      <TripHistoryProvider>
        <div className="app-shell">
          <Sidebar active={active} onSelect={setActive} />
          <main className="main-content">
            {active === 'plan' && <DriverView />}
            {active === 'trips' && <TripsView />}
            {active === 'fleet' && <FleetView />}
            {active === 'charging' && <ChargingView />}
            {active === 'reports' && <ReportsView />}
            {active === 'settings' && <SettingsView />}
          </main>
        </div>
      </TripHistoryProvider>
    </SettingsProvider>
  );
}
