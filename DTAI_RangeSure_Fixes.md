# Tata RangeSure — Fix Pack (reviewer feedback + correctness)
### Two prompts for the Claude VS Code extension · quick wins first

Ambarish's 6 suggestions + 2 correctness bugs I caught in the screenshots (negative arrival SOC).
Run **Prompt A (UI)** then **Prompt B (logic)**. Verify, commit after each. None of this is a rebuild.

Mapping to his notes: (1) text overflow → A1 · (2) empty left space / long right scroll → A2 ·
(3) `**` before points → A3 · (4) same charger regardless of battery / nearer-when-low → B2 ·
(5) charger distance on Charging page → A4 · (6) Nashik preset payload 6000 > max 4000 → B1.

---

## PROMPT A — UI quick wins
```
Fix these UI issues in the Next.js app. Keep all logic and APIs intact.

1. TEXT OVERFLOW: long place names (e.g. "Stop at Life Republic, Hingewadi") spill outside the metric
   tiles and the verdict card. Make MetricTile values and the VerdictCard headline wrap to max 2 lines
   then truncate with an ellipsis, with a title/tooltip showing the full text. Scale the font down
   responsively for long values. Nothing may overflow any card at 375px or 1440px.

2. RELOCATE "YOUR TRIP PLAN": on desktop the left column under the input form is empty while the right
   results rail requires long scrolling. Move the "Your Trip Plan" panel (bullets + physics/calibrated
   line + confidence) into that empty left column, directly beneath the inputs, so key details sit
   above the fold and the right rail is shorter. On mobile keep it stacked after the verdict card.

3. STRIP MARKDOWN FROM GUIDANCE: the Gemini tips render literal asterisks (e.g. "Range:**",
   "Charging Stop:**"). Before rendering, strip markdown tokens (**, *, #, backticks) from each tip
   (or render them as real formatting). Bullets must show clean text with NO leading/trailing "**".

4. CHARGING PAGE — DISTANCES: on the Charging network page, for each listed charger show the distance
   in km (haversine) from the searched location, and sort the list nearest-first.

5. NO OVERFLOW ANYWHERE: ensure the Plan Trip results rail and the Guarantee view have no horizontal
   overflow and read cleanly at 375px (mobile) and 1440px (desktop).
```
**VERIFY:** long charger names no longer clip; Trip Plan sits in the former empty left area; tips have no `**`; Charging page shows nearest-first distances.

---

## PROMPT B — Logic / correctness
```
Fix these correctness bugs (some are visible on screen and read as "broken").

1. PAYLOAD CLAMP + PRESETS: payload must never exceed the selected vehicle's max. The "Nashik run"
   preset currently sets payload 6000 while the Ultra E.9 max is 4000 — correct the preset data so
   every preset uses a valid payload <= vehicle.payload_max_kg. Clamp the payload input to
   [0, vehicle.payload_max_kg] with a small helper message on exceed, and re-clamp when the vehicle
   changes.

2. CHARGING-STOP SELECTION (today it names the same charger regardless of battery): make it
   reachability-based. Walk the route cumulatively using per-segment energy and find the distance at
   which SOC would fall to reserve_pct. The recommended stop must be the LAST charger reachable BEFORE
   that breach point (never one you can't reach). Among reachable candidates near the breach, prefer
   the CLOSEST (smallest detour). A lower starting battery must be able to produce a nearer/different
   stop than a high starting battery on the same route.

3. NO NEGATIVE SOC — MULTI-STOP / INFEASIBLE HANDLING: never display negative arrival SOC or negative
   repeatability (screenshots show -196% and -90%). Instead:
   - Cap displayed arrival SOC at 0%. If one full charge cannot rescue the trip, compute how many stops
     are actually required; if feasible with N stops, say "Needs N charge stops" and list them.
   - If no charger is reachable before the reserve breach, show the red-line state:
     "Not feasible from this start SOC — no reachable charger; manual planning advised."
   - Clamp the repeatability band to [0,100]%; when infeasible, show the infeasible state, not a band.
   - Show "Add ~X min" charge time only when a stop can actually rescue the trip.

4. REGRESSION CHECKS: (a) same route at 100% vs 20% start must not always name the same charger;
   (b) selecting "Nashik run" loads payload 4000, not 6000; (c) Varanasi→Banda at 1% start shows an
   honest "not feasible / needs N stops" state, never -196% and never a single 206-min "charge once".
```
**VERIFY:** all three regression checks pass; no negative percentages anywhere; the infeasible case shows a clean red-line message.

---

## One thing to reconcile before the demo (not a code bug)
Grounding the params to the real Ultra E.9 pushed energy use up — your screenshots show ~1.0–1.35
kWh/km and ~148–201 km predicted range, while **board slide 9 says 0.82 kWh/km and 244 km**. That's
the honest calibration working, but the app and deck now disagree. Before Thursday, either update
slide 9 to the app's grounded number (cleanest — it's a real Tata-spec figure) or set the demo
vehicle/params so the reference trip lands back near 0.82. Don't let the panel see the app say 179 km
next to a slide that says 244 km.

## Build order
Prompt A (5 min of quick wins → instantly more polished), then Prompt B (the correctness pass →
removes the credibility-killers), redeploy, run the three regression checks, then reconcile the
deck number. All are additive; your deployed base stays green throughout.
