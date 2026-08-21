// Default vehicle parameters and tariff. These are synthetic-but-realistic assumptions,
// shown to the user in the Assumptions/limitations note — not hidden.
//
// CALIBRATION: Cd, Crr, P_aux and eta_regen are the knobs to nudge if the live Mumbai->Pune
// reference trip (see HERO_PRESET in DriverView.jsx) drifts from ~1.06 kWh/km — the real
// live baseline for ORS's driving-hgv route (165 km via the old ghat road), recalibrated
// from the deck's original 148 km / 0.82 kWh/km expressway assumption. Nudge one at a
// time and re-check the console.log output.
export const VEHICLE = {
  m_empty: 8000, // kg (medium e-truck, empty). Loaded mass = m_empty + payloadKg.
  Crr: 0.007, // CALIBRATION: rolling resistance coefficient
  Cd: 0.7, // CALIBRATION: aerodynamic drag coefficient
  A: 9, // frontal area, m^2
  rho: 1.2, // air density, kg/m^3
  eta_dt: 0.85, // drivetrain efficiency
  eta_regen: 0.6, // CALIBRATION: fraction of downhill energy recovered
  P_aux: 3000, // CALIBRATION: baseline HVAC/aux load, W
  battery_kWh: 200,
  g: 9.81,
  reserve_pct: 10, // minimum arrival SOC to call a trip feasible without a charging stop
};

export const DEFAULT_TARIFF = 8.5; // ₹/kWh (assumption)
