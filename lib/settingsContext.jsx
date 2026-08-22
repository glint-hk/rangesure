'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  VEHICLES,
  SHARED_PARAMS,
  DEFAULT_VEHICLE,
  DEFAULT_TARIFF,
  DEFAULT_CHARGER_KW,
  DEFAULT_MARGIN,
  DEFAULT_DISRUPTION_COST_PER_KM,
} from '@/config';

// v3: bumped when the Route Guarantee margin/disruption-cost assumptions were added —
// older payloads simply lack those keys and fall back to the config.js defaults below.
const STORAGE_KEY = 'rangesure-settings-v3';
const SettingsContext = createContext(null);

// Vehicle params + default tariff, editable on the Settings page and used live by
// Plan Trip and Fleet. Persisted per-browser via localStorage; falls back to the
// config.js defaults if storage is empty, blocked, or corrupt.
export function SettingsProvider({ children }) {
  const [vehicle, setVehicle] = useState(DEFAULT_VEHICLE);
  const [tariff, setTariff] = useState(DEFAULT_TARIFF);
  const [chargerKW, setChargerKW] = useState(DEFAULT_CHARGER_KW);
  const [margin, setMargin] = useState(DEFAULT_MARGIN);
  const [disruptionCostPerKm, setDisruptionCostPerKm] = useState(DEFAULT_DISRUPTION_COST_PER_KM);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.vehicle) setVehicle({ ...DEFAULT_VEHICLE, ...parsed.vehicle });
        if (typeof parsed.tariff === 'number') setTariff(parsed.tariff);
        if (typeof parsed.chargerKW === 'number') setChargerKW(parsed.chargerKW);
        if (typeof parsed.margin === 'number') setMargin(parsed.margin);
        if (typeof parsed.disruptionCostPerKm === 'number') setDisruptionCostPerKm(parsed.disruptionCostPerKm);
      }
    } catch {
      // corrupt or blocked storage — keep defaults
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ vehicle, tariff, chargerKW, margin, disruptionCostPerKm })
      );
    } catch {
      // storage unavailable — settings just won't persist across reloads
    }
  }, [vehicle, tariff, chargerKW, margin, disruptionCostPerKm, loaded]);

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
    setMargin(DEFAULT_MARGIN);
    setDisruptionCostPerKm(DEFAULT_DISRUPTION_COST_PER_KM);
  };

  return (
    <SettingsContext.Provider
      value={{
        vehicle,
        tariff,
        setTariff,
        chargerKW,
        setChargerKW,
        margin,
        setMargin,
        disruptionCostPerKm,
        setDisruptionCostPerKm,
        updateVehicle,
        selectVehicle,
        resetDefaults,
      }}
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
