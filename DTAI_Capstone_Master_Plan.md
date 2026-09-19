# DTAI Capstone — Master Plan & Strategy Prompts
### AI-Native Automotive OEM · Flagship App: EV Truck Range Optimizer

**Course:** Digital Transformation & AI · IIM Lucknow
**Team size:** 6 (3 pairs → 3 modules)
**Submission deadline:** 23-Aug-2026 (Sun)
**Grading split:** Board Presentation 60% · Vibe Coded Application 40%

> **Read this first.** The rubric grades the deck and the app as *one story*. The single biggest risk in splitting into three parallel pairs is that we converge Thursday with a strategy that claims one set of numbers and an app that shows different ones — the exact seam the mock CDO will catch. Everything below is built to prevent that: a shared **Story Contract** that all three modules anchor to, plus **two hard sync points**. Do not skip them.

---

## 1. The Story Contract (shared spine — every module builds against this)

*Lock this in the Day-0 kickoff. Once locked, no pair changes it unilaterally. Every prompt in Section 5 prepends this.*

**Company archetype:** A large Indian automotive OEM with a growing electric commercial-vehicle (e-truck) line (map to a Tata Motors / Mahindra-type player — treat as "our client").

**The business problem (in business terms, no tech):** Range anxiety and unpredictable energy cost-per-km are the top blockers to electric-truck fleet adoption. Fleet buyers can't trust that a loaded e-truck will complete a route, or forecast its running cost, so they stay with diesel.

**The one-sentence use case (the app):**
> *"This app predicts real-time range and recommends the most energy-efficient route, speed profile, and charging stops for an electric truck — so a fleet driver/manager can complete the trip without range anxiety and at the lowest cost-per-km."*

**The strategic thesis (3 moves):**
1. **Own the range problem in software** — turn the e-truck into a connected, self-optimizing asset.
2. **Shift from selling trucks to guaranteeing cost-per-km** — energy-as-a-service.
3. **Build the data platform** — real-time telematics + external data become the durable moat.

**The "why now" / positioning vs. the market:**
Mahindra just launched the **BLAZO i-TRK** with AI-powered *iFuelSmart* (real-time drive-mode optimization) — but it is a **diesel** truck; it optimizes the engine. Their electric SCV (ZEO) has the connected-app plumbing (NEMO) but no journey-level range intelligence. **The whitespace:** fuse the two — bring real-time AI optimization to *electric* trucks at the whole-journey level (route + terrain + weather + charging), not just in-engine mode selection. *This framing is what protects our 15% Innovation score from the "you just copied a shipped feature" critique.*

**The KPI set (every value claim maps to these — do not invent others):**
- **Cost-per-km (₹/km)** — primary CFO metric
- **Range confidence / trips completed without a stranded charge**
- **Fleet uptime** (fewer unplanned charging stops / breakdowns)
- **EV-fleet sales conversion** (range anxiety removed → more e-truck orders)

**The AI capabilities (satisfies the "real AI" rubric requirement):**
- **Prediction:** physics-based energy/range model over the route
- **Generation:** LLM turns the numbers into plain-language driver guidance + honest confidence

---

## 2. Module Split (3 pairs, clean ownership)

| Module | Pair owns | Deck slides | Essential frameworks | Best for |
|---|---|---|---|---|
| **A — Strategy & Narrative** | The storyline + guardian of the one-story rule. Editor-in-chief of the deck. | 1–7, 17, 18 | Enterprise AI Canvas, AI Opportunity Matrix | Strongest strategy/consulting thinkers |
| **B — The Application** | EV-truck range optimizer end-to-end: APIs, consumption model, LLM layer, UI, Vercel deploy, demo, GitHub, App Brief | 8 (Use Cases + live demo), 10 (Data Strategy), 11 (Tech Architecture) | (build-driven) | Strongest builders |
| **C — Ops, Governance, Financials & Roadmap** | "How it runs and how it pays." CFO- and Independent-Director-facing content. | 9, 12, 13, 14, 15, 16 | AI Governance Canvas, Business Value Framework, Risk Assessment Matrix | Finance/ops-minded pair |

