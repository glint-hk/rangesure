'use client';
import { useState } from 'react';
import { Info } from 'lucide-react';
import { useSettings } from '@/lib/settingsContext';

export default function AssumptionsPopover() {
  const { vehicle, tariff } = useSettings();
  const [open, setOpen] = useState(false);

  const rows = [
    ['Vehicle', vehicle.name || 'Custom'],
    ['Empty vehicle mass', `${vehicle.m_empty.toLocaleString()} kg`],
    ['Rolling resistance (Crr)', vehicle.Crr],
    ['Aerodynamic drag (Cd)', vehicle.Cd],
    ['Frontal area', `${vehicle.A} m²`],
    ['Drivetrain efficiency', `${Math.round(vehicle.eta_dt * 100)}%`],
    ['Regen recovery on descents', `${Math.round(vehicle.eta_regen * 100)}%`],
    ['HVAC/aux load', `${vehicle.P_aux.toLocaleString()} W`],
    ['Battery capacity', `${vehicle.battery_kWh} kWh`],
    ['Reserve buffer before "needs charge"', `${vehicle.reserve_pct}%`],
    ['Default tariff', `₹${tariff}/kWh`],
  ];

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-1.5 text-left text-xs italic text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Prototype uses assumed vehicle parameters; live BMS calibration required before deployment.
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Assumptions"
          className="absolute bottom-full left-0 z-10 mb-2 w-[min(340px,90vw)] rounded-xl border border-border bg-surface-raised p-4 shadow-2xl"
        >
          <div className="mb-2 text-sm font-semibold text-foreground">Vehicle &amp; pricing assumptions</div>
          <table className="mb-2.5 w-full border-collapse text-xs">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-border">
                  <td className="py-1 text-muted-foreground">{label}</td>
                  <td className="py-1 text-right font-semibold text-foreground">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Why 85–91% confidence:</strong> route distance and
            elevation come from live data, but payload aerodynamics, HVAC load, and battery health
            above are synthetic assumptions, not measured. Connecting live BMS and fleet
            telematics would narrow this band. Editable on the Settings page.
          </p>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
