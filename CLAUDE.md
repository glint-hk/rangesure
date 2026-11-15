# Project: Dyaus RangeSure — EV Truck Range Optimizer

Branded for Dyaus Advisory (client-facing: "Created by Hrishikesh Kumar for Dyaus Advisory" credit in the
sidebar, mobile header, and `components/AppFooter.jsx`; logo mark in `components/BrandMark.jsx`). All Tata
branding was removed: vehicle presets use generic GVW-class names and "Fleet Edge" became "fleet telematics".

MBA AI-transformation capstone demo. Judged on: problem-solution fit, a genuine AI capability,
live deployment, and usability by a NON-technical person. The authoritative specs are
`../DTAI_RangeSure_Build_Prompts.md` (original build), `../DTAI_RangeSure_Perfect_App_Upgrade.md`
(the P0/P1 upgrade pack), and `../DTAI_RangeSure_Route_Guarantee.md` (the G1-G5 commercial
"Route Guarantee" layer) — this codebase now implements all three in full, all in the repo
root's parent.

**Recalibration note:** live verification found the deck's original Mumbai→Pune numbers (148 km,
0.82 kWh/km, expressway) don't match reality — ORS's `driving-hgv` profile routes via the ghat
road (now 156 km, ~1,300 m of climbing after elevation smoothing), giving a ~0.93 kWh/km PHYSICS
estimate on a mild day with 4,000 kg (≈0.95 calibrated). Earlier figures (165 km, ~1.06 physics,
~2,000 m climbing) predate elevation smoothing and direction-aware wind, both accuracy fixes. The app
is NOT tuned to fake any number. See `CALIBRATION_TARGET_KWH_PER_KM` in `DriverView.jsx`.

## Stack
- Next.js App Router, JavaScript (NOT TypeScript). Deployed on Vercel.
- Styling: Tailwind CSS v4 (`app/globals.css` — `@theme` block defines a premium "private bank"
  system: `background` porcelain, `background-alt` deep navy (sidebar/mobile chrome, tooltips),
  `surface` white, hairline `border`, `foreground` navy ink, `primary` sapphire blue (`#1e40af`),
  `accent` gold (`#a87412`) for eyebrows/active states/highlights, muted `success`/`warning`/
  `danger`. Headlines use the `font-display` serif (Cormorant Garamond via next/font), numbers
  use the `.tabular` utility. The map uses OSM tiles softened (partially desaturated) by a CSS filter on
  `.leaflet-tile-pane` (CARTO basemaps now need an API key) with custom div markers) + hand-built shadcn/ui-pattern
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
  lib/segments.js, lib/scenarios.js, lib/calibration.js, lib/governance.js, lib/chargingPlan.js and
  lib/tripEngine.js. **`lib/tripEngine.js`'s `computeTrip()` is the ONE trip pipeline** (segments →
  best/expected/worst physics → calibration → energy breakdown) used by BOTH Plan Trip and Fleet, so
  the same route gives the same numbers on both screens. Don't fork the maths into a view.
- All seven views stay MOUNTED (hidden with the `hidden` attribute) in app/page.js so a planned trip,
  fleet run or charger search survives tab switches. Views get `onNavigate(key)` and `active` props;
  anything that measures its container (recharts) renders only when `active`. RouteMap re-measures
  via a ResizeObserver when its tab becomes visible.
- Explanations everywhere use `components/ui/info-hint.jsx` (`InfoHint`): an (i) popover that opens on
  hover (mouse only) AND on tap, so hints work on phones. Every result number carries one.
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
   see the recalibration note above) and "Nashik run (needs charge)" (starts at 40% — low enough to need
   charging, high enough to reach the chargers near Mumbai/Thane; at 20% the reserve is hit by km 23). Both presets fill the fields AND run the
   trip immediately. "Optimise Trip" runs a manually-entered trip.

   Fetch flow (`handleCalculate`): route first; then reverse-geocode of the biggest climb, ONE
   batched weather call (4 points) and a corridor charger search, in parallel; everything is
   committed in ONE `setRun()` so nothing renders half-finished. A `runId` ref drops superseded
   runs. A 3-step progress card shows while it works. Results are `useMemo`-derived from `run` +
   inputs, so vehicle/load/battery/tariff edits recompute instantly with no refetch; editing
   origin/destination shows a "you changed the route" notice until re-run.

   Output: route on map ("Truck route · N km" badge, legend, planned stops highlighted); a hero
   VerdictCard (plain-language headline, a High/Medium/Low CONFIDENCE badge from governance, the
   reasons when not High, a bad-day→good-day arrival-battery bar with the reserve marked for
   no-stop trips, a numbered stop list for charging trips, the biggest-climb callout, and driving +
   charging time checked against the optional deadline); six MetricTile cards in this order —
   Trip distance · Energy use (kWh/km) · Range on a full battery · Energy cost (₹/km) · Battery on
   arrival (after planned charging) · Charging stops — each with an InfoHint; then a "Next step"
   link to Guarantee, and the cohort banner BELOW the numbers (it's not about this trip). A "How we
   worked it out" panel holds the physics→calibrated line, the `EnergyBreakdown` (air resistance,
   tyres, climbing net of regen, AC, learned correction — always summing to the trip total), LLM
   driver notes, Assumptions and AI-model popovers, and the Ask box. NEVER show a fixed confidence
   percentage — the old "85–91%" was a hardcoded constant and has been removed. Every run is logged
   to trip history with `outcome` ('no-stop' | 'stops' | 'not-possible'), stop count and the
   POST-CHARGING arrival %, and pushed to `lib/lastTripContext.jsx` (incl. payload) for Guarantee.
