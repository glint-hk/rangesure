'use client';
import { useEffect, useState } from 'react';
import { useSettings } from '@/lib/settingsContext';

// min/max guard the physics model's divisors (eta_dt, battery_kWh) from being set to
// 0 or negative, which would produce Infinity/NaN throughout the app. Clamped on blur,
// not on every keystroke, so typing "0.85" doesn't get fought mid-edit.
const FIELDS = [
  { key: 'm_empty', label: 'Empty vehicle mass (kg)', step: 100, min: 0 },
  { key: 'Crr', label: 'Rolling resistance (Crr)', step: 0.001, min: 0 },
  { key: 'Cd', label: 'Aerodynamic drag (Cd)', step: 0.01, min: 0 },
  { key: 'A', label: 'Frontal area (m²)', step: 0.1, min: 0.1 },
  { key: 'eta_dt', label: 'Drivetrain efficiency (0–1)', step: 0.01, min: 0.01, max: 1 },
  { key: 'eta_regen', label: 'Regen recovery on descents (0–1)', step: 0.01, min: 0, max: 1 },
  { key: 'P_aux', label: 'HVAC/aux load (W)', step: 100, min: 0 },
  { key: 'battery_kWh', label: 'Battery capacity (kWh)', step: 5, min: 1 },
  { key: 'reserve_pct', label: 'Reserve buffer before "needs charge" (%)', step: 1, min: 0, max: 100 },
];

function clamp(value, field) {
  let v = value;
  if (field.min != null) v = Math.max(field.min, v);
  if (field.max != null) v = Math.min(field.max, v);
  return v;
}

export default function SettingsView() {
  const { vehicle, tariff, setTariff, updateVehicle, resetDefaults } = useSettings();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, [saved]);

  const handleFieldChange = (key, value) => {
    const n = Number(value);
    if (Number.isNaN(n)) return; // ignore transient states like "-" or "" while typing
    updateVehicle({ [key]: n });
  };

  const handleFieldBlur = (field) => {
    const n = Number(vehicle[field.key]);
    if (Number.isNaN(n)) {
      updateVehicle({ [field.key]: field.min ?? 0 });
    } else {
      updateVehicle({ [field.key]: clamp(n, field) });
    }
    setSaved(true);
  };

  return (
    <div className="settings-view">
      <h2>Vehicle & pricing settings</h2>
      <p className="settings-hint">
        These feed the physics model on every Plan Trip calculation and Fleet run — changes apply
        immediately and are saved in this browser only.
      </p>
      <div className="settings-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="settings-field">
            {f.label}
            <input
              type="number"
              step={f.step}
              min={f.min}
              max={f.max}
              value={vehicle[f.key]}
              onChange={(e) => handleFieldChange(f.key, e.target.value)}
              onBlur={() => handleFieldBlur(f)}
            />
          </label>
        ))}
        <label className="settings-field">
          Default tariff (₹/kWh)
          <input
            type="number"
            step={0.1}
            min={0}
            value={tariff}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) setTariff(n);
            }}
            onBlur={() => {
              setTariff((t) => Math.max(0, Number.isNaN(t) ? 0 : t));
              setSaved(true);
            }}
          />
        </label>
      </div>
      <div className="settings-actions">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            resetDefaults();
            setSaved(true);
          }}
        >
          Reset to defaults
        </button>
        {saved && <span className="settings-saved">Saved</span>}
      </div>
    </div>
  );
}