**Mapping to the sheet's suggested roles:** Engagement Partner (floats across A + opens/closes) · Lead Strategist (A) · Application Lead (B, shared) · Operating Model Lead (C) · Risk & Governance Lead (C).

**Shared rule from the sheet:** *every* team member must understand what the app does and be able to explain its AI logic to the Board. Everyone speaks during the presentation; everyone fields at least one Q&A question.

---

## 3. The 3-Day Sprint

> Today is **Fri 21-Aug**. Deadline moved to **Sun 23-Aug**. That's 3 days, no buffer day — the original 4-day-plus-buffer plan below is compressed into Day 0+1 combined, Day 2, and Day 3. Submit **Sunday**.

### Day 1 — Fri 21-Aug (TODAY): Lock the spine, then build the core
- **All six (first 90 min):** agree the Story Contract (Section 1). Nothing downstream starts until this is locked.
- **Module B (highest priority):** scaffold the app, deploy a hello-world build to a **live public Vercel URL today**, then push straight into integrating the routing/map API end-to-end (Phase 0–1 of the Build Pack). → banks the 15% live-deployment marks early and surfaces any key/CORS/Vercel issues while there's still runway.
- **Module A:** draft storyline + Executive Summary; pull sourced industry evidence (EV CV adoption, TCO, Blazo i-TRK / ZEO facts); start slides 1–7.
- **Module C:** build the financial-model skeleton (KPI → value driver → assumption → ₹); start Financial Impact + ROI first pass.
- **🔴 SYNC 1 (end of day, 30 min):** B reports the app's **actual output numbers** so far (even partial). A + C re-align every KPI and value claim to what the app really shows. *This is the sync that protects the "same story" grade.*

### Day 2 — Sat 22-Aug: Integrate & demo-proof
- **B:** finish energy model + weather/charging APIs, add the LLM guidance layer; polish UI for a non-technical user; deploy final build; test on fresh browser + mobile; write 3-min demo script; **record backup video**.
- **A:** finalize slides 1–7; finalize Enterprise AI Canvas + AI Opportunity Matrix (app in the "Priority Initiatives" quadrant).
- **C:** lock Governance, Risk Matrix (incl. app-specific risks: wrong range estimate, data-feed failure, over-reliance), Roadmap (app in Phase 1).
- **🔴 SYNC 2 (evening, 60 min):** assemble one deck file; read the story end-to-end aloud; kill inconsistencies; assign every slide a presenter.

### Day 3 — Sun 23-Aug: Rehearse, harden, SUBMIT
- Full timed dry run: 12–15 min deck + 3–5 min live demo, no notes.
- Q&A drill: teammates play CEO (strategic fit) / CFO (financials) / CDO (technical realism) / Independent Director (risk & ethics). Everyone fields ≥1 hard question.
- Export **PDF + PPTX**; final live-URL check on a **different device**; confirm backup video.
- **Submit the full package by end of day Sunday — no buffer day remains, so treat the morning as the hard cutoff for content changes.**

---

## 4. The Application — build spec (for Module B)

**Stack (recommended):** Next.js on Vercel (serverless API routes keep API keys server-side). Alternatively scaffold with v0 / Bolt / Lovable, then refine in Cursor.

**Real-time APIs (these *are* the data — no training dataset needed):**
| Signal | API options | Why it matters for EV range |
|---|---|---|
| Route + distance | Google Maps / Mapbox / OpenRouteService | base of every estimate |
| Elevation / gradient | elevation endpoint of the above | **biggest** swing on a loaded e-truck |
| Weather | OpenWeatherMap / Open-Meteo | temperature hits battery; wind/rain hit consumption |
| Traffic | Google/Mapbox traffic | crawl vs. regen |
| Charging stations | Open Charge Map | stop planning |
| Payload | driver-entered | feeds the consumption model |

**Consumption model (physics-based, transparent, defensible — beats a black-box regression):**
Per route segment, tractive force:
- Rolling resistance: `F_roll = Crr · m · g`
- Aerodynamic drag: `F_aero = 0.5 · ρ · Cd · A · v²`
- Gradient: `F_grade = m · g · sin(θ)`
- Segment energy: `E = (F_roll + F_aero + F_grade) · d / η_drivetrain` + auxiliary/HVAC load × time − regen recovery on descents

