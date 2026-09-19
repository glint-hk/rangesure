# Tata RangeSure — Complete Build Prompts & Guidelines
### Next.js (App Router, JavaScript) · Real APIs · Gemini for guidance · Driver + Fleet views

This is the single source of truth for building the app. Work top to bottom. Paste each **PROMPT**
block into the **Claude VS Code extension** one at a time, check the **VERIFY** note before moving on,
and commit after each phase. Roles: **you build**; your **validation partner** runs Section 10.

---

## 0. How to run this (read once)

- **One phase at a time.** Paste a PROMPT, let it work, run the app, check the VERIFY box, `git commit`. Do **not** paste the next prompt until the current one passes — agentic builds drift if you batch.
- **Keep the dev server running** in a terminal (`npm run dev`) so you see errors live.
- **Never move on from a broken build.** If a phase fails VERIFY, paste the error back into the extension and ask it to fix, referencing the phase's acceptance criteria.
- **Commit messages** = phase names (`phase-0 scaffold`, `phase-1 routing`, …) so you can roll back.
- **Secrets:** every API key lives in `.env.local` and is read only inside `app/api/*` route handlers. No key ever appears in a client component or in any `NEXT_PUBLIC_` variable.
- **Deck is law.** The board deck has committed to specific numbers (Section 1). The app must reproduce them on the reference trip, or the demo contradicts the deck.

---

## 1. What we're building + the numbers the app MUST hit

**One-liner:** predict real-time range and recommend the most energy-efficient route, speed, and charging stops for an electric truck, so a fleet can complete the trip without range anxiety at the lowest ₹/km.

**Two AI capabilities:** (1) **prediction** — a transparent physics energy/range model; (2) **generation** — Gemini turns the model's numbers into plain-language driver guidance. **Gemini never calculates a number; it only explains the model's output.**

**Reference trip — the demo preset — must match board slide 9:**

| Field | Target |
|---|---|
| Route | Mumbai → Pune, ~148 km (NH48) |
| Inputs | payload 4,000 kg · battery 80% · tariff ₹8.50/kWh |
| Energy use | **0.82 kWh/km** (the one number to calibrate to) |
| Predicted full range | 244 km (⇒ 200 kWh pack) |
| Arrival battery (SOC) | 19% |
| Energy cost | ₹6.97/km |
| Charging need | none ("No stop") |
| Confidence | 85–91% |

These are internally consistent: 0.82 × 8.5 = 6.97; 244 × 0.82 = 200 kWh; 148 × 0.82 = 121.4 kWh; at 80% you start with 160 kWh and arrive with 38.6 kWh = 19%. Hit 0.82 kWh/km and the rest follows.

---

## 2. Prerequisites & API keys (get these first, Day 0)

- **Node.js 18+** and **git** installed. A **GitHub** account and a **Vercel** account (free).
- **OpenRouteService** (routing + elevation + geocoding): sign up at openrouteservice.org → Dashboard → create a token. Free tier is generous. → `ORS_KEY`
- **Open Charge Map** (chargers): register at openchargemap.org → API key. → `OCM_KEY`
- **Open-Meteo** (weather): keyless, nothing to do.
- **Google Gemini** (guidance): go to Google AI Studio (aistudio.google.com) → **Get API key** → create key in a Google Cloud project. Free tier is fine for the demo. → `GEMINI_API_KEY`

> All four calls happen inside server routes, so none of these keys reach the browser. No CORS setup, no referrer restriction needed.

---

## 3. Environment file (`.env.local`, repo root — never commit it)
```
ORS_KEY=your_openrouteservice_token
OCM_KEY=your_openchargemap_key
GEMINI_API_KEY=your_gemini_key
```
Add `.env.local` to `.gitignore` (create-next-app does this by default). Commit `.env.local.example` with the keys blank so teammates know what's needed.

---

