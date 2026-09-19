# Module B — EV Truck Range Optimizer · Build Pack
### Next.js (App Router, JavaScript) · Real APIs · Driver + Fleet views

Build by pasting the **phased prompts** (Section 6) one at a time into the **Claude VS Code extension**, verifying each phase's acceptance criteria before moving on. Drop the **`CLAUDE.md`** (Section 4) into your repo root first so the agent stays grounded across turns.

---

## 1. What we're building (the one-liner the whole team shares)

> *An app that predicts real-time range and recommends the most energy-efficient route, speed profile, and charging stops for an electric truck — so a fleet driver/manager can complete the trip without range anxiety and at the lowest cost-per-km.*

**AI capabilities (both, so the "genuine AI" mark is unambiguous):**
1. **Prediction** — a transparent physics-based energy/range model over the actual route (with a confidence band).
2. **Generation** — an LLM turns the numbers into plain-language driver guidance.

**KPIs every output maps to:** cost-per-km (₹/km), range confidence, fleet uptime, EV-fleet conversion.

---

## 2. The stack (and why Next.js is the right call)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router, JavaScript — not TS)** | server route handlers hide every key |
| UI | **React** (client components) + plain CSS | simple |
| Map | **Leaflet** via `react-leaflet`, dynamically imported `ssr:false` | free tiles, no key |
| Routing + elevation + geocoding | **OpenRouteService** (`driving-hgv` profile) | free key, truck routing, returns elevation |
| Weather | **Open-Meteo** | keyless, free |
| Charging stations | **Open Charge Map** | free key |
| LLM guidance | **Anthropic API** | called from a server route only |
| Deploy | **Vercel** (Next.js preset) | free, instant URL |

> ✅ **The key story is now clean.** Every external API is called from a **server-side route handler** (`app/api/*`). Your keys live in server-only env vars (no `NEXT_PUBLIC_` prefix) and never ship to the browser; the frontend only ever calls your own `/api/*` endpoints. No CORS issues, nothing to restrict-by-referrer, and a straight answer when the CDO asks "where do your credentials live?"

### Get your keys (Day 0)
- **OpenRouteService:** openrouteservice.org → dashboard → API key (free tier is generous).
- **Open Charge Map:** openchargemap.org → register → API key (free).
- **Open-Meteo:** keyless, nothing to do.
- **Anthropic:** console.anthropic.com → API key (used only by `app/api/guidance`).

Put them in `.env.local` as `ORS_KEY`, `OCM_KEY`, `ANTHROPIC_API_KEY` — **no `NEXT_PUBLIC_` prefix**, so they stay server-side.

---

## 3. Project structure (target)
```
ev-range-optimizer/
├── CLAUDE.md                     # agent context (Section 4)
├── .env.local                    # ORS_KEY=  OCM_KEY=  ANTHROPIC_API_KEY=
├── app/
│   ├── layout.js
│   ├── page.js                   # view switch: Driver | Fleet
│   ├── globals.css
│   └── api/
│       ├── route/route.js        # ORS geocode + directions (driving-hgv, elevation:true)
│       ├── weather/route.js      # Open-Meteo
│       ├── charging/route.js     # Open Charge Map
│       └── guidance/route.js     # Anthropic (server-side; key never exposed)
├── components/
│   ├── DriverView.jsx            # single trip: inputs → map + results + guidance
│   ├── FleetView.jsx             # N trips table + cost dashboard
│   ├── RouteMap.jsx              # Leaflet map (imported dynamically, ssr:false)
│   ├── ResultsPanel.jsx          # range, kWh/km, ₹/km, confidence band
│   └── GuidancePanel.jsx         # LLM driver recommendations
├── lib/
│   ├── energyModel.js            # physics model (Section 5) — PURE, runs client-side
│   └── segments.js               # derive segments (haversine + elevation) from geometry
└── config.js                     # default vehicle params + tariff
```
**Split:** all *keyed* API calls live in `app/api/*` (server). The **energy model runs client-side** (it needs no key) so results update instantly when the user drags the payload/battery sliders — no refetch.

---

