'use client';
import { createContext, useContext, useState } from 'react';

const LastTripContext = createContext(null);

// The most recently computed Plan Trip result, reduced to just what the Guarantee view
// (G2) and the cohort-anomaly banner (G4) need: origin/destination for the corridor
// lookup, and the calibrated best/expected/worst kWh/km band Plan Trip already
// computed. Session-only (not persisted) — the Guarantee view is explicitly "runs
// AFTER a trip is computed," not a standalone calculator.
export function LastTripProvider({ children }) {
  const [lastTrip, setLastTrip] = useState(null);
  return (
    <LastTripContext.Provider value={{ lastTrip, setLastTrip }}>{children}</LastTripContext.Provider>
  );
}

export function useLastTrip() {
  const ctx = useContext(LastTripContext);
  if (!ctx) throw new Error('useLastTrip must be used within LastTripProvider');
  return ctx;
}