## 4. Target project structure
```
rangesure/
├── CLAUDE.md                     # agent context (Section 5) — add before Phase 0
├── .env.local                    # your keys (gitignored)
├── .env.local.example            # blank keys, committed
├── app/
│   ├── layout.js
│   ├── page.js                   # view switch: Plan Trip | Fleet
│   ├── globals.css
│   └── api/
│       ├── route/route.js        # ORS geocode + driving-hgv directions (elevation:true)
│       ├── weather/route.js      # Open-Meteo
│       ├── charging/route.js     # Open Charge Map
│       └── guidance/route.js     # Gemini (server-side; key hidden)
├── components/
│   ├── DriverView.jsx            # inputs → map + six result cards + guidance
│   ├── FleetView.jsx             # N trips table + cost dashboard
│   ├── RouteMap.jsx              # Leaflet map (dynamic import, ssr:false)
│   ├── ResultsPanel.jsx          # the six cards + trip-plan panel + confidence
│   └── GuidancePanel.jsx         # Gemini driver tips
├── lib/
│   ├── energyModel.js            # physics model (Section 6) — PURE, client-side
│   └── segments.js               # haversine + elevation-delta from geometry
└── config.js                     # vehicle params + tariff
```

---

## 5. `CLAUDE.md` — paste into repo root BEFORE Phase 0
```markdown
# Project: Tata RangeSure — EV Truck Range Optimizer

MBA AI-transformation capstone demo. Judged on: problem-solution fit, a genuine AI capability,
live deployment, and usability by a NON-technical person.

## Stack
- Next.js App Router, JavaScript (NOT TypeScript). Plain CSS. Deployed on Vercel.
- Map: react-leaflet + OpenStreetMap tiles. Leaflet touches `window`, so the map component MUST be
  imported with next/dynamic { ssr:false } and rendered only on the client. Import
  'leaflet/dist/leaflet.css' and fix default marker icon URLs or markers won't show.
- ALL external APIs are called from server route handlers in app/api/* — never from the browser:
  - OpenRouteService  -> app/api/route     (profile driving-hgv, elevation:true)
  - Open-Meteo        -> app/api/weather   (keyless)
  - Open Charge Map   -> app/api/charging
  - Google Gemini     -> app/api/guidance  (LLM driver guidance)
- Server-only env vars (NO NEXT_PUBLIC_ prefix): ORS_KEY, OCM_KEY, GEMINI_API_KEY.
- energyModel.js is PURE (no fetch) and runs client-side so sliders recompute instantly.

## The app
Two views switched on the main page:
1. Plan Trip (Driver) — one trip. Inputs: origin, destination, payload (kg), battery %, tariff (₹/kWh).
   Output: route on a map, and six result cards — Trip distance, Energy use (kWh/km),
   Predicted full range (km), Energy cost (₹/km), Arrival battery (%), Charging need — plus a
   "Your Trip Plan" panel (plain bullets), a "Confidence: 85–91%" line, and a limitations note.
2. Fleet — a table of several trucks/trips using the same model, plus aggregate cost-per-km and
   total energy. Sortable, with a small dashboard strip.

## Hard rules
- The physics model is the ONLY source of numbers. Gemini EXPLAINS those numbers and must never
  compute, estimate, or alter any value.
- Usable by a non-technical person: clean, obvious, mobile-friendly.
- Always show the confidence band and the note "Prototype uses assumed vehicle parameters; live BMS
  calibration required before deployment."
- Every API route handles errors and returns clean JSON; the UI never white-screens.
- Reference demo trip Mumbai→Pune (payload 4000, battery 80%, tariff 8.5) must read ~0.82 kWh/km,
  244 km full range, 19% arrival, ₹6.97/km, No stop.
```

---

## 6. Physics model (hand to the agent verbatim in Phase 2)

