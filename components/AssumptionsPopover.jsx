'use client';
import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { useSettings } from '@/lib/settingsContext';

// Every assumption behind the numbers, in one place, so nothing is a black box.
export default function AssumptionsPopover() {
  const { vehicle, tariff, chargerKW } = useSettings();
  const [open, setOpen] = useState(false);

  const rows = [
    ['Vehicle', vehicle.name || 'Custom'],
    ['Battery', `${vehicle.battery_kWh} kWh`],
    ['Empty weight', `${vehicle.m_empty.toLocaleString('en-IN')} kg`],
    ['Rolling resistance (Crr)', vehicle.Crr],
    ['Drag coefficient (Cd)', vehicle.Cd],
    ['Frontal area', `${vehicle.A} m²`],
    ['Drivetrain efficiency', `${Math.round(vehicle.eta_dt * 100)}%`],
    ['Energy recovered downhill', `${Math.round(vehicle.eta_regen * 100)}%`],
    ['AC and auxiliaries', `${vehicle.P_aux.toLocaleString('en-IN')} W`],
    ['Safety reserve', `${vehicle.reserve_pct}% of battery`],
    ['Max charging power', `${chargerKW} kW`],
    ['Default tariff', `₹${tariff}/kWh`],
  ];

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-1.5 text-left text-xs font-medium text-primary hover:underline"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Assumptions behind these numbers
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Assumptions"
          className="absolute bottom-full left-0 z-20 mb-2 w-[min(360px,90vw)] rounded-xl border border-border bg-surface p-4 shadow-[0_16px_40px_-12px_rgba(18,23,43,0.3)]"
        >
          <div className="mb-2 text-sm font-semibold text-foreground">What the model assumes</div>
          <table className="mb-3 w-full border-collapse text-xs">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-border">
                  <td className="py-1 text-muted-foreground">{label}</td>
                  <td className="tabular py-1 text-right font-semibold text-foreground">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Live data:</strong> the truck route and elevation (OpenRouteService),
            weather at four points along the route including wind direction and rain (Open-Meteo), and public
            chargers (Open Charge Map).
          </p>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">How sure is this?</strong> The vehicle figures above are estimates,
            not measured on a real truck, and the past-trip history used for the AI correction is simulated. That is
            why every result shows a bad-day to good-day range rather than a single promise. Connecting a real
            truck&apos;s battery and telematics data would narrow it. You can edit all of these in Settings.
          </p>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-raised"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