## 4. `CLAUDE.md` — paste into repo root before Phase 0
```markdown
# Project: EV Truck Range Optimizer

Client demo for an MBA AI-transformation capstone. Judged on: problem-solution fit,
a genuine AI capability, live deployment, and usability by a NON-technical person.

## Stack
- Next.js App Router, JavaScript (NOT TypeScript). Plain CSS. Deployed on Vercel.
- Map: react-leaflet + OpenStreetMap tiles. Leaflet touches `window`, so the map component
  MUST be dynamically imported with { ssr: false } and only rendered on the client.
- ALL external APIs are called from server route handlers in app/api/* — never from the browser:
  - OpenRouteService (routing/elevation/geocoding, profile `driving-hgv`)  -> app/api/route
  - Open-Meteo (weather, keyless)                                          -> app/api/weather
  - Open Charge Map (chargers)                                             -> app/api/charging
  - Anthropic Messages API (LLM driver guidance)                           -> app/api/guidance
- Env vars are SERVER-ONLY (no NEXT_PUBLIC_ prefix): ORS_KEY, OCM_KEY, ANTHROPIC_API_KEY.
- The energy model (lib/energyModel.js) is PURE (no fetch) and runs client-side.

## The app
Two views, switched on the main page:
1. Driver view — one trip. Inputs: origin, destination, payload (kg), current battery %,
   electricity tariff (₹/kWh). Output: route on map, predicted range, kWh/km, ₹/km, whether a
   charging stop is needed (and where), a recommended eco speed, a CONFIDENCE BAND, and
   plain-language guidance from the LLM.
2. Fleet view — a table of several trucks/trips using the same model, plus aggregate
   cost-per-km and total energy. Sortable. A simple dashboard.

## Non-negotiables
- Usable by a non-technical person. Clean, obvious UI. Mobile-friendly.
- Always show an honest confidence band and a one-line limitations note.
- Every number must trace to a KPI: ₹/km, range confidence, uptime, EV-fleet conversion.
- Every API route handles errors and returns a clean JSON error; the UI never white-screens.
- Keep energyModel.js pure and comment each physics line with the formula it implements.

## Coding conventions
- Small components, clear names. No secrets in any client component or NEXT_PUBLIC_ var.
```

---

## 5. The physics model (lock this down — it's the most error-prone part)

Per route segment `i` (between two elevation points), average speed `v` (m/s), horizontal distance `d` (m), elevation change `Δh` (m):

```
sinθ   = clamp(Δh / d, -0.3, 0.3)                     // road grade
F_roll = Crr · m · g                                   // rolling resistance
F_aero = 0.5 · ρ · Cd · A · v²                         // aerodynamic drag (use v_air w/ headwind)
F_grade= m · g · sinθ                                  // gradient (negative downhill)
F_trac = F_roll + F_aero + F_grade

E_wh   = if F_trac >= 0:  (F_trac · d) / η_dt / 3600            // Wh, drivetrain loss
         else:            (F_trac · d) · η_regen · η_dt / 3600  // regen recovery (negative)
E_aux  = P_aux · (d / v) / 3600                         // HVAC/aux over segment time, Wh
segment_wh = E_wh + E_aux
```
Sum over segments → `total_wh`. Then:
```
kWh_per_km   = (total_wh / 1000) / total_distance_km
range_km     = usable_battery_kWh / kWh_per_km
usable_now   = battery_kWh · (battery_pct / 100)
trip_feasible= usable_now >= total_wh / 1000
cost_per_km  = kWh_per_km · tariff_₹_per_kWh
```
Weather adjustment (explicit multipliers): cold/hot → `P_aux *= f_temp(T)` (e.g. +30% below 5 °C or above 35 °C); headwind → `v_air = v + headwind` inside `F_aero` only.

**Default params (`config.js`) — synthetic but realistic; state them as assumptions in the UI:**
```js
export const VEHICLE = {
  m_empty: 8000,   // kg (medium e-truck, empty)
  Crr: 0.007, Cd: 0.7, A: 9, rho: 1.2,
  eta_dt: 0.85,    // drivetrain efficiency
  eta_regen: 0.6,  // fraction of downhill energy recovered
  P_aux: 3000,     // W baseline HVAC/aux
  battery_kWh: 200,
  g: 9.81,
};
export const DEFAULT_TARIFF = 8;   // ₹/kWh (assumption)
```
`m = m_empty + payloadKg`. **Confidence band:** report range `±12%` (synthetic payload/aero, no live BMS). Show it; don't hide it.