Per segment `i` — avg speed `v` (m/s), horizontal distance `d` (m), elevation change `Δh` (m):
```
sinθ   = clamp(Δh / d, -0.3, 0.3)
F_roll = Crr · m · g
F_aero = 0.5 · ρ · Cd · A · v_air²         (v_air = v + headwind)
F_grade= m · g · sinθ                       (negative downhill)
F      = F_roll + F_aero + F_grade
E_wh   = F>=0 ? (F·d)/η_dt/3600 : (F·d)·η_regen·η_dt/3600
E_aux  = P_aux · (d/v) / 3600
seg_wh = E_wh + E_aux
```
Totals:
```
kWh_per_km   = (Σ seg_wh / 1000) / total_km
range_km     = battery_kWh / kWh_per_km
arrival_soc  = (battery_kWh·battery_pct/100 − Σ seg_wh/1000) / battery_kWh · 100
feasible     = arrival_soc >= reserve_pct (e.g. 10)
cost_per_km  = kWh_per_km · tariff
```
`config.js` defaults (aligned to the deck from the start):
```js
export const VEHICLE = {
  m_empty: 8000, Crr: 0.007, Cd: 0.7, A: 9, rho: 1.2,
  eta_dt: 0.85, eta_regen: 0.6, P_aux: 3000, battery_kWh: 200, g: 9.81, reserve_pct: 10,
};
export const DEFAULT_TARIFF = 8.5;  // ₹/kWh
```
Reference implementation for `lib/energyModel.js`:
```js
export function estimateTrip({ segments, payloadKg, battery_pct, tariff, params }) {
  const p = params, m = p.m_empty + (payloadKg || 0);
  let total_wh = 0;
  const perSeg = segments.map(s => {
    const v = Math.max(s.avg_speed_ms, 1);
    const sinT = Math.max(-0.3, Math.min(0.3, s.delta_h / Math.max(s.distance_m, 1)));
    const vAir = v + (s.headwind_ms || 0);
    const F = p.Crr*m*p.g + 0.5*p.rho*p.Cd*p.A*vAir*vAir + m*p.g*sinT;
    let e = F >= 0 ? (F*s.distance_m)/p.eta_dt/3600
                   : (F*s.distance_m)*p.eta_regen*p.eta_dt/3600;
    e += (p.P_aux*(s.temp_factor||1)) * (s.distance_m/v) / 3600;
    total_wh += e; return { ...s, wh: e };
  });
  const dist_km = segments.reduce((a,s)=>a+s.distance_m,0)/1000;
  const kWh_per_km = (total_wh/1000)/dist_km;
  const range_km = p.battery_kWh / kWh_per_km;
  const arrival_soc = (p.battery_kWh*(battery_pct/100) - total_wh/1000)/p.battery_kWh*100;
  return {
    total_kWh: total_wh/1000, kWh_per_km, range_km, arrival_soc_pct: arrival_soc,
    cost_per_km: kWh_per_km*tariff, feasible: arrival_soc >= p.reserve_pct,
    confidence_low: 85, confidence_high: 91, perSeg,
  };
}
```

---

## 7. BUILD PROMPTS (paste one at a time)

### PHASE 0 — Scaffold + live URL
**PROMPT**
```
Scaffold a Next.js App Router app named rangesure in JavaScript (NOT TypeScript), no src dir,
plain CSS. Install leaflet and react-leaflet. Build app/page.js as a client component with a
left sidebar nav switching between two components, DriverView (label "Plan Trip") and FleetView
(label "Fleet"); also show disabled placeholder nav items: Trips, Charging, Reports, Settings.
Add config.js exporting VEHICLE and DEFAULT_TARIFF exactly as given in CLAUDE.md. Add a
.env.local.example listing ORS_KEY, OCM_KEY, GEMINI_API_KEY (server-only, no NEXT_PUBLIC_).
Ensure `npm run build` succeeds with no SSR errors.
```
**VERIFY:** `npm run dev` shows the sidebar + two empty views; `npm run build` passes.
**THEN:** push to GitHub, import to Vercel, deploy → save your live URL. (Banks the deployment marks early and flushes out build issues.)

