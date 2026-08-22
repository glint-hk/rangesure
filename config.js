// Real Tata electric-truck presets. Battery/GVW/payload/range come from Tata Motors CV
// and Auto Expo 2025 / 2026 delivery-release specs (see the upgrade doc's spec table).
// Physics params (Crr, Cd, A, eta_dt, eta_regen, P_aux) are NOT published — they're
// engineering estimates for a box truck / tractor of that class, scaled from the
// original medium-e-truck baseline. Shown to the user via the Assumptions popover,
// never hidden.
//
// CALIBRATION: for the demo-default Ultra E.9, Crr/Cd/P_aux/eta_regen are the knobs to
// nudge if the live Mumbai->Pune reference trip (see HERO_PRESET in DriverView.jsx)
// drifts from ~1.06 kWh/km — the real live baseline for ORS's driving-hgv route (165 km
// via the old ghat road). Nudge one at a time and re-check the console.log output.
export const VEHICLES = [
  {
    name: 'Ace EV',
    battery_kWh: 24, // ~21-27 kWh published range, midpoint used
    gvw_kg: 1500,
    payload_max_kg: 750,
    claimed_range_km: 150,
    m_empty: 750, // kg, empty vehicle mass = gvw - payload_max
    Crr: 0.009, // engineering estimate — small last-mile van
    Cd: 0.55, // engineering estimate
    A: 3.2, // frontal area, m^2 — engineering estimate
    eta_dt: 0.88,
    eta_regen: 0.55,
    P_aux: 800, // W — engineering estimate
  },
  {
    name: 'Ultra E.9',
    battery_kWh: 200, // ~200 kWh (est)
    gvw_kg: 11000,
    payload_max_kg: 4000,
    claimed_range_km: 230,
    m_empty: 8000, // kg (medium e-truck, empty)
    Crr: 0.007, // CALIBRATION: rolling resistance coefficient
    Cd: 0.7, // CALIBRATION: aerodynamic drag coefficient
    A: 9, // frontal area, m^2 — engineering estimate
    eta_dt: 0.85,
    eta_regen: 0.6, // CALIBRATION: fraction of downhill energy recovered
    P_aux: 3000, // CALIBRATION: baseline HVAC/aux load, W
  },
  {
    name: 'Prima E.28K',
    battery_kWh: 453,
    gvw_kg: 28000,
    payload_max_kg: 18000, // GVW minus an estimated ~10t empty mass — not separately published
    claimed_range_km: 220,
    m_empty: 10000, // kg — engineering estimate for a 28t-GVW rigid
    Crr: 0.0065, // engineering estimate — heavier tyres, similar rolling resistance class
    Cd: 0.65, // engineering estimate — more aero-optimized hub-to-hub design
    A: 10, // frontal area, m^2 — engineering estimate
    eta_dt: 0.86,
    eta_regen: 0.6,
    P_aux: 3500, // W — engineering estimate
  },
  {
    name: 'Prima E.55S',
    battery_kWh: 450,
    gvw_kg: 55000,
    payload_max_kg: 38000,
    claimed_range_km: 350,
    m_empty: 17000, // kg — engineering estimate, 55t-GVW tractor
    Crr: 0.006, // engineering estimate — long-haul tractor tyres
    Cd: 0.6, // engineering estimate — best-in-class aero for a 55t tractor
    A: 10.5, // frontal area, m^2 — engineering estimate
    eta_dt: 0.87,
    eta_regen: 0.62,
    P_aux: 4000, // W — engineering estimate
  },
];

// Shared physics constants, independent of the selected vehicle preset.
export const SHARED_PARAMS = {
  rho: 1.2, // air density, kg/m^3
  g: 9.81,
  reserve_pct: 10, // minimum arrival SOC to call a trip feasible without a charging stop
};

// Demo default matches board slide 9 (4,000 kg payload, ~230 km range, ~200 kWh).
export const DEFAULT_VEHICLE = { ...SHARED_PARAMS, ...VEHICLES.find((v) => v.name === 'Ultra E.9') };

export const DEFAULT_TARIFF = 8.5; // ₹/kWh (assumption)

export const DEFAULT_CHARGER_KW = 120; // DC fast-charge power assumption, ₹/kWh unrelated
