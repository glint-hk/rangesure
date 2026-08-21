'use client';
import { useState } from 'react';
import { VEHICLE, DEFAULT_TARIFF } from '@/config';

const ROWS = [
  ['Empty vehicle mass', `${VEHICLE.m_empty.toLocaleString()} kg`],
  ['Rolling resistance (Crr)', VEHICLE.Crr],
  ['Aerodynamic drag (Cd)', VEHICLE.Cd],
  ['Frontal area', `${VEHICLE.A} m²`],
  ['Drivetrain efficiency', `${Math.round(VEHICLE.eta_dt * 100)}%`],
  ['Regen recovery on descents', `${Math.round(VEHICLE.eta_regen * 100)}%`],
  ['HVAC/aux load', `${VEHICLE.P_aux.toLocaleString()} W`],
  ['Battery capacity', `${VEHICLE.battery_kWh} kWh`],
  ['Reserve buffer before "needs charge"', `${VEHICLE.reserve_pct}%`],
  ['Default tariff', `₹${DEFAULT_TARIFF}/kWh`],
];

export default function AssumptionsPopover() {
  const [open, setOpen] = useState(false);

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
              {ROWS.map(([label, value]) => (
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
            this band.
          </div>
          <button type="button" className="assumptions-close" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
