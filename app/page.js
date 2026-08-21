'use client';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import DriverView from '@/components/DriverView';
import FleetView from '@/components/FleetView';

export default function Page() {
  const [active, setActive] = useState('plan');

  return (
    <div className="app-shell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="main-content">
        {active === 'plan' && <DriverView />}
        {active === 'fleet' && <FleetView />}
      </main>
    </div>
  );
}
