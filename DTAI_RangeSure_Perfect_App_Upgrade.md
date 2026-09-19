# Tata RangeSure — "Perfect App" Upgrade Pack
### Fixing the gaps from the devil's-advocate review · prompts for the Claude VS Code extension

This pack upgrades the working app (Phases 0–6) into a board-grade, genuinely-AI, mobile+desktop
product. Run the prompts in order. **P0 = credibility-critical (do these first). P1 = elevates
(do if time remains before Thursday).** Each block is paste-ready; check VERIFY before moving on.

---

## Why this exists (the gaps we're closing)

1. **"Where's the AI?"** — the app was a physics formula + an LLM paraphrasing it. Add a real learning element and real generative use. *(P1-1)*
2. **"Whole-journey" was faked** — uniform average speed + one weather point; climb advice wasn't derived from the route. *(P0-3)*
3. **No repeatability** — one point estimate, no best/expected/worst. *(P1-2)*
4. **Charge "where" but not "how long"** — no charge-time or delivery-window impact. *(P1-3)*
5. **Reverse-engineered numbers** — params fudged to match a slide instead of grounded in the real truck. *(P0-2)*
6. **App never refuses** — but the governance slide promises a red-line fallback. *(P0-4)*
7. **UI looks like a class project** and treats mobile as an afterthought. *(P0-1)*

> Deck inconsistency to tell Module A: the **title slide shows a Prima E.55S** (450 kWh, 38 t payload, ~350 km) but **slide 9's numbers** (4,000 kg payload, 244 km, ~200 kWh) are a **medium Ultra-class** truck. Pick one. Cheapest fix: keep slide 9, make the demo vehicle the Ultra-class truck, and either swap the title image or label it illustrative.

---

## Grounding data — real Tata electric truck specs (use these, cite the source)

Source: Tata Motors CV / Auto Expo 2025 & 2026 delivery releases. Mark any derived value as an estimate.

| Model | Battery (kWh) | GVW (kg) | Payload (kg) | Claimed range (km) | Notes |
|---|---|---|---|---|---|
| Tata Ace EV | ~21–27 | ~1,500 | ~750 | ~150 | last-mile |
| Tata Ultra E.9 | ~200 (est) | ~11,000 | 4,000 | up to 230 | **demo default — matches slide 9** |
| Tata Prima E.28K | 453 | 28,000 | — | up to 220 | heavy hub-to-hub |
| Tata Prima E.55S | 450 | 55,000 | 38,000 | up to 350 | 55-t tractor; title-slide truck |

Common: LFP packs, regenerative braking, dual CCS2 fast charging, ADAS. Derived physics params
(Cd, Crr, frontal area) are engineering estimates for a box truck / tractor and must be labelled as such.

---

## P0-1 — Design overhaul (board-grade, mobile + desktop)

**PROMPT**
```
Redesign the app UI to look like a premium product, not a prototype. Keep all existing logic/APIs.

Design system:
- Install and use shadcn/ui (Radix + Tailwind). Use Tailwind for all styling. Remove ad-hoc CSS.
- I will also pull specific polished components from https://21st.dev — leave clear component
  boundaries (Card, Button, Badge, Tabs, Sheet, Skeleton, Tooltip) so I can swap in 21st.dev
  variants without refactoring.
- Theme: dark "cockpit" matching our Tata deck. Background deep navy (#0A0F1E / #0B1220),
  surfaces #111A2E, text near-white, PRIMARY accent electric blue (#1EA7FF), SUCCESS lime-green
  (#8BE04A), WARNING amber, DANGER red. Use one clean sans (Inter). Generous spacing, rounded-2xl
  cards, soft shadows, subtle borders. Add tasteful micro-motion (Framer Motion optional) on result reveal.

Layout — RESPONSIVE, two primary surfaces:
- MOBILE (driver, primary, <768px): single column. Top: compact trip inputs in a collapsible
  Sheet. Center: a large HERO VERDICT card — a big ✅/⚠️ status, the headline "You'll make it —
  arrive 19%" (or "Charge once at <place>"), and the confidence range. Below it: the six metrics as
  a 2-col grid of small stat tiles, then the map, then the guidance. Thumb-reachable "Optimise" button.
- DESKTOP (fleet manager, >=1024px): three-pane — left inputs, center map, right results rail with
  the hero verdict on top and metric tiles below. Fleet view = full-width data table + dashboard strip.

Components to build with shadcn:
- VerdictCard (hero): status color, headline, sub-line, confidence range, a small "why" affordance.
- MetricTile: label + big value + unit + optional trend/again.
- Nav: sidebar on desktop, bottom tab bar on mobile (Plan Trip, Fleet; Trips/Charging/Reports/
  Settings visible-disabled).
- Loading uses shadcn Skeletons, not spinners-on-blank.
Ensure it looks intentional and clean at 375px (iPhone) and 1440px (laptop).
```
**VERIFY:** looks premium and correct at 375px and 1440px; the verdict is readable at a glance; no raw/unstyled elements.