### PHASE 1 — Routing + map
**PROMPT**
```
Create app/api/route/route.js — an async POST handler using OpenRouteService (process.env.ORS_KEY).
Body: { origin, destination } (plain place-name strings).
Step 1 geocode each: GET
  https://api.openrouteservice.org/geocode/search?api_key=<ORS_KEY>&text=<place>&boundary.country=IN&size=1
  take features[0].geometry.coordinates -> [lon,lat] and features[0].properties.label.
Step 2 route with elevation: POST
  https://api.openrouteservice.org/v2/directions/driving-hgv/geojson
  headers { Authorization: <ORS_KEY>, "Content-Type": "application/json" }
  body { "coordinates": [[lon1,lat1],[lon2,lat2]], "elevation": true, "instructions": false }
  response GeoJSON: features[0].geometry.coordinates = [lon,lat,elevation] triples;
  features[0].properties.summary.distance (m) and .duration (s).
Return JSON { start:{lat,lon,label}, end:{lat,lon,label}, distance_m, duration_s,
  coordinates:[[lon,lat,ele],...] }. On any ORS non-200 return Response.json({error,detail},{status}).
Never put the key in the response.

Build DriverView.jsx with inputs: origin, destination, payload (kg), battery %, tariff (default from
config). On "Optimise Trip" POST to /api/route and draw the route as a polyline on a Leaflet map in
RouteMap.jsx, with start/end markers and a "Recommended route · <N> km" badge. IMPORTANT: import
RouteMap via next/dynamic with { ssr:false }, import 'leaflet/dist/leaflet.css', and fix the default
marker icon URLs. Show loading and error states.
```
**VERIFY:** Mumbai → Pune draws a truck route with a distance badge (~148 km) and start/end markers.

### PHASE 2 — Energy model + six result cards
**PROMPT**
```
Add lib/energyModel.js EXACTLY as the reference implementation in CLAUDE.md/spec (pure, no fetch).
Add lib/segments.js: turn the ORS coordinates into segments — for each consecutive [lon,lat,ele]
pair compute distance_m (haversine), delta_h (ele difference), and avg_speed_ms
(= total distance_m / total duration_s from the route). Feed segments + payload + battery% + tariff
into estimateTrip().
Build ResultsPanel.jsx showing exactly these SIX cards, in order and wording:
  Trip distance (km) · Energy use (kWh/km) · Predicted full range (km) · Energy cost (₹/km) ·
  Arrival battery (%) · Charging need ("No stop" when feasible).
Below the cards add a "YOUR TRIP PLAN" panel with 2–4 plain bullets, a "Confidence: 85–91%" line,
and the note "Prototype uses assumed vehicle parameters; live BMS calibration required before
deployment." Recompute live when payload/battery/tariff change (no refetch). Comment each physics
line with the formula it implements.
```
**VERIFY:** heavier payload lowers range every time; sliders update the cards without refetching; arrival % and range are self-consistent (range = 200 / kWh_per_km).

### PHASE 3 — Weather + charging
**PROMPT**
```
Create app/api/weather/route.js (Open-Meteo, keyless): GET
  https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,wind_speed_10m,precipitation
for the route midpoint; return { temp_c, wind_ms, precip, temp_factor } where temp_factor is +30%
(1.3) below 5°C or above 35°C, else 1.0. DriverView applies temp_factor (and a simple headwind
estimate) to segments before estimateTrip.
Create app/api/charging/route.js (Open Charge Map, process.env.OCM_KEY): GET
  https://api.openchargemap.io/v3/poi?output=json&latitude=<lat>&longitude=<lon>&distance=<km>&distanceunit=KM&maxresults=8&key=<OCM_KEY>
near the route; return a list of { title, lat, lon }. In the UI show chargers as map markers; if the
trip is NOT feasible, pick the best stop along the route, highlight it, and set Charging need to
"Stop at <title>". Both routes return clean JSON errors.
```
**VERIFY:** weather visibly shifts kWh/km; a low-battery or long-hilly trip flips to "Stop at …" with a highlighted charger.

