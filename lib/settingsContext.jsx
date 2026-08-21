'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { VEHICLE as DEFAULT_VEHICLE, DEFAULT_TARIFF } from '@/config';

const STORAGE_KEY = 'rangesure-settings-v1';
const SettingsContext = createContext(null);

// Vehicle params + default tariff, editable on the Settings page and used live by
// Plan Trip and Fleet. Persisted per-browser via localStorage; falls back to the
// config.js defaults if storage is empty, blocked, or corrupt.
export function SettingsProvider({ children }) {
  const [vehicle, setVehicle] = useState(DEFAULT_VEHICLE);
  const [tariff, setTariff] = useState(DEFAULT_TARIFF);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.vehicle) setVehicle({ ...DEFAULT_VEHICLE, ...parsed.vehicle });
        if (typeof parsed.tariff === 'number') setTariff(parsed.tariff);
      }
    } catch {
      // corrupt or blocked storage — keep defaults
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ vehicle, tariff }));
    } catch {
      // storage unavailable — settings just won't persist across reloads
    }
  }, [vehicle, tariff, loaded]);

  const updateVehicle = (patch) => setVehicle((v) => ({ ...v, ...patch }));
  const resetDefaults = () => {
    setVehicle(DEFAULT_VEHICLE);
    setTariff(DEFAULT_TARIFF);
  };

  return (
    <SettingsContext.Provider value={{ vehicle, tariff, setTariff, updateVehicle, resetDefaults }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