> Using 21st.dev: browse it for "dashboard", "stat card", "map sidebar", "verdict/result" patterns; copy the component code (or use its Magic MCP if you have it) into the matching shadcn component. Keep our theme tokens above so pasted components inherit the cockpit look.

## P0-2 — Ground the model in the real Tata vehicle + selector

**PROMPT**
```
Replace the synthetic vehicle constants with real Tata electric-truck presets and add a vehicle selector.
In config.js export VEHICLES as an array of presets using the specs table in our upgrade doc
(Ace EV, Ultra E.9, Prima E.28K, Prima E.55S) — each with { name, battery_kWh, gvw_kg, payload_max_kg,
claimed_range_km } and engineering-estimate physics params { Crr, Cd, A, eta_dt, eta_regen, P_aux }
clearly commented as estimates. Default the demo to "Ultra E.9" (battery ~200 kWh, payload cap 4000 kg)
so it matches board slide 9. Add a vehicle dropdown to the Plan Trip inputs; selecting a vehicle sets
battery_kWh, payload cap and physics params. Show a small "specs" tooltip citing "Tata Motors CV,
Auto Expo 2025 / 2026 delivery releases (estimated physics params)". Clamp payload input to the
selected vehicle's max.
```
**VERIFY:** switching vehicles changes range/energy sensibly; Ultra E.9 on Mumbai→Pune stays near slide 9; Prima E.55S shows a much larger battery and range.

## P0-3 — Real segment intelligence (make "whole-journey" true)

**PROMPT**
```
Upgrade lib/segments.js and the model to be genuinely segment-level:
- Compute per-segment gradient from the real elevation triples (delta_h / segment_distance), not a
  single average. Keep per-segment energy in perSeg.
- Detect the steepest sustained CLIMB on the route (max positive gradient run) and its approximate
  location; reverse-geocode or use the nearest route town name via ORS so guidance can NAME it.
- Sample weather at 3–4 points along the route (start, 1–2 midpoints, end) via /api/weather and apply
  each to the nearby segments (temp_factor + headwind), instead of one midpoint sample.
- Derive the recommended eco-speed from the steepest climb segment (a lower safe speed there), and
  pass { notable_climb: {name, grade_pct}, recommended_speed_kmh } into the guidance payload so the
  LLM's advice is grounded in real computed values, never invented.
```
**VERIFY:** the named climb and its grade come from the actual route; changing origin/destination changes the named climb; guidance references real numbers.

## P0-4 — Red-line / low-confidence fallback (make governance real)

**PROMPT**
```
Implement the governance red-line from our deck. Add a confidence/gating layer:
- Compute a data-quality flag: any API failed, weather stale/missing, or elevation missing -> degraded.
- Compute margin: arrival_soc_pct minus reserve_pct. If margin is within the model's ±band (i.e. the
  worst-case scenario would breach reserve), mark the trip UNCERTAIN.
- If degraded OR uncertain, the VerdictCard must NOT show a green go/no-go. Instead show an amber state:
  "Low confidence — manual planning advised", list the reason (e.g. "weather data unavailable" or
  "arrival margin within uncertainty band"), and still show the raw numbers with the wider band.
- Add a small "Safe fallback active" badge. Log the decision (inputs, model version, confidence,
  verdict/fallback) to the browser console as a stand-in trip log.
```
**VERIFY:** a near-empty battery or a killed weather API produces the amber "manual planning advised" state, not a confident green — this is a demo highlight.

---

## P1-1 — Real AI: learned calibration + Gemini what-if

