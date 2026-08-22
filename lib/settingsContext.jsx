'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { VEHICLES, SHARED_PARAMS, DEFAULT_VEHICLE, DEFAULT_TARIFF, DEFAULT_CHARGER_KW } from '@/config';

// v2: bumped when VEHICLE became the VEHICLES preset array (P0-2) — v1 payloads lack
// `name`/`payload_max_kg` and would leave a stale shape merged into the new defaults.
const STORAGE_KEY = 'rangesure-settings-v2';
const SettingsContext = createContext(null);

// Vehicle params + default tariff, editable on the Settings page and used live by
// Plan Trip and Fleet. Persisted per-browser via localStorage; falls back to the
// config.js defaults if storage is empty, blocked, or corrupt.
export function SettingsProvider({ children }) {
  const [vehicle, setVehicle] = useState(DEFAULT_VEHICLE);
  const [tariff, setTariff] = useState(DEFAULT_TARIFF);
  const [chargerKW, setChargerKW] = useState(DEFAULT_CHARGER_KW);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.vehicle) setVehicle({ ...DEFAULT_VEHICLE, ...parsed.vehicle });
        if (typeof parsed.tariff === 'number') setTariff(parsed.tariff);
        if (typeof parsed.chargerKW === 'number') setChargerKW(parsed.chargerKW);
      }
    } catch {
      // corrupt or blocked storage — keep defaults
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ vehicle, tariff, chargerKW }));
    } catch {
      // storage unavailable — settings just won't persist across reloads
    }
  }, [vehicle, tariff, chargerKW, loaded]);

  // Manual nudge of the current vehicle's params (Settings page sliders) — keeps
  // whichever preset name is already selected.
  const updateVehicle = (patch) => setVehicle((v) => ({ ...v, ...patch }));

  // Swaps in a whole preset from VEHICLES by name, replacing every physics param —
  // distinct from updateVehicle, which only nudges the current preset's numbers.
  const selectVehicle = (name) => {
    const preset = VEHICLES.find((v) => v.name === name);
    if (preset) setVehicle({ ...SHARED_PARAMS, ...preset });
  };

  const resetDefaults = () => {
    setVehicle(DEFAULT_VEHICLE);
    setTariff(DEFAULT_TARIFF);
    setChargerKW(DEFAULT_CHARGER_KW);
  };

  return (
    <SettingsContext.Provider
      value={{ vehicle, tariff, setTariff, chargerKW, setChargerKW, updateVehicle, selectVehicle, resetDefaults }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
