# RangeSure App Fact Sheet

Documents exactly what the deployed RangeSure app does and outputs, captured directly from a
live run of the current code (local build; not from the deck or any spec doc). Use this to keep
a presentation's numbers and claims in sync with what the app actually shows on screen.

All reference outputs below were captured **2026-08-23, ~19:15–19:28 IST**, running the app
locally against live OpenRouteService / Open-Meteo / Open Charge Map / Gemini calls. **Read the
"Deviations from the deck" and the note under Reference Outputs before building slides around
these exact numbers — the flagship Mumbai→Pune trip runs right at its feasibility margin, and
its outcome category (feasible / needs one stop / needs multiple stops / not feasible) has been
observed to change between otherwise-identical runs because of live weather. Re-run the app
immediately before a live demo rather than relying on a static screenshot or this document's
numbers as gospel.**

---

## 1. Vehicles (`config.js`)

Four Tata electric-truck presets. Battery/GVW/payload/claimed range are real published specs;
the physics parameters (Crr, Cd, A, eta_dt, eta_regen, P_aux) are engineering estimates, not
published by Tata — shown to the user via the app's Assumptions popover, never hidden.

| Preset | Battery | Max payload | Crr | Cd | Frontal area (A) | Drivetrain eff. (eta_dt) | Regen eff. (eta_regen) | Aux/HVAC load (P_aux) |
|---|---|---|---|---|---|---|---|---|
| Ace EV | 24 kWh | 750 kg | 0.009 | 0.55 | 3.2 m² | 0.88 | 0.55 | 800 W |
| **Ultra E.9** (default) | 200 kWh | 4,000 kg | 0.007 | 0.7 | 9 m² | 0.85 | 0.6 | 3,000 W |
| Prima E.28K | 453 kWh | 18,000 kg | 0.0065 | 0.65 | 10 m² | 0.86 | 0.6 | 3,500 W |
| Prima E.55S | 450 kWh | 38,000 kg | 0.006 | 0.6 | 10.5 m² | 0.87 | 0.62 | 4,000 W |

Shared across all presets (`SHARED_PARAMS`): air density ρ = 1.2 kg/m³, g = 9.81 m/s²,
**reserve buffer = 10%** (minimum arrival SOC to call a trip feasible without a charging stop).

Default tariff: ₹8.5/kWh. Default DC fast-charge power: 120 kW.

---

## 2. Reference outputs (captured live, on screen right now)

Vehicle: Ultra E.9 · 200 kWh · 4,000 kg max payload, unless stated otherwise.

### a) Mumbai → Pune, 4,000 kg, **80% battery**, ₹8.5/kWh

| Field | Value |
|---|---|
| Trip distance | 165 km |
| Energy use | 1.09 kWh/km |
| Predicted full range | 183 km |
| Energy cost | ₹9.29/km |
| Arrival battery | **— (not shown as a number)** |
| Charging need | **Not feasible** |
| Verdict | "Not feasible from this start SOC — no reachable charger before the reserve buffer would be breached — manual planning advised." (red state, no confidence range shown) |

### b) Same trip, **100% battery**

| Field | Value |
|---|---|
| Trip distance | 165 km |
| Energy use | 1.09 kWh/km (physics 1.07 → calibrated 1.09) |
| Predicted full range | 183 km |
| Energy cost | ₹9.29/km |
| Arrival battery | 88% |
| Charging need | Stop at **E Fill Electric Charging Station** |
| Confidence range | 85–91% |
| Verdict | "Charge once at E Fill Electric Charging Station" (amber "Charge stop needed" state) |

### c) "Nashik run (needs charge)" preset

