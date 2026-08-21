# Project: Tata RangeSure — EV Truck Range Optimizer

MBA AI-transformation capstone demo. Judged on: problem-solution fit, a genuine AI capability,
live deployment, and usability by a NON-technical person. The authoritative spec is
`../DTAI_RangeSure_Build_Prompts.md` (repo root's parent) — the board deck has committed to
specific numbers there; the app must reproduce them on the reference trip.

## Stack
- Next.js App Router, JavaScript (NOT TypeScript). Plain CSS. Deployed on Vercel.
- Map: react-leaflet + OpenStreetMap tiles. Leaflet touches `window`, so RouteMap.jsx
  MUST be dynamically imported with { ssr: false } and only rendered on the client.
- ALL external APIs are called from server route handlers in app/api/* — never from the browser:
  - OpenRouteService (routing/elevation/geocoding, profile `driving-hgv`) -> app/api/route
  - Open-Meteo (weather, keyless)                                        -> app/api/weather
  - Open Charge Map (chargers)                                           -> app/api/charging
  - Google Gemini (LLM driver guidance, model `gemini-2.5-flash`)        -> app/api/guidance
- Env vars are SERVER-ONLY (no NEXT_PUBLIC_ prefix): ORS_KEY, OCM_KEY, GEMINI_API_KEY.
- The energy model (lib/energyModel.js) is PURE (no fetch) and runs client-side.

## The app
Left sidebar nav: Plan Trip, Trips, Fleet, Charging, Reports, Settings. Only Plan Trip and
Fleet are functional — the rest are visible, disabled placeholders (matches the board deck
mockup; do not wire them up without an explicit ask).

1. **Plan Trip (Driver view)** — one trip. Inputs: origin, destination, payload (kg),
   battery %, tariff (₹/kWh, default 8.5). Two one-click presets: "Mumbai → Pune" (the
   board's reference trip — payload 4000 kg, battery 80%, tariff 8.5) and "Nashik run
   (needs charge)" (a longer, lower-battery trip meant to trigger a charging stop in the
   demo). Both presets fill the fields AND run the trip immediately. "Optimise Trip" runs
   a manually-entered trip. Output: route on map with a "Recommended route · N km" badge,
   six result cards in this exact order/wording — Trip distance (km) · Energy use (kWh/km)
   · Predicted full range (km) · Energy cost (₹/km) · Arrival battery (%) · Charging need
   ("No stop" or "Stop at <charger>") — then a "YOUR TRIP PLAN" panel: 2-4 LLM guidance
   bullets, a "Confidence: 85–91%" line, and the limitations note "Prototype uses assumed
   vehicle parameters; live BMS calibration required before deployment." Never show
   "±12%" — confidence is always the 85–91% range.
2. **Fleet view** — a table of several trucks/trips using the same model, plus aggregate
   cost-per-km and total energy. Sortable.

## The energy model (lib/energyModel.js)
Formulas: F_roll=Crr·m·g, F_aero=0.5·ρ·Cd·A·v_air², F_grade=m·g·sinθ (clamped ±0.3), drivetrain
loss on positive tractive force / regen recovery on negative, plus HVAC/aux load over segment
time. Outputs include kWh_per_km, predicted_full_range_km (= battery_kWh / kWh_per_km), and
arrival_soc_pct (= (battery_kWh·battery_pct/100 − total_kWh) / battery_kWh × 100). `feasible`
is `arrival_soc_pct >= VEHICLE.reserve_pct` (10% reserve buffer, not a bare 0%). Keep the model
pure (no fetch) and keep each physics line commented with the formula it implements.

**Calibration:** the Mumbai→Pune preset is the board's reference trip and should read
~0.82 kWh/km live from the real route (→ 244 km full range, 19% arrival, ₹6.97/km). DriverView
console.logs the computed kWh/km on every calculation and flags drift >0.03 for this preset.
Cd, Crr, P_aux, and eta_regen in config.js are marked as the tuning knobs — nudge those, never
hardcode the output numbers themselves.

## Guidance layer (app/api/guidance)
The LLM (Gemini) may ONLY explain numbers the physics model already produced (range, kWh/km,
arrival SOC, recommended speed, charging need) — it must never compute or change a number. The
system prompt enforces this explicitly. Style: "Keep 58–62 km/h through the Lonavala climb;
expected arrival battery 19%." On any failure (missing key, bad response, empty candidate) the
route falls back to a rule-based summary built only from the input numbers — the UI must never
white-screen waiting on Gemini.

## Non-negotiables
- Usable by a non-technical person. Clean, obvious UI. Mobile-friendly.
- Always show the confidence range and the limitations note — never hide them.
- Every number must trace to a KPI: ₹/km, range confidence, uptime, EV-fleet conversion.
- Every API route handles errors and returns a clean JSON error; the UI never white-screens.

## Coding conventions
- Small components, clear names. No secrets in any client component or NEXT_PUBLIC_ var.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
