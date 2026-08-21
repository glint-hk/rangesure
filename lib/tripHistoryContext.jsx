'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'rangesure-trip-history-v1';
const MAX_TRIPS = 50;
const TripHistoryContext = createContext(null);

// Log of trips calculated on Plan Trip (not Fleet runs — those are their own snapshot
// view). Persisted per-browser via localStorage so it survives a reload, and feeds
// both the Trips and Reports pages.
export function TripHistoryProvider({ children }) {
  const [trips, setTrips] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setTrips(JSON.parse(raw));
    } catch {
      // corrupt or blocked storage — start empty
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    } catch {
      // storage unavailable — history just won't persist across reloads
    }
  }, [trips, loaded]);

  const addTrip = (trip) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ...trip,
    };
    setTrips((prev) => [entry, ...prev].slice(0, MAX_TRIPS));
  };
  const clearHistory = () => setTrips([]);

  return (
    <TripHistoryContext.Provider value={{ trips, addTrip, clearHistory }}>
      {children}
    </TripHistoryContext.Provider>
  );
}

export function useTripHistory() {
  const ctx = useContext(TripHistoryContext);
  if (!ctx) throw new Error('useTripHistory must be used within TripHistoryProvider');
  return ctx;
}