Preset loads: origin Mumbai, destination Nashik, **payload 4,000 kg** (fixed in the fix pack —
was previously 6,000 kg, which exceeded this vehicle's 4,000 kg max), battery 20%.

| Field | Value |
|---|---|
| Trip distance | 162 km |
| Energy use | 1.21 kWh/km (physics 1.19 → calibrated 1.21) |
| Predicted full range | 165 km |
| Energy cost | ₹10.30/km |
| Arrival battery | 14% |
| Charging need | **Needs 2 charge stops** |
| Confidence range | 85–91% |
| Verdict | "Needs 2 charge stops" (amber), lists both stops individually (station name + km-into-route for each) and a combined "Add ~X min across the planned stops" estimate |

### d) Varanasi → Banda, **1% battery**

| Field | Value |
|---|---|
| Trip distance | 319 km |
| Energy use | 1.00 kWh/km |
| Predicted full range | 200 km |
| Energy cost | ₹8.50/km |
| Arrival battery | **— (not shown as a number)** |
| Charging need | **Not feasible** |
| Verdict | Red "Not feasible" state: "Not feasible from this start SOC — no reachable charger before the reserve buffer would be breached — manual planning advised." |

**No negative percentage is ever shown anywhere in this or any other run tested** — this is the
specific bug the fix pack (documented separately) targeted: the app used to show things like
"-196%" arrival battery for infeasible trips. It now shows a dash and an honest red-line message
instead, on every infeasible case tested this session.

**Why (a) and (d) matter beyond the individual numbers:** on this exact route/vehicle/payload,
100% battery produces "needs 1 stop," while 80% battery — less buffer, same route — flips all
the way to "not feasible" (no charger the app knows about is close enough to the earlier point
where the reserve would be breached). That's the core behavior the fix pack added: the
recommended (or no-longer-possible) stop is now genuinely a function of starting battery, not a
fixed answer regardless of it.

---

## 3. AI / Model

**(a) Physics model** (`lib/energyModel.js`) — a from-scratch tractive-force model, computed
**per route segment** (not a single averaged number) and summed. For every segment it computes
rolling resistance (Crr · m · g), aerodynamic drag (½ · ρ · Cd · A · v_air², where v_air includes
a per-segment headwind estimate), and grade force (m · g · sin θ, from real elevation data,
clamped to ±30% grade). Positive tractive force is divided by drivetrain efficiency (a loss);
negative tractive force (descending) is credited back at the regen efficiency. A per-segment
HVAC/auxiliary load (scaled by a temperature factor from live weather) is added on top. Route
geometry, elevation, and duration come from OpenRouteService; segments are typically tens to a
few hundred metres long depending on the route's GPS trace density, so the model reflects real
climbs and descents along the way, not a flat average.

**(b) Calibration layer** (`lib/calibration.js`) — a small, transparent correction fit **once,
at app startup**, via ordinary least-squares (Gaussian elimination on the normal equations — no
ML library) on 1,500 synthetic-but-realistic past trips (`data/tripHistory.js`, standing in for
real Fleet Edge telematics). It predicts a `correction_factor` (clamped to 0.7–1.5×) from five
trip features — distance, average gradient, payload, temperature, average speed — and multiplies
the physics kWh/km estimate by it. Example, live from today's Mumbai→Pune 100% run: physics
estimate 1.07 kWh/km → calibrated 1.09 kWh/km, with the on-screen "what it learned" line reading
*"a heavy payload use about 2% more than physics alone predicts, based on 1,500 past trips."*
The calibrated number — not the raw physics one — drives every downstream number (range,
arrival %, cost, feasibility).

**(c) Gemini guidance** (`app/api/guidance`, model `gemini-2.5-flash`) — generates 3–4 plain-
language driver bullets. It is given the trip's already-computed numbers (distance, kWh/km,
range, arrival %, cost, climb info, weather) as JSON and instructed to **explain, never
calculate**: the system prompt explicitly forbids it from computing, estimating, or changing any
number, and requires it to only cite numbers already present in the input. A second endpoint,
`app/api/ask`, answers free-form what-if questions (e.g. "what if I add 2 tonnes?") under the
same rule — it may reason qualitatively about direction/magnitude but is explicitly forbidden
from stating a new precise number, and must note that an exact answer needs re-running the
planner. Verified live today: asked "what if I add 2 tonnes of payload?", it correctly answered
qualitatively ("would likely increase energy consumption per km... further reduce the predicted
arrival SOC... An exact answer requires re-running the trip planner") without inventing a figure.

**(d) Red-line fallback** — two independent, increasingly severe tiers, both verified live today:
- **Amber ("Low confidence — manual planning advised")** — triggered by `lib/governance.js`
  whenever either (i) any upstream data source failed (weather, chargers, or elevation data
  missing), or (ii) the expected case looks feasible but the real worst-case scenario (a
  three-way physics run with a hot/cold aux penalty, headwind, and +10% payload uncertainty)
  would breach the reserve buffer. Shows the specific reason(s), a "Safe fallback active" badge,
  and a widened confidence band — never a confident green verdict. Reproduced live today by
  killing the weather API mid-request: the app cleanly showed "Weather data unavailable — using
  default conditions" and flipped to this amber state, with every number still displayed.
- **Red ("Not feasible from this start SOC")** — added in the fix pack: triggered when the
  charging-stop planner (`lib/chargingPlan.js`) finds the trip would breach the reserve buffer
  and **no charger in the data it has is reachable before that point**. Shows a dash instead of
  a number for arrival battery, never a negative percentage, and an explicit "no reachable
  charger... manual planning advised" message.

---

## 4. Features

| Feature | Status | Notes |
|---|---|---|
| Driver view (Plan Trip) | **Built** | Presets + manual entry, map, verdict card, 6 metric tiles, guidance panel, ask box |
| Fleet view | **Built** | Dashboard strip, per-row vehicle reassignment, Guarantee book roll-up |
| Charging page | **Built** | Search a city, chargers shown with distance (km) from the searched point, sorted nearest-first |
| Guarantee view (priced ₹/km + slider) | **Built** | 90–99.5% slider live-recomputes committed price; breakdown bar sums exactly to it (verified live: 96.0%→₹11.29/km, energy ₹9.29 + risk buffer ₹1.17 + margin ₹0.84) |
| Moat / data-flywheel panel | **Built** | Chart sweeping 0→50,000 corridor trips at the same guarantee level; 0 trips is explicitly labeled "cannot underwrite" |
| Cohort anomaly flag | **Built** | Amber banner on Plan Trip and Guarantee ("this truck is drawing ~9% above its Ultra E.9 cohort — possible battery degradation"); labeled as synthetic demo data |
| Natural-language "ask" box | **Built** | Free-form what-if questions, grounded-only answers (see §3c) |
| Confidence scenario band | **Built** | "Repeatability — arrival battery" gauge on every verdict card: best/expected/worst arrival %, clamped to 0–100% for display |
| Charge-time estimate | **Built** | "Add ~N min at [station]" (single stop) or "Add ~N min across the planned stops" (multi-stop); only shown when a stop can actually rescue the trip |

No feature in this list is Partial or Not built as of this session's testing.

---

## 5. Data sources

| Source | Used for | Details |
|---|---|---|
| **OpenRouteService (ORS)** | Routing | Profile `driving-hgv`, elevation included. Returns distance, duration, and full route geometry with per-point elevation. |
| **OpenRouteService (ORS)** | Geocoding | Place-name → lat/lon, restricted to India. Used for trip origin/destination and the Charging page's location search. |
| **OpenRouteService (ORS)** | Reverse geocoding | Lat/lon → place name, used only to name the steepest climb found on a route for driver guidance. |
| **Open-Meteo** | Weather | Keyless. Current temperature, wind speed, precipitation — sampled at 4 points along each route (start, ~1/3, ~2/3, end). Derives a temperature-based aux-load multiplier and a headwind estimate. |
| **Open Charge Map (OCM)** | Charging stations | Nearby stations (25–100 km radius, capped at 8 results) around a point — station title and lat/lon. |
| **Google Gemini** | Guidance + Ask | Model **`gemini-2.5-flash`**. Two endpoints: `/api/guidance` (explains the current trip's numbers as bullets) and `/api/ask` (answers free-form what-ifs). Both fall back to a deterministic rule-based response on any failure (missing key, rate limit, empty/truncated response) — verified live today via a real Gemini free-tier rate-limit (429), which produced a clean rule-based fallback, not an error or blank panel. |

All four external services are called only from server-side API routes; no key is ever sent to
the browser.

---

## 6. Deviations from the deck

- **Board slide 9 says 0.82 kWh/km and 244 km predicted range** for the Mumbai→Pune reference
  trip. **The live app does not match this** — energy use has been observed between **0.95 and
  1.21 kWh/km** across today's test runs (typically ~1.0–1.1 kWh/km for the flagship
  Mumbai→Pune trip), and predicted full range at the flagship 100%-battery run today was
  **183 km**, not 244 km.
- **Root cause, per the app's own code comments:** ORS's `driving-hgv` profile (the only profile
  this project's ORS key can access) routes Mumbai→Pune via the older ghat road — **165 km with
  roughly 2,000 m of climbing** — not the 148 km expressway the deck's number assumed. This is
  documented in the codebase as an intentional, honest recalibration to the real routing data,
  not a bug or a tuning error.
- **This was not fixed by making the app agree with the deck.** The app's own CLAUDE.md
  explicitly recommends updating slide 9 to the app's real, grounded number rather than the
  reverse. Decide before presenting: either update the slide, or reconcile the vehicle/route
  parameters — don't show both numbers side by side unreconciled.
- **New finding from this session's live testing:** the flagship trip's margin is thin enough
  that its outcome *category* — not just the exact decimal — has been observed to change between
  runs with no input change, purely from live weather at request time (e.g. Mumbai→Pune at 100%
  battery showed "not feasible" on one run and "needs one stop, arrive 88%" on another run
  minutes later, both captured this session). Any slide built around a specific verdict for this
  trip should be re-verified against a live run shortly before presenting, not treated as fixed.

---

## Screenshots

Captured live, 2026-08-23 ~19:15–19:28 IST, at 1440px width:

- `factsheet_screenshots/mumbai-pune-result.png` — Mumbai→Pune, 100% battery result (scenario b above)
- `factsheet_screenshots/varanasi-banda-redline.png` — Varanasi→Banda, 1% battery, the red-line/infeasible state (scenario d above)
- `factsheet_screenshots/guarantee-view.png` — Guarantee view, 96.0% guarantee level, priced off the Mumbai→Pune trip above