### PHASE 4 — Gemini driver guidance (server route)
**PROMPT**
```
Create app/api/guidance/route.js — an async POST handler using the Google Gemini API with
process.env.GEMINI_API_KEY. Body: a tripSummary the physics model already computed:
{ distance_km, kwh_per_km, predicted_full_range_km, arrival_soc_pct, cost_per_km, charging_needed,
  recommended_speed_kmh, notable_climb, weather }.
Call:
  POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
  headers { "Content-Type": "application/json", "x-goog-api-key": <GEMINI_API_KEY> }
  body {
    "system_instruction": { "parts": [{ "text":
      "You are a driver-assistance guidance writer for an EV truck trip planner. You receive numbers
       ALREADY computed by a deterministic physics model. Your ONLY job is to explain them in 3-4
       short, plain-language bullets a truck driver can act on. NEVER compute, estimate, or change any
       number; only use numbers present in the input. Cite the numbers. If a named climb is provided,
       give a safe speed range for it. Stay calm and factual; never overstate confidence." }] },
    "contents": [{ "role": "user", "parts": [{ "text": <JSON.stringify(tripSummary)> }] }],
    "generationConfig": { "maxOutputTokens": 400, "temperature": 0.4 }
  }
Parse the reply text from data.candidates[0].content.parts[].text (join the parts). Return
{ tips: <text> }. If the call fails or returns no candidate, return a rule-based fallback built ONLY
from the input numbers so the UI never breaks (set { fallback: true }).
Build GuidancePanel.jsx to POST the computed summary to /api/guidance and render the tips with a
loading state. The Gemini key stays server-side; never expose it.
```
**VERIFY:** after a calculation, 3–4 realistic tips appear (e.g. "Keep 58–62 km/h through the Lonavala climb; expected arrival battery 19%"); killing the key still yields fallback tips, no crash.

> **You now have a complete, demoable driver app.** Fleet view (Phase 5) is additive — if Thursday gets tight, ship after this + the Alignment Pass.

### PHASE 4.5 — Deck Alignment & Calibration (do before Fleet)
**PROMPT**
```
Add a one-click "Mumbai → Pune" demo preset that fills origin=Mumbai, destination=Pune, payload=4000,
battery=80, tariff=8.5, then runs the trip. Also add a second preset "Nashik run (needs charge)" with
a longer route and lower battery so it triggers a charging stop.
Run the Mumbai→Pune preset with the real ORS route+elevation and console.log the computed kwh_per_km.
Target ≈ 0.82 kWh/km (which yields 244 km full range, 19% arrival, ₹6.97/km). If it is off by more
than ~0.03, expose Cd, Crr, P_aux and eta_regen in config.js with comments and nudge them so the
reference trip lands ≈0.82 — do NOT hardcode outputs; the model must keep computing live from the
real route. Print a one-line calibration summary to the console for our validation partner.
```
**VERIFY:** the Mumbai→Pune preset reads ≈ 148 km, 0.82 kWh/km, 244 km, 19%, ₹6.97/km, No stop.

### PHASE 5 — Fleet view
**PROMPT**
```
Build FleetView.jsx: a preset list of 6 trucks/trips (origin, destination, payload, battery%). For
each, POST to /api/route and run estimateTrip; render a sortable table (truck, route, distance,
kWh/km, ₹/km, range, arrival %, feasibility badge). Above it, a dashboard strip: fleet total energy
(kWh), average ₹/km, and count of trips needing a charge stop. Reuse the same lib + routes; limit
concurrent /api/route calls (e.g. 2 at a time) to avoid ORS rate limits.
```
**VERIFY:** the table fills from the model, sorting works, totals are correct.

### PHASE 6 — Polish + deploy
**PROMPT**
```
Add: (1) loading spinners and friendly error messages on every fetch; (2) an "Assumptions" info
popover listing the vehicle params, tariff, and the 85–91% confidence rationale; (3) a responsive
layout that works on a phone; (4) empty/initial states for both views. Run `npm run build` clean and
redeploy to Vercel.
```
**VERIFY:** both presets run end-to-end from one click; clean on mobile; production build passes; live URL works.

---

## 8. Deploy (Vercel) — detailed
1. `git push` the repo to GitHub (you need the repo link for submission).
2. In Vercel, **Add New → Project → import** the repo. It auto-detects **Next.js**.
3. **Settings → Environment Variables**: add `ORS_KEY`, `OCM_KEY`, `GEMINI_API_KEY` (all environments). No `NEXT_PUBLIC_`.
4. **Deploy.** Open the URL, run both presets. Re-test on a **different device** and on **mobile**.
5. **Record a backup screen capture** of both presets working — campus wifi / API rate limits can bite on demo day.