**Default parameters (synthetic but realistic — state these as assumptions):**
`m` = 12,000 kg loaded (adjust by payload) · `Crr` ≈ 0.007 · `Cd` ≈ 0.7 · `A` ≈ 9 m² · `ρ` = 1.2 kg/m³ · `η_drivetrain` ≈ 0.85 · HVAC/aux ≈ 3 kW · usable battery ≈ 200 kWh. → **kWh/km, predicted range, and ₹/km** at a given electricity tariff.

**Honesty requirement (rubric rewards this):** show a **confidence band** and state limitations (synthetic payload, no live BMS data in prototype).

**Two demo modes — pick one for the live demo:**
- **Driver view** (recommended for a non-technical Board): one trip, "will I make it, and how" — visceral, simple.
- **Fleet manager view:** many trucks, cost dashboard — ties better to CFO KPIs. (Keep as a second screen if time allows.)

---

## 5. Master Strategy Prompts

**How to use:** every prompt below assumes you **paste the Story Contract (Section 1) first**, then the module prompt. That shared context is what keeps all three pairs telling the identical story. Use with Claude / ChatGPT for strategy & docs; v0 / Cursor / Bolt for the app.

### 5.0 Context primer (prepend to EVERY prompt)
```
You are helping a top-tier strategy consulting team build an AI-transformation
capstone for an MBA Board panel (playing CEO, CFO, CDO, Independent Director).

CLIENT: a large Indian automotive OEM with a growing electric commercial-vehicle line.
PROBLEM: range anxiety + unpredictable energy cost-per-km block e-truck fleet adoption.
FLAGSHIP APP (use case #1): an EV-truck range optimizer that predicts real-time range
and recommends the most energy-efficient route, speed profile, and charging stops.
THESIS: (1) own the range problem in software, (2) shift from selling trucks to
guaranteeing cost-per-km, (3) build the real-time data platform as the moat.
POSITIONING: Mahindra's BLAZO i-TRK "iFuelSmart" AI optimizes a DIESEL engine; we bring
whole-journey AI optimization to ELECTRIC trucks — that is the whitespace.
KPIs (use only these): cost-per-km (₹/km), range confidence, fleet uptime, EV-fleet conversion.
RULE: every recommendation must trace to one of those KPIs. Be specific to this client;
no generic placeholders. Distinguish prediction vs. judgment vs. decision clearly.
```

### 5.1 Module A — Strategy & Narrative
```
[Context primer]
TASK: Draft slides 1–7 of a Board deck. For each slide give: a headline that states a
conclusion (not a topic), 3–5 tight bullets, and one visual/framework to place on it.
- Slide 1 Executive Summary: lead with the recommendation and the ask, not an agenda.
- Slide 3 Industry Dynamics: EV commercial-vehicle adoption, diesel→electric TCO crossover,
  the connected-truck race; cite Blazo i-TRK (diesel) and ZEO (EV) as evidence the OEM is moving.
- Slide 4 Current Challenges: business terms ONLY, no technology mentioned yet.
- Slide 7 Enterprise AI Strategy: express as an Enterprise AI Canvas (one page).
Keep it decision-ready and defensible under CFO/CDO questioning.
```
```
[Context primer]
TASK: Build the AI Opportunity Matrix (axes: business value × feasibility). Plot 6–8
realistic AI use cases for this OEM. Place the EV-truck range optimizer in the high-value/
high-feasibility "Priority Initiatives" quadrant and justify in 2 sentences why it is
use case #1. Explain in one line each why the others are phased later.
```
```
[Context primer]
TASK: Write the Blue Ocean / innovation argument (≤150 words) that pre-empts the Board
critique: "Mahindra already did this." Show precisely how our electric, whole-journey,
multi-API approach differs from in-engine diesel drive-mode selection.
```

