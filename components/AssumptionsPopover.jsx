'use client';
import { useState } from 'react';
import { useSettings } from '@/lib/settingsContext';

export default function AssumptionsPopover() {
  const { vehicle, tariff } = useSettings();
  const [open, setOpen] = useState(false);

  const rows = [
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
    <div className="assumptions-wrap">
      <button
        type="button"
        className="assumptions-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="info-icon" aria-hidden="true">i</span>
        Prototype uses assumed vehicle parameters; live BMS calibration required before deployment.
      </button>
      {open && (
        <div className="assumptions-popover" role="dialog" aria-label="Assumptions">
          <div className="assumptions-title">Vehicle & pricing assumptions</div>
          <table className="assumptions-table">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="assumptions-note">
            <strong>Why 85–91% confidence:</strong> route distance and elevation come from live
            data, but payload aerodynamics, HVAC load, and battery health above are synthetic
            assumptions, not measured. Connecting live BMS and fleet telematics would narrow
            this band. Editable on the Settings page.
          </div>
          <button type="button" className="assumptions-close" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