---

## 9. Demo hooks (hand to Module A for slide-8 live demo)
- Open on **"Mumbai → Pune"** preset → route, six cards, then the Gemini guidance. ~90s. (Numbers match slide 9.)
- Switch to **"Nashik run (needs charge)"** → app catches an infeasible trip and recommends a charge stop. The money moment — visibly solves range anxiety. ~60s.
- Flip to **Fleet** → "and at scale, here's cost-per-km across the fleet." ~30s.
- Close on the **Assumptions popover** → "honest confidence band; synthetic payload; production ingests live BMS/Fleet Edge." Pre-empts the CDO. ~20s.

---

## 10. VALIDATION PARTNER block (your module-mate owns this)
Paste into their VS Code extension, or run as a manual checklist. Maps directly to the deck's pilot gates (slide 10).
```
Validate Tata RangeSure against the board deck before demo day. Report pass/fail per item.

1. REFERENCE TRIP (slide 9): run the Mumbai→Pune preset (payload 4000, battery 80%, tariff 8.5).
   The six cards must read ≈ 148 km, 0.82 kWh/km, 244 km range, 19% arrival, ₹6.97/km, No stop.
   Flag any card off by >5%.
2. RANGE-ERROR GATE (≤10%): hand-calc kWh/km for the reference trip and compare; confirm
   range_km = battery_kWh / kwh_per_km and arrival_soc math are exact.
3. MONOTONIC BEHAVIOUR (5+ inputs): heavier payload always lowers range; lower battery % eventually
   flips "No stop" → charge stop; a long hilly route triggers a stop.
4. EXPLAIN-ONLY RULE: read Gemini's tips on several trips — every number stated must already appear
   in the model output. Any invented or altered number is a FAIL.
5. HONESTY GATES: the "Confidence: 85–91%" line, the Assumptions popover, and the "live BMS
   calibration required" note are all present.
6. RESILIENCE: bad city name, killed wifi, and a forced API 500 each show a clean error, never a
   white screen. Both presets run end-to-end from one click.
7. DEPLOY: Vercel URL works on a fresh device and on mobile; backup screen recording exists.
```

---

## 11. Troubleshooting (save yourself an hour)
- **Map crashes / "window is not defined":** you rendered Leaflet on the server. Import RouteMap with `next/dynamic` `{ ssr:false }` and only render it client-side.
- **Map markers invisible:** fix Leaflet's default icon paths (import the marker PNGs and set `L.Marker.prototype.options.icon`), and import `'leaflet/dist/leaflet.css'`.
- **ORS 403/401:** the directions call needs the key in the **Authorization header**, not the query string; geocoding uses `?api_key=`.
- **ORS elevation missing:** you must send `"elevation": true` **and** use the `/geojson` directions endpoint; elevation is the 3rd value in each coordinate triple.
- **Gemini 400/404:** check the model name (`gemini-2.5-flash`; fall back to `gemini-2.0-flash` or `gemini-flash-latest` if your key/region lacks it) and that the body uses `system_instruction` + `contents[].parts[].text`. Read the reply from `candidates[0].content.parts[].text`.
- **Env vars undefined in the route:** restart `npm run dev` after editing `.env.local`; names must match exactly and have no `NEXT_PUBLIC_` prefix.
- **Rate limits (fleet view):** cap concurrent /api/route calls; cache results in state so re-sorts don't refetch.

---

## 12. Submission checklist
- [ ] Live app **URL** (Vercel), tested on another device + mobile
- [ ] **GitHub** repo link
- [ ] **1-page Application Brief** (use case · AI capability · data inputs · key output · KPI · limitations)
- [ ] Backup **screen recording** of both presets
- [ ] Reference trip matches slide 9 (or slide 9 updated to the app's real number at Sync 1)
- [ ] AI-generated code disclosed; external data sourced or marked as estimates
- [ ] Every member can explain the app's AI logic (physics predicts, Gemini explains, driver decides)