### 5.2 Module B — The Application
```
[Context primer]
Build a Next.js web app (deploy on Vercel) called an EV-Truck Range Optimizer.
SCREEN 1 (driver view): inputs = start, destination, payload (kg), battery % now.
On submit, call: a routing API (route + distance), an elevation API (gradient per segment),
a weather API (temp + wind), and a charging-station API (stops en route). Keep all API keys
server-side in API routes / env vars — never hardcode.
COMPUTE range with a transparent physics model:
  F_roll=Crr*m*g ; F_aero=0.5*rho*Cd*A*v^2 ; F_grade=m*g*sin(theta) ;
  E_segment=(F_roll+F_aero+F_grade)*d/eta + HVAC*time - regen_on_descents.
  Defaults: m=12000kg (+payload), Crr=0.007, Cd=0.7, A=9, rho=1.2, eta=0.85, HVAC=3kW, battery=200kWh.
OUTPUT: predicted range, kWh/km, ₹/km (tariff input), a recommended speed profile, whether
a charging stop is needed and where, and a CONFIDENCE BAND with a one-line limitations note.
Make the UI clean enough for a non-technical user. Mobile-friendly.
```
```
[Context primer]
Add an LLM guidance layer: given the computed segment data, produce 3–4 plain-language
driver recommendations (e.g., "hold 60 km/h on the next climb; you'll arrive with 12% and
can skip the Nashik stop"). Keep it factual, cite the numbers, and never overclaim.
```
```
[Context primer]
Write (a) a 3-minute live demo script — exact clicks, inputs, and what to say about each
output, with a scripted "happy path" trip; and (b) the 1-page Application Brief the sheet
requires: use case, AI capability used, data inputs, key output, business KPI it moves,
and known limitations.
```

### 5.3 Module C — Ops, Governance, Financials & Roadmap
```
[Context primer]
TASK: Build the Business Value case. For each KPI (cost-per-km, range confidence, uptime,
EV-fleet conversion), give the value driver, a defensible assumption (state it explicitly),
and a ₹ estimate for a 100-truck fleet over 3 years. Benchmark credibility against Mahindra's
public diesel claim (~10% efficiency gain; up to ₹15 lakh extra profit/truck over 5 yrs) and
argue the electric analogue. Then a simple ROI with payback period and a sensitivity note.
```
```
[Context primer]
TASK: Design the AI Governance Canvas for the range optimizer: decision rights, risk tiers,
and human-in-the-loop (the driver always overrides advisory output). Then a Risk Assessment
Matrix (likelihood × impact) covering app-specific risks — wrong range estimate stranding a
truck, data-feed/API failure, model bias, driver over-reliance — each with a mitigation.
```
```
[Context primer]
TASK: Build a phased AI Transformation Roadmap (Phase 1/2/3) with the range optimizer in
Phase 1. For each phase: objective, key initiatives, data/tech prerequisites, and the KPI
it moves. Add the AI Operating Model changes (teams, decision rights, workflows) around the app.
```

---

## 6. Submission Checklist (from the instruction sheet)

- [ ] Strategy deck — **PDF and PPTX** (consulting-style, ~20–30 slides)
- [ ] Live application **URL** (Vercel or equivalent) — tested on a different device
- [ ] **GitHub repository** link
- [ ] **1-page Application Brief** (use case · AI capability · data inputs · key output · KPI · limitations)
- [ ] Backup **screen recording** of the working app
- [ ] AI-generated code **disclosed**; external data/claims **sourced or marked as estimates**
- [ ] Every member can explain the app's AI logic and field a Board question

## 7. Demo-Day Protocol

- Open with the **recommendation**, not the agenda — Boards want the answer first.
- Introduce and **demo the app live at slide 8** — don't save it for the end.
- Have the live URL open in a browser tab **before** your slot; keep the backup video ready.
- Address the **seat** each question comes from (CEO=strategic fit, CFO=financials, CDO=technical realism, Independent Director=risk/ethics).
- 12–15 min deck + 3–5 min demo. Every member speaks.

---

> **Remember (from the sheet):** *A strategy without a working prototype is a proposal. A prototype without a strategy is a demo. The Board is paying for both — and for the judgment to know the difference.*