2. **Guarantee** — the commercial hero screen (see Route Guarantee section below). Reuses the
   last Plan Trip calculation's numbers via `lib/lastTripContext.jsx`; shows an empty state
   ("compute a trip on Plan Trip first") if nothing has been run yet.
3. **Trips** — table of trip history (most recent first), "Clear history" button, empty
   state if none logged yet.
4. **Fleet view** — runs 6 sample trucks through `computeTrip()` (same engine as Plan Trip, with
   live weather; payload capped at the vehicle's max), then a dashboard strip (energy for all runs,
   distance-weighted avg ₹/km, how many need a charge stop) + a "Guarantee book" strip + a sortable
   table. Each row stores its route + weather so a per-row vehicle Select recomputes live. Status:
   Comfortable / Tight (within 5 pts of the reserve) / Needs a charge stop — never "Infeasible", and
   arrival never shows a negative % ("Runs out").
5. **Charging** — search a city (geocoded via app/api/geocode), shows nearby charging
   stations (~50 km) on a map plus a list. Reuses RouteMap.jsx in its chargers-only mode
   (no route line).
6. **Reports** — aggregate stats (total distance/energy/cost, feasibility rate) computed
   from trip history. Empty state if none logged yet.
7. **Settings** — grouped into Vehicle (with a "vehicle being edited" picker and an edited-from-
   defaults notice), Electricity and charging (tariff, the truck's max charging power), and
   Guarantee pricing; every field has an InfoHint. Changes apply immediately everywhere and persist
   to localStorage. "Reset everything to defaults" (confirmed) restores the e-ICV 11T preset.

## Vehicle presets (config.js)
`VEHICLES` is an array of 4 generic Indian e-truck class presets (e-SCV 1.5T, e-ICV 11T, e-Rigid 28T,
e-Tractor 55T — renamed from the original Tata models; settings storage key bumped to v4) from the upgrade doc's spec table — `{ name, battery_kWh, gvw_kg, payload_max_kg,
claimed_range_km }` are real published specs; `{ Crr, Cd, A, eta_dt, eta_regen, P_aux }` are
engineering estimates, commented as such (never hidden — shown via the Assumptions popover's
specs-citation tooltip). `SHARED_PARAMS` (`rho`, `g`, `reserve_pct`) apply across all presets.
`DEFAULT_VEHICLE` = e-ICV 11T, matching board slide 9.

## The energy model (lib/energyModel.js)
Formulas: F_roll=Crr·m·g (Crr ×1.15 on wet road), F_aero=0.5·ρ·Cd·A·v_air² (v_air = speed + the
segment's headwind COMPONENT), F_grade=m·g·sinθ (grade clamped ±30% —
computed once in lib/segments.js's `grade_pct` and reused here, so climb detection and the
tractive-force calc always agree), drivetrain loss on positive tractive force / regen recovery
on negative, plus HVAC/aux load over segment time. Also returns `breakdown_kwh` {rolling, aero, climbing (net of regen), aux}. Outputs include kWh_per_km,
predicted_full_range_km (= battery_kWh / kWh_per_km), and arrival_soc_pct (= (battery_kWh·
battery_pct/100 − total_kWh) / battery_kWh × 100). `feasible` is `arrival_soc_pct >=
reserve_pct` (10% reserve buffer, not a bare 0%). Keep the model pure (no fetch) and keep each
physics line commented with the formula it implements. This is the PHYSICS baseline only — see
Calibration layer below for the number actually shown/used for the verdict.

**Calibration target:** the Mumbai→Pune preset is the board's reference trip and its PHYSICS
estimate reads ~0.93 kWh/km live (weather-dependent; the displayed calibrated number is ~2% higher). DriverView console.logs the computed physics kWh/km
on every calculation and flags drift >0.05 from that baseline for this preset. Cd, Crr, P_aux,
and eta_regen in config.js are marked as the tuning knobs — nudge those, never hardcode the
output numbers themselves.

## Segment intelligence (lib/segments.js)
`buildSegments()` first SMOOTHS elevation (300 m distance-weighted moving average — raw SRTM noise
invented ~1,300 m of "climbing" on flat Delhi→Jaipur), then turns geometry into per-segment
`{ distance_m, delta_h, grade_pct, heading_deg, lat, lon, at_km, temp_factor, headwind_ms, wet }`.
Weather comes from ONE batched Open-Meteo call for 4 points (start/~1/3/~2/3/end) including wind
DIRECTION; each segment takes the nearest sample and computes its own headwind component
(`wind · cos(windFrom − heading)`) — full wind speed is never treated as a headwind. app/api/weather
derives a continuous HVAC `temp_factor` (none in 16–28 °C, +3%/°C beyond, cap +60%) and a `wet` flag
(≥0.5 mm/h). `findSteepestClimb()` returns the BIGGEST sustained climb (most metres gained, grade
>1.5%, tolerating ≤400 m dips inside a ghat, ≥40 m rise) — shown as "Biggest climb: X km rising Y m",
reverse-geocoded for a place name, with a `climbSafeSpeedKmh` hint.

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
`assessConfidence()` returns a confidence LEVEL (no made-up percentage): `high` (all data loaded and
even the worst case stays above the reserve), `medium` (worst case would breach the reserve), `low`
(weather/chargers/elevation missing). Anything but `high` turns the verdict amber with the reasons
listed and all numbers still shown; a degraded needs-stop trip still shows its stop plan.
`CONFIDENCE_COPY` holds the user-facing wording. Every calculation logs `[Governance]` to the console.

## Charging planner (lib/chargingPlan.js)
Snaps OCM chargers within 10 km of the route, keeps the fastest per 15 km stretch (≤16), and
EXHAUSTIVELY searches ordered combinations of up to 4 stops, simulating each: battery at each
charger's real position minus the detour, charge just enough to reach the next stop when a faster
charger lies ahead (else enough to finish with reserve + 5% cushion, capped at 90%), charge time at
min(Settings max kW, station kW) with half rate above 80%, +15 min overhead per stop. Picks the
fastest valid plan. Infeasible plans report `reserve_hit_km`. app/api/charging does a corridor search
(`points` every ~30 km, 15 km radius, merged/deduped), drops non-operational stations, and returns
`max_power_kw`, `dc`, `town`.

## Route Guarantee (lib/guarantee.js, data/corridors.js) — the commercial layer
Turns the trip engine's best/worst band into a priced commitment: "a guaranteed ₹X/km on this
corridor at a Y% guarantee level" (the real energy cost stays under the price on ~Y of 100 trips). `lib/guarantee.js`'s `priceGuarantee()` is an
explicitly **illustrative, non-actuarial** model (implemented verbatim from
`../DTAI_RangeSure_Route_Guarantee.md`): the best/worst scenario band sizes an uncertainty
`sigma0`, scaled by `sqrt(baseline_trips / corridor_trips)` — MORE corridor trips means LESS
uncertainty (the "data flywheel"). An Acklam inverse-normal quantile turns the guarantee % into
a z-score priced against that sigma; a residual disruption load and the operator's margin stack on top.
`underwritable` is false when a corridor has under 100 logged trips or the buffer would exceed
3x the expected cost — the Guarantee view shows an honest "not yet underwritable" state instead
of a price in that case, never a fabricated number. `data/corridors.js` is a synthetic,
bidirectional, first-place-name-normalized lookup of per-corridor trip counts (a few named
corridors seeded, default 300 for unknown ones) standing in for real Fleet Edge corridor
history. `estimateTripsToUnderwrite()` binary-searches how many more corridor trips a thin
corridor would need to flip underwritable, used by the Fleet Guarantee book's insight line.

**Guarantee view** (`components/GuaranteeView.jsx`) reuses the last Plan Trip result via
`lib/lastTripContext.jsx` (a "Based on your last planned trip" line names it) — it does not run its own
trip calculation. "Risk buffer" everywhere means risk + disruption load, EXCLUDING margin. Hero card shows the
committed ₹/km and guarantee-level badge; a 90–99.5% `Slider` live-recomputes the price; a
breakdown bar (Energy cost | Risk buffer | Margin) sums EXACTLY to the committed price (the
`risk_cost_per_km`/`disruption_load_per_km`/`margin_per_km` fields on `priceGuarantee()`'s
return value are additive by construction, so this always reconciles). `components/MoatPanel.jsx`
sweeps corridor trips 100→50,000 (log x-axis, plus this corridor's own count highlighted) at the SAME
trip/guarantee level and plots the risk buffer collapsing as history grows (recharts); below 100
trips no price can be quoted — the visual argument
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

## Trip time + deadline (in DriverView)
Driving time (ORS duration + detours at 40 km/h) plus the charging plan's minutes, shown on the
VerdictCard for every workable trip; the optional deadline (hours) shows "Within your N h window" or
"Misses your N h window by ~M min".

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
- Always show the confidence level, the bad-day→good-day arrival range (or the stop plan) and the
  limitations — never hide them, and never show a fixed/fabricated confidence percentage.
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