**PROMPT**
```
Add a genuine learning element on top of the physics baseline (the "data flywheel" from our deck).
1. Create data/tripHistory.js: generate ~1,500 synthetic past-trip records with realistic features
   (distance, avg_gradient, payload, temp, avg_speed) and an "actual_kwh_per_km" = physics estimate
   times a bias that depends on features (e.g. cold + heavy + hilly consistently under-predicted) plus
   noise. Document that this stands in for real Fleet Edge trip outcomes.
2. Create lib/calibration.js: fit a SIMPLE, transparent correction (multivariate linear regression
   via normal equations, or a small gradient-descent fit — no external ML lib needed) mapping trip
   features -> correction_factor on that synthetic history. Expose calibrate(features) -> factor and
   the learned coefficients.
3. In the driver flow, show BOTH numbers: "Physics estimate 0.82 kWh/km → Calibrated 0.80 kWh/km
   (learned from 1,500 trips)" with a one-line "what the model learned" (e.g. "cold + heavy loads use
   ~4% more than physics predicts"). Use the calibrated value for the verdict.
4. Add a natural-language "Ask" box that sends the current trip context + the user question to
   /api/guidance (Gemini) for what-if answers ("what if I add 3 tonnes?", "leave at 2pm instead?").
   Gemini may reason over the provided numbers/model but MUST call out that final numbers come from
   the model, and must not invent figures.
Keep everything explainable — show the coefficients on an "AI model" info panel.
```
**VERIFY:** the calibrated number differs from physics in a sensible, feature-dependent way; the "what the model learned" line is real; the Ask box answers what-ifs grounded in the numbers.

## P1-2 — Confidence scenario band (repeatability)

**PROMPT**
```
Run the model three times per trip — BEST (empty roads, mild temp, tailwind assist), EXPECTED
(current conditions), WORST (peak traffic slowdown, temperature penalty, headwind, +10% payload
uncertainty) — and display a range for arrival SOC and range_km, e.g. "Arrival 15–23% (expected 19%)".
Frame it as "Repeatability: can this route be trusted day after day?" Render as a small horizontal
band/gauge on the VerdictCard. This replaces the flat ±12% with something concrete.
```
**VERIFY:** the three scenarios differ sensibly; a marginal trip shows the worst case breaching reserve (and should then trigger P0-4's uncertain state).

## P1-3 — Charge time + delivery-window impact

**PROMPT**
```
When a charging stop is required, compute charge time = kWh_needed / charger_power_kW (assume a
default DC fast-charge power, e.g. 120 kW, configurable) and show "Add ~35 min at <charger>". If the
user enters a delivery-window (optional input, hours), show whether the stop fits ("On time" / "Risks
delivery window by ~20 min"). Surface this on the VerdictCard for needs-charge trips.
```
**VERIFY:** an infeasible trip shows a concrete added-minutes figure and a window verdict.

## P1-4 — Fleet insight (make the fleet view say something)

**PROMPT**
```
Upgrade FleetView from a plain table to a small decision surface: keep the sortable table but add a
top dashboard strip with fleet avg ₹/km, total energy, and "N of M trips need a charge stop"; flag
MARGINAL trips (arrival SOC within 5 pts of reserve) in amber and INFEASIBLE in red; add one insight
line ("2 routes are marginal under worst-case — assign the Prima E.55S or add a planned charge").
Make the vehicle per-row selectable so a manager can test re-assigning a truck to a route.
```
**VERIFY:** marginal/infeasible trips are flagged; changing a truck assignment updates feasibility.

---

## Validation additions (hand to your validation partner)
```
On top of the earlier checklist, verify the upgrade:
- DESIGN: usable and clean at 375px and 1440px; hero verdict readable at a glance; no unstyled elements.
- GROUNDING: each vehicle's range/energy tracks its real spec direction; params labelled as estimates.
- SEGMENT TRUTH: the named climb + grade come from the actual route and change with the route.
- RED-LINE: low battery or a killed weather API yields "manual planning advised", never a green go.
- AI: calibrated value differs from physics in a feature-sensible way; coefficients are visible; the
  Ask box never invents numbers.
- SCENARIOS: best/expected/worst differ sensibly and are internally consistent with the verdict.
```

## Build order & time-boxing
Do **P0-1 → P0-2 → P0-3 → P0-4** first — after these the app is board-grade, honest, and demo-safe.
Then **P1-1** (the "real AI" answer — highest payoff with this professor), then P1-2/3/4 as time allows.
Re-run the Mumbai→Pune (Ultra E.9) preset after each phase and keep it aligned to slide 9 (or update
slide 9 to the app's grounded number at your next sync). Commit after every phase.
