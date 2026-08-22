# Project: Tata RangeSure — EV Truck Range Optimizer

MBA AI-transformation capstone demo. Judged on: problem-solution fit, a genuine AI capability,
live deployment, and usability by a NON-technical person. The authoritative specs are
`../DTAI_RangeSure_Build_Prompts.md` (original build), `../DTAI_RangeSure_Perfect_App_Upgrade.md`
(the P0/P1 upgrade pack), and `../DTAI_RangeSure_Route_Guarantee.md` (the G1-G5 commercial
"Route Guarantee" layer) — this codebase now implements all three in full, all in the repo
root's parent.

**Recalibration note:** live verification found the deck's original Mumbai→Pune numbers (148 km,
0.82 kWh/km, expressway) don't match reality — ORS's `driving-hgv` profile routes via the old
ghat road (165 km, ~2,000 m of climbing), giving ~1.06 kWh/km PHYSICS estimate (the number
actually shown to the user is the learned-calibrated figure on top of that — see Calibration
layer below). The app was NOT tuned to fake the deck's numbers; the deck should be updated to
the real ones instead (slide 9 update pending). See the CALIBRATION comment in `config.js` and
`DriverView.jsx` for the current live baseline.

## Stack
- Next.js App Router, JavaScript (NOT TypeScript). Deployed on Vercel.
- Styling: Tailwind CSS v4 (`app/globals.css` — `@theme` block defines a cream/blue design
  system: `background`/`background-alt` cream, `surface`/`surface-raised` off-white,
  `foreground`/`muted-foreground` navy-grey text, `border` warm cream-grey, `primary` blue
  (`#2563eb`), `success` green, `warning` amber, `danger` red) + hand-built shadcn/ui-pattern
  primitives in `components/ui/` (button, card, badge, tabs, sheet, select, skeleton, tooltip,
  slider — Radix primitives + `class-variance-authority` + `lib/utils.js`'s `cn()`), matching
  what the shadcn CLI would generate so 21st.dev component variants can drop in later without a
  refactor. Charts (the Guarantee view's moat curve) use `recharts`. No plain custom CSS classes
  remain except RouteMap's Leaflet container overrides in globals.css.
- Map: react-leaflet + OpenStreetMap tiles. Leaflet touches `window`, so RouteMap.jsx
  MUST be dynamically imported with { ssr: false } and only rendered on the client.
- ALL external APIs are called from server route handlers in app/api/* — never from the browser:
  - OpenRouteService (routing/elevation, profile `driving-hgv`)          -> app/api/route
  - OpenRouteService (single-place geocoding, shared via lib/ors.js)     -> app/api/geocode
  - OpenRouteService (reverse geocoding, shared via lib/ors.js)          -> app/api/reverse-geocode
  - Open-Meteo (weather, keyless)                                        -> app/api/weather
  - Open Charge Map (chargers)                                           -> app/api/charging
  - Google Gemini (LLM driver guidance, model `gemini-2.5-flash`)        -> app/api/guidance
  - Google Gemini (LLM trip what-if, same model)                        -> app/api/ask
- Env vars are SERVER-ONLY (no NEXT_PUBLIC_ prefix): ORS_KEY, OCM_KEY, GEMINI_API_KEY.
- The energy model (lib/energyModel.js) is PURE (no fetch) and runs client-side, as are
  lib/segments.js, lib/scenarios.js, lib/calibration.js, and lib/governance.js.
- Three client-side Context providers, wrapping the whole app in app/page.js:
  - `lib/settingsContext.jsx` (localStorage-backed) — vehicle params, default tariff, DC
    charger power (kW), and the Route Guarantee model's `margin`/`disruptionCostPerKm`
    assumptions, editable on Settings, consumed live by Plan Trip, Fleet, Guarantee, and
    AssumptionsPopover instead of the static config.js import. config.js remains the
    factory-default source (and Settings' "Reset to defaults" target). `selectVehicle(name)`
    swaps in a whole VEHICLES preset; `updateVehicle(patch)` nudges the currently-selected
    preset's params in place.
  - `lib/tripHistoryContext.jsx` (localStorage-backed) — log of trips run on Plan Trip
    (capped at 50), feeds the Trips and Reports pages. Fleet runs are NOT logged here
    (Fleet is its own snapshot view, not a dispatch log).
  - `lib/lastTripContext.jsx` (session-only, not persisted) — the most recently computed
    Plan Trip result (origin/destination, dist_km, tariff, vehicle name, calibrated
    best/expected/worst kWh/km), consumed by the Guarantee view so it can price a
    commitment from a trip that's already been computed, not run its own calculation.

## The app
Left sidebar (desktop) / bottom tab bar (mobile, <1024px), all seven items functional: Plan
Trip, Guarantee, Trips, Fleet, Charging, Reports, Settings.

1. **Plan Trip (Driver view)** — one trip. Inputs: vehicle preset (VEHICLES dropdown), origin,
   destination, payload (kg, clamped to the selected vehicle's max), battery %, tariff (₹/kWh,
   default from Settings), and an optional delivery window (hours). On mobile the inputs live in
   a collapsible Sheet; on desktop they're an always-visible left pane. Two one-click presets:
   "Mumbai → Pune" (the board's reference trip on the demo-default Ultra E.9 — payload 4000 kg,
   battery 100%, tariff 8.5, all fixed regardless of Settings changes; battery is 100%, not the
   deck's original 80%, because the real live route only leaves a thin margin at full charge —
   see the recalibration note above) and "Nashik run (needs charge)" (a longer, lower-battery
   trip meant to trigger a charging stop in the demo). Both presets fill the fields AND run the
   trip immediately. "Optimise Trip" runs a manually-entered trip.

   Output: route on map with a "Recommended route · N km" badge; a hero VerdictCard (status
   icon/badge, headline, confidence range, the P1-2 repeatability gauge, and — for needs-charge
   trips — the P1-3 charge-time/delivery-window line); six MetricTile result cards in this exact
   order/wording — Trip distance (km) · Energy use (kWh/km) · Predicted full range (km) ·
   Energy cost (₹/km) · Arrival battery (%) · Charging need ("No stop" or "Stop at <charger>")
   — then a "YOUR TRIP PLAN" panel: the physics→calibrated kWh/km line + what-it-learned
   takeaway (P1-1), 2-4 LLM guidance bullets, an Assumptions popover, an AI model coefficients
   popover, and an Ask box for natural-language what-ifs. Never show a bare "±12%" — confidence
   is always the 85–91% range (widened when the governance fallback is active — see below).
   Every successful calculation is logged to trip history via `useTripHistory().addTrip()`
   (using the CALIBRATED numbers, not raw physics), and pushed to `lib/lastTripContext.jsx`
   for the Guarantee view. When the selected vehicle is flagged by the cohort-anomaly check
   (see below), a `CohortAnomalyBanner` renders above the VerdictCard.
2. **Guarantee** — the commercial hero screen (see Route Guarantee section below). Reuses the
   last Plan Trip calculation's numbers via `lib/lastTripContext.jsx`; shows an empty state
   ("compute a trip on Plan Trip first") if nothing has been run yet.
3. **Trips** — table of trip history (most recent first), "Clear history" button, empty
   state if none logged yet.
4. **Fleet view** — a dashboard strip (total kWh, avg ₹/km, trips needing a charge stop) + an
   insight line when any route is MARGINAL, + a "Guarantee book" roll-up strip (see Route
   Guarantee section), + a sortable table of 6 sample trucks/trips. Each row stores its route
   segments so a per-row vehicle Select recomputes feasibility (and its guarantee price) live,
   with no refetch. Status is three-tier: Feasible (green) / Marginal (amber, arrival within 5
   points of the reserve buffer) / Infeasible (red). A header-level vehicle Select sets the
   default for all rows on the next "Run fleet".
5. **Charging** — search a city (geocoded via app/api/geocode), shows nearby charging
   stations (~50 km) on a map plus a list. Reuses RouteMap.jsx in its chargers-only mode
   (no route line).
6. **Reports** — aggregate stats (total distance/energy/cost, feasibility rate) computed
   from trip history. Empty state if none logged yet.
7. **Settings** — edit every vehicle param, the default tariff, the DC fast-charge power
   (kW), and the Route Guarantee model's margin/disruption-cost assumptions; changes apply
   immediately to Plan Trip, Fleet, and Guarantee, and persist to localStorage.
   "Reset to defaults" restores the config.js Ultra E.9 preset.

## Vehicle presets (config.js)
`VEHICLES` is an array of 4 real Tata electric-truck presets (Ace EV, Ultra E.9, Prima E.28K,
Prima E.55S) from the upgrade doc's spec table — `{ name, battery_kWh, gvw_kg, payload_max_kg,
claimed_range_km }` are real published specs; `{ Crr, Cd, A, eta_dt, eta_regen, P_aux }` are
engineering estimates, commented as such (never hidden — shown via the Assumptions popover's
specs-citation tooltip). `SHARED_PARAMS` (`rho`, `g`, `reserve_pct`) apply across all presets.
`DEFAULT_VEHICLE` = Ultra E.9, matching board slide 9.

## The energy model (lib/energyModel.js)
Formulas: F_roll=Crr·m·g, F_aero=0.5·ρ·Cd·A·v_air², F_grade=m·g·sinθ (grade clamped ±30% —
computed once in lib/segments.js's `grade_pct` and reused here, so climb detection and the
tractive-force calc always agree), drivetrain loss on positive tractive force / regen recovery
on negative, plus HVAC/aux load over segment time. Outputs include kWh_per_km,
predicted_full_range_km (= battery_kWh / kWh_per_km), and arrival_soc_pct (= (battery_kWh·
battery_pct/100 − total_kWh) / battery_kWh × 100). `feasible` is `arrival_soc_pct >=
reserve_pct` (10% reserve buffer, not a bare 0%). Keep the model pure (no fetch) and keep each
physics line commented with the formula it implements. This is the PHYSICS baseline only — see
Calibration layer below for the number actually shown/used for the verdict.

**Calibration target:** the Mumbai→Pune preset is the board's reference trip and its PHYSICS
estimate reads ~1.06 kWh/km live from the real route at 100% battery (the displayed calibrated
number is a few % different — see below). DriverView console.logs the computed physics kWh/km
on every calculation and flags drift >0.05 from that baseline for this preset. Cd, Crr, P_aux,
and eta_regen in config.js are marked as the tuning knobs — nudge those, never hardcode the
output numbers themselves.

## Segment intelligence (lib/segments.js)
`buildSegments()` turns ORS route geometry into per-segment `{ distance_m, delta_h, grade_pct,
lat, lon, at_km, temp_factor, headwind_ms }`. Weather is sampled at 4 points along the route
(start/~1/3/~2/3/end, each fetched independently so one failure doesn't null the rest) and each
segment gets the nearest sample by distance, instead of one uniform value. `findSteepestClimb()`
finds the steepest SUSTAINED run (≥300 m above a 2% grade threshold, ranked by average grade
over the run) — not a single spiky segment — and DriverView reverse-geocodes its midpoint via
app/api/reverse-geocode for a real place name, deriving a climb-specific eco-speed
(`climbSafeSpeedKmh`) scaled down from the route average by grade severity.

## Learned calibration (data/tripHistory.js, lib/calibration.js)
`data/tripHistory.js` generates 1,500 deterministic synthetic past-trip records (seeded PRNG —
a documented stand-in for real Fleet Edge telematics) with a hidden systematic bias: cold +
heavy + hilly trips draw more than a simplified physics baseline predicts.
`lib/calibration.js` fits a transparent multivariate linear regression (normal equations, no ML
library) mapping `[distance_km, avg_gradient, payload_kg, temp_c, avg_speed_kmh]` to a
`correction_factor`, purely from the data — the bias formula is never passed in. `calibrate()`
predicts the factor (clamped 0.7–1.5); `explainCalibration()` produces the one-line "what it
learned" takeaway. DriverView applies this factor to the PHYSICS kWh/km and uses the CALIBRATED
number for the verdict/range/arrival-SOC math from then on — `physics_kWh_per_km` is kept
alongside for the "Physics estimate X → Calibrated Y" display. `AiModelPanel.jsx` exposes the
learned coefficients for explainability.

## Scenario band (lib/scenarios.js)
`runScenarios()` runs the physics model three times per trip: BEST (no HVAC/aux penalty, a
light tailwind assist), EXPECTED (measured conditions, unchanged), WORST (a hot/cold aux
penalty, a headwind, +10% payload uncertainty). All three get the same calibration factor
(see above — the correction is a systematic-bias fix, not a per-scenario one). Rendered as a
"Repeatability — arrival battery" gauge on VerdictCard.

## Governance red-line (lib/governance.js)
`assessConfidence()` never lets VerdictCard show a confident green when: (a) DEGRADED — any
upstream data source failed (weather, chargers, elevation missing from the route geometry), or
(b) UNCERTAIN — the EXPECTED case looks feasible but the real WORST-case scenario (from
lib/scenarios.js) would breach the reserve buffer. In either case the verdict flips to an amber
"Low confidence — manual planning advised" state with the real reasons listed, a widened
confidence band, a "Safe fallback active" badge, and the raw numbers still shown below — never
hidden. Every calculation logs `[Governance] { inputs, model_version, confidence, verdict,
fallback_active, reasons }` to the console as a stand-in trip log.

## Route Guarantee (lib/guarantee.js, data/corridors.js) — the commercial layer
Turns the trip engine's confidence band into a priced commitment: "Tata can commit ₹X/km on
this corridor with a Y% completion guarantee." `lib/guarantee.js`'s `priceGuarantee()` is an
explicitly **illustrative, non-actuarial** model (implemented verbatim from
`../DTAI_RangeSure_Route_Guarantee.md`): the best/worst scenario band sizes an uncertainty
`sigma0`, scaled by `sqrt(baseline_trips / corridor_trips)` — MORE corridor trips means LESS
uncertainty (the "data flywheel"). An Acklam inverse-normal quantile turns the guarantee % into
a z-score priced against that sigma; a residual disruption load and Tata's margin stack on top.
`underwritable` is false when a corridor has under 100 logged trips or the buffer would exceed
3x the expected cost — the Guarantee view shows an honest "not yet underwritable" state instead
of a price in that case, never a fabricated number. `data/corridors.js` is a synthetic,
bidirectional, first-place-name-normalized lookup of per-corridor trip counts (a few named
corridors seeded, default 300 for unknown ones) standing in for real Fleet Edge corridor
history. `estimateTripsToUnderwrite()` binary-searches how many more corridor trips a thin
corridor would need to flip underwritable, used by the Fleet Guarantee book's insight line.

**Guarantee view** (`components/GuaranteeView.jsx`) reuses the last Plan Trip result via
`lib/lastTripContext.jsx` — it does not run its own trip calculation. Hero card shows the
committed ₹/km and guarantee % badge; a 90–99.5% `Slider` live-recomputes the price; a
breakdown bar (Energy cost | Risk buffer | Margin) sums EXACTLY to the committed price (the
`risk_cost_per_km`/`disruption_load_per_km`/`margin_per_km` fields on `priceGuarantee()`'s
return value are additive by construction, so this always reconciles). `components/MoatPanel.jsx`
sweeps `corridor_trips = [0, 100, 500, 1500, 10000, 50000]` at the SAME trip/guarantee level and
plots the buffer collapsing as trip history grows (recharts line chart) — the visual argument
for why a new entrant (0 trips) literally cannot underwrite.

**Fleet Guarantee book** (in `FleetView.jsx`): each fleet row now also runs
`runScenarios()` (not just a single physics estimate) so it has a best/worst band to price, at
a fixed `HOUSE_GUARANTEE_PCT` (96%). Rolls up into: annualized guaranteed contract value
(underwritable corridors only, using an illustrative `annualTrips` dispatch-frequency
assumption per row — NOT a routing input), a km-weighted average risk buffer, and an
underwritable/not-yet count with a named insight line.

## Cohort anomaly flag (data/cohort.js) — G4
A pre-trip signal only fleet-wide data could enable: `getCohortAnomaly()` treats a vehicle
model's own calibrated kWh/km as its cohort mean (what a healthy truck of that model draws),
with a small synthetic std spread across the fleet, and compares one deterministic synthetic
"unit" offset (standing in for a specific VIN's own Fleet Edge history) against it as a
z-score. Trucks above ~1.5σ are flagged amber via `components/CohortAnomalyBanner.jsx` on
both Plan Trip and Guarantee ("this truck is drawing ~X% above its cohort — possible battery
degradation"). Offsets are hardcoded per vehicle model in `data/cohort.js` (Ultra E.9 is
seeded to flag, by design, since it's the default Plan Trip vehicle) — synthetic demo data,
labeled as such in the UI, not a real degradation model.

## Charge time + delivery window (P1-3, in DriverView)
For needs-charge trips: `kWh_needed` closes the gap from arrival SOC up to the reserve buffer;
`charge_minutes = kWh_needed / chargerKW * 60` using Settings' DC fast-charge power (default
120 kW). The optional delivery-window (hours) input compares route time + charge time against
the window and shows "On time" or "Risks delivery window by ~N min" on VerdictCard.

## Guidance & Ask layers (app/api/guidance, app/api/ask)
Both LLM (Gemini) endpoints may ONLY reason over numbers the physics/calibration/scenario layers
already produced — /api/guidance explains the current trip's numbers (never computes new ones);
/api/ask answers free-form what-ifs but is instructed to reason only qualitatively about
direction/magnitude, never state a new precise number, and always note that an exact answer
needs re-running the trip planner. On any failure (missing key, bad response, empty candidate,
rate limit) both fall back to a safe message/rule-based summary built only from input numbers —
the UI must never white-screen or invent a number waiting on Gemini.

## Non-negotiables
- Usable by a non-technical person. Clean, obvious UI. Mobile-friendly (tested at 375px/1440px).
- Always show the confidence range and the limitations note — never hide them.
- Never show a confident green verdict when data is degraded or the worst case is uncertain —
  the governance red-line (see above) is a demo highlight, not an edge case to skip.
- Every number must trace to a KPI: ₹/km, range confidence, uptime, EV-fleet conversion.
- Every API route handles errors and returns a clean JSON error; the UI never white-screens.
- The LLM layers (guidance, ask) may explain/reason over model numbers but must never invent
  or silently override one.
- The Route Guarantee is explicitly labeled an "illustrative underwriting model" — not
  actuarial — everywhere it's shown, and its assumptions (margin, disruption cost, baseline
  trips, corridor trip counts) are visible/editable, never hidden. When `priceGuarantee()`
  says a corridor isn't underwritable, show that honestly — never a fabricated price.

## Coding conventions
- Small components, clear names. No secrets in any client component or NEXT_PUBLIC_ var.
- New shared UI goes in `components/ui/` (shadcn pattern: Radix + `cva` + `cn()`), not ad-hoc
  Tailwind classes duplicated across components.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