**Reference implementation** (hand to the agent verbatim in Phase 2):
```js
// lib/energyModel.js
export function estimateTrip({ segments, payloadKg, battery_pct, tariff, params }) {
  const p = params, m = p.m_empty + (payloadKg || 0);
  let total_wh = 0;
  const perSeg = segments.map(s => {
    const v = Math.max(s.avg_speed_ms, 1);
    const sinT = Math.max(-0.3, Math.min(0.3, s.delta_h / Math.max(s.distance_m, 1)));
    const vAir = v + (s.headwind_ms || 0);
    const F_roll = p.Crr * m * p.g;
    const F_aero = 0.5 * p.rho * p.Cd * p.A * vAir * vAir;
    const F_grade = m * p.g * sinT;
    const F = F_roll + F_aero + F_grade;
    let e = F >= 0 ? (F * s.distance_m) / p.eta_dt / 3600
                   : (F * s.distance_m) * p.eta_regen * p.eta_dt / 3600;
    const P_aux = p.P_aux * (s.temp_factor || 1);
    e += P_aux * (s.distance_m / v) / 3600;
    total_wh += e;
    return { ...s, wh: e };
  });
  const dist_km = segments.reduce((a, s) => a + s.distance_m, 0) / 1000;
  const kWh_per_km = (total_wh / 1000) / dist_km;
  const range_km = p.battery_kWh / kWh_per_km;
  const usable_now = p.battery_kWh * (battery_pct / 100);
  return {
    total_kWh: total_wh / 1000, kWh_per_km, range_km,
    cost_per_km: kWh_per_km * tariff,
    trip_feasible: usable_now >= total_wh / 1000,
    confidence_pct: 12, perSeg,
  };
}
```

---

## 6. Phased build prompts (paste one at a time into Claude in VS Code)

### Phase 0 — Scaffold + live URL (do this Day 0)
```
Scaffold a Next.js App Router app named ev-range-optimizer in JavaScript (NOT TypeScript),
no src dir, plain CSS. Install leaflet and react-leaflet. Build app/page.js as a client
component with a top nav switching between two placeholder components, DriverView and FleetView.
Add config.js exporting VEHICLE and DEFAULT_TARIFF (values from CLAUDE.md). Add a
.env.local.example listing ORS_KEY, OCM_KEY, ANTHROPIC_API_KEY (server-only, no NEXT_PUBLIC_).
Ensure `npm run build` works with no SSR errors.
ACCEPTANCE: dev server shows the nav + two empty views; production build succeeds.
```
> Then `vercel` deploy to get your live URL today — banks the deployment marks early and flushes out build issues.

### Phase 1 — Routing + map (Driver view core)
```
Create app/api/route/route.js (a POST handler) that uses OpenRouteService with process.env.ORS_KEY:
- geocode both origin and destination text via the geocode/search endpoint,
- then POST v2/directions/driving-hgv with { coordinates, elevation: true },
- return { geometry (lon,lat,elevation triples), distance_m, duration_s, start, end }.
Handle errors as clean JSON. Build DriverView.jsx with inputs: origin, destination, payload (kg),
battery %, tariff (₹/kWh, default from config). On "Calculate" it POSTs to /api/route and renders
the route as a polyline on a Leaflet map in RouteMap.jsx. IMPORTANT: import RouteMap with
next/dynamic and { ssr:false }, import 'leaflet/dist/leaflet.css', and fix the default marker
icon URLs so markers render. Show distance + duration. Loading + error states required.
ACCEPTANCE: two real Indian cities draw the truck route with start/end markers and show distance.
```

### Phase 2 — Energy + range model
```
Add lib/energyModel.js EXACTLY as in CLAUDE.md (pure, no fetch). Add lib/segments.js that turns
the ORS geometry into segments: for each consecutive point pair compute distance_m (haversine),
delta_h (elevation diff), and avg_speed_ms (route total distance / total duration, or per-step if
available). Feed segments + payload + battery% + tariff into estimateTrip(). Build ResultsPanel.jsx
showing predicted range (km), kWh/km, ₹/km, total kWh, a FEASIBLE / NEEDS-CHARGE badge, and the
±confidence band with a one-line limitations note. Recompute live when payload/battery/tariff change.
Comment each physics line with its formula.
ACCEPTANCE: heavier payload lowers range sensibly; sliders update results without refetching.
```

### Phase 3 — Weather + charging
```
Create app/api/weather/route.js (Open-Meteo, keyless): given the route midpoint, return current
temperature + wind, plus a temp_factor (+30% aux below 5°C or above 35°C) and a headwind estimate;
DriverView applies these to segments before estimateTrip. Create app/api/charging/route.js (Open
Charge Map, process.env.OCM_KEY): given the route, return charging POIs near the path. In the UI,
show chargers as map markers; if the trip is NOT feasible, recommend the best stop along the route
and highlight it. Both routes handle errors cleanly.
ACCEPTANCE: weather visibly shifts consumption; an infeasible trip surfaces a concrete charge stop.
```

