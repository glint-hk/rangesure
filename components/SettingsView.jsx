'use client';
import { useEffect, useState } from 'react';
import { VEHICLES } from '@/config';
import { useSettings } from '@/lib/settingsContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InfoHint } from '@/components/ui/info-hint';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

// min/max guard the physics model's divisors (eta_dt, battery_kWh) from 0 or negative
// values, which would produce Infinity/NaN. Clamped on blur, not on every keystroke.
const VEHICLE_FIELDS = [
  { key: 'battery_kWh', label: 'Battery capacity (kWh)', step: 5, min: 1, hint: 'Usable battery energy. Sets range and how much charge each % represents.' },
  { key: 'm_empty', label: 'Empty weight (kg)', step: 100, min: 0, hint: 'The truck without cargo. The load you enter on Plan Trip is added to this.' },
  { key: 'Crr', label: 'Rolling resistance (Crr)', step: 0.001, min: 0, hint: 'Tyre-on-road friction. Typical truck tyres are 0.005–0.009. Raised automatically on wet roads.' },
  { key: 'Cd', label: 'Drag coefficient (Cd)', step: 0.01, min: 0, hint: 'How aerodynamic the body is. Box trucks are usually 0.6–0.8.' },
  { key: 'A', label: 'Frontal area (m²)', step: 0.1, min: 0.1, hint: 'Width × height of the truck front. Drag scales with this.' },
  { key: 'eta_dt', label: 'Drivetrain efficiency (0–1)', step: 0.01, min: 0.01, max: 1, hint: 'Share of battery energy that reaches the wheels. 0.85 means 15% is lost in motor and gearbox.' },
  { key: 'eta_regen', label: 'Energy recovered downhill (0–1)', step: 0.01, min: 0, max: 1, hint: 'Share of downhill energy that regenerative braking puts back into the battery.' },
  { key: 'P_aux', label: 'AC and auxiliaries (W)', step: 100, min: 0, hint: 'Constant power for cabin AC and on-board systems on a mild day. Scaled up automatically in heat or cold.' },
  { key: 'reserve_pct', label: 'Safety reserve (%)', step: 1, min: 0, max: 100, hint: 'Battery that must remain on arrival. Any trip that would dip below this needs a charging stop.' },
];

function clamp(value, field) {
  let v = value;
  if (field.min != null) v = Math.max(field.min, v);
  if (field.max != null) v = Math.min(field.max, v);
  return v;
}

const INPUT_CLASS =
  'h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-[13.5px] text-foreground shadow-[0_1px_1px_rgba(18,23,43,0.03)] outline-none transition-colors hover:border-[#d6d0c2] focus:border-accent/60 focus:ring-2 focus:ring-accent/20';

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px] font-medium text-foreground">
      <span className="flex items-center gap-1">
        {label}
        {hint && <InfoHint label={`About ${label}`}>{hint}</InfoHint>}
      </span>
      {children}
    </label>
  );
}

function Section({ title, description, children }) {
  return (
    <Card className="mb-4 p-5">
      <h3 className="font-display text-[20px] font-semibold text-foreground">{title}</h3>
      {description && <p className="mb-4 mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Card>
  );
}

export default function SettingsView() {
  const {
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
  } = useSettings();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, [saved]);

  const preset = VEHICLES.find((v) => v.name === vehicle.name);
  const edited = preset ? VEHICLE_FIELDS.some((f) => f.key !== 'reserve_pct' && preset[f.key] !== vehicle[f.key]) : false;

  const handleFieldChange = (key, value) => {
    const n = Number(value);
    if (Number.isNaN(n)) return; // ignore transient states like "-" or "" while typing
    updateVehicle({ [key]: n });
  };

  const handleFieldBlur = (field) => {
    const n = Number(vehicle[field.key]);
    updateVehicle({ [field.key]: Number.isNaN(n) ? field.min ?? 0 : clamp(n, field) });
    setSaved(true);
  };

  const numberSetter = (setter, min) => ({
    onChange: (e) => {
      const n = Number(e.target.value);
      if (!Number.isNaN(n)) setter(n);
    },
    onBlur: () => {
      setter((v) => Math.max(min, Number.isNaN(v) ? min : v));
      setSaved(true);
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h2 className="font-display text-[30px] font-semibold leading-tight text-foreground">Settings</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          The assumptions behind every calculation. Changes apply straight away on Plan Trip, Fleet and Guarantee, and
          are saved in this browser only.
        </p>
      </div>

      <Section
        title="Vehicle"
        description="Pick a vehicle, then fine-tune its physics if you have better figures. Edits change the selected vehicle until you reset."
      >
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Vehicle being edited">
            <Select
              value={vehicle.name}
              onValueChange={(name) => {
                selectVehicle(name);
                setSaved(true);
              }}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLES.map((v) => (
                  <SelectItem key={v.name} value={v.name}>
                    {v.name} · {v.battery_kWh} kWh · up to {v.payload_max_kg.toLocaleString('en-IN')} kg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {edited && (
            <p className="mt-2 text-xs text-warning">
              You&apos;ve changed some of this vehicle&apos;s figures from its defaults. Choose it again in the list
              above to restore them.
            </p>
          )}
        </div>
        {VEHICLE_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <input
              type="number"
              step={f.step}
              min={f.min}
              max={f.max}
              value={vehicle[f.key]}
              onChange={(e) => handleFieldChange(f.key, e.target.value)}
              onBlur={() => handleFieldBlur(f)}
              className={INPUT_CLASS}
            />
          </Field>
        ))}
      </Section>

      <Section title="Electricity and charging">
        <Field label="Default tariff (₹/kWh)" hint="What you pay per kWh. Used as the starting tariff on Plan Trip and for every Fleet route.">
          <input type="number" step={0.1} min={0} value={tariff} className={INPUT_CLASS} {...numberSetter(setTariff, 0)} />
        </Field>
        <Field
          label="Max charging power (kW)"
          hint="The fastest the truck itself can charge. A stop uses the lower of this and the station's own rating, and slows above 80%."
        >
          <input type="number" step={10} min={1} value={chargerKW} className={INPUT_CLASS} {...numberSetter(setChargerKW, 1)} />
        </Field>
      </Section>

      <Section title="Guarantee pricing" description="Used only by the Guarantee page and the Fleet guarantee book.">
        <Field label="Operator margin (%)" hint="Added on top of expected energy cost plus risk buffer.">
          <input
            type="number"
            step={1}
            min={0}
            value={Math.round(margin * 100)}
            className={INPUT_CLASS}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) setMargin(n / 100);
            }}
            onBlur={() => {
              setMargin((m) => Math.max(0, Number.isNaN(m) ? 0 : m));
              setSaved(true);
            }}
          />
        </Field>
        <Field
          label="Cost of a missed promise (₹/km)"
          hint="What the operator expects to pay out per km on the rare trips where real energy cost goes over the guaranteed price."
        >
          <input type="number" step={0.1} min={0} value={disruptionCostPerKm} className={INPUT_CLASS} {...numberSetter(setDisruptionCostPerKm, 0)} />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (window.confirm('Reset every setting to its default?')) {
              resetDefaults();
              setSaved(true);
            }
          }}
        >
          Reset everything to defaults
        </Button>
        <span aria-live="polite" className="text-sm font-semibold text-success">
          {saved ? 'Saved' : ''}
        </span>
      </div>
    </div>
  );
}