### Phase 4 — LLM driver guidance (server route)
```
Create app/api/guidance/route.js (POST) that reads process.env.ANTHROPIC_API_KEY and calls the
Anthropic Messages API (model claude-haiku-4-5, max_tokens ~400, anthropic-version header). It
accepts the computed trip summary (range, kWh/km, ₹/km, feasibility, notable climb/descent
segments, weather) and returns 3–4 short, plain-language driver recommendations that CITE the
numbers and never overclaim (e.g. "Ease to 60 km/h on the Nashik climb — you'll arrive with ~12%
and can skip the mid-route charge"). Build GuidancePanel.jsx to POST to /api/guidance and render
the tips with a loading state. The key stays server-side.
ACCEPTANCE: after a calculation, realistic guidance appears; a failure degrades gracefully.
```

### Phase 5 — Fleet manager view
```
Build FleetView.jsx: a preset list of 5–8 trucks/trips (origin, destination, payload, battery%).
For each, fetch its route via /api/route and run estimateTrip; render a sortable table (truck,
route, distance, kWh/km, ₹/km, range, feasibility badge). Above it, a dashboard strip: fleet total
energy (kWh), average ₹/km, and count of trips needing a charge stop. Reuse the same lib + routes.
Cache/limit concurrent route calls so you don't hit rate limits.
ACCEPTANCE: table populates from the model; sorting works; totals are correct.
```

### Phase 6 — Polish + demo presets
```
Add: (1) two one-click DEMO PRESETS on the Driver view — a clean "happy path" trip and a
"range-anxiety / needs-charge" trip — so the live demo is reliable without manual typing;
(2) loading spinners + friendly error messages on every fetch; (3) an "Assumptions" info popover
listing vehicle params, tariff, and the ±12% confidence rationale; (4) responsive layout for phone.
Final `npm run build` and redeploy to Vercel.
ACCEPTANCE: both presets run end-to-end from one click; clean on mobile.
```

---

## 7. Deploy (Vercel)
1. Push the repo to GitHub (you need the repo link for submission anyway).
2. Import into Vercel — it auto-detects **Next.js**. Add env vars `ORS_KEY`, `OCM_KEY`, `ANTHROPIC_API_KEY` (all server-side; no `NEXT_PUBLIC_`).
3. Deploy → public URL. Re-test on a **different device** and **mobile**.
4. Record a **backup screen capture** of both presets working (campus wifi / API rate limits can bite on demo day).

## 8. Demo hooks (hand to Module A for the slide-8 live demo)
- Open on the **Driver "happy path" preset** → route, range, ₹/km, feasibility, then the **LLM guidance**. ~90s.
- Switch to the **"needs-charge" preset** → app catches an infeasible trip and recommends a charging stop. The money moment — it visibly *solves range anxiety*. ~60s.
- Flip to **Fleet view** → "and at scale, here's cost-per-km across the fleet." ~30s.
- Close on the **Assumptions popover** → "honest confidence band, synthetic payload, production ingests live telematics." Pre-empts the CDO. ~20s.

## 9. Anti-traps (from the rubric)
- **Don't over-build.** One reliable input→output path beats five half-working features. Presets + a working driver trip already score the core.
- **Keep the AI visible.** The LLM guidance panel is what makes "genuine AI capability" undeniable — don't cut it if you can help it.
- **Honesty scores.** The confidence band + assumptions popover earn marks; hiding limitations loses them.
- **Same story.** Every number the app shows (₹/km, range) must match the deck's KPIs — feed real app outputs to Modules A and C at Sync 1.

## 10. Next.js gotchas (save yourself an hour)
- **Leaflet + SSR:** render the map only client-side — `const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr:false })`. Import `'leaflet/dist/leaflet.css'` and fix the marker icon paths, or markers won't show.
- **Env vars:** anything the browser needs would require `NEXT_PUBLIC_` — but your keys must NOT have it. Keys are used only inside `app/api/*`.
- **Route handlers are POST/GET exports:** `export async function POST(req){ const body = await req.json(); ... return Response.json(data) }`.
- **Client components:** any component using hooks/state (DriverView, FleetView, map) needs `'use client'` at the top.
