# Tata RangeSure — Validation Test Matrix
### Run these on https://rangesure.vercel.app/ before the demo · ~15–20 min

For each row: run the exact inputs, compare to "Expect", mark PASS/FAIL, note the actual value.
Test on a **laptop (1440px)** and a **phone (375px)**. Bugs B1–B3 are the credibility-killers.

Vehicle for all trip tests: **Ultra E.9 · 200 kWh · 4,000 kg** unless stated.

---

## A. Correctness bugs (must pass — these are visible on screen)

| # | Test (inputs) | Expect | P/F · actual |
|---|---|---|---|
| B1 | Preset **"Nashik run"** → read payload | Payload = a value **≤ 4,000** (not 6,000). Input rejects >4,000 with a message. | |
| B2a | **Mumbai→Pune, 100%** battery → note the charger named | A specific charger; may be "no stop" if it makes it | |
| B2b | **Mumbai→Pune, 20%** battery → note charger named | A **different / nearer** charger than B2a (not the identical POI) | |
| B3a | **Varanasi→Banda, 1%** battery | **No negative arrival %**. Shows "needs N stops" or red-line "not feasible / no reachable charger". Never "-196%" or a single "charge once". | |
| B3b | **Mumbai→Nashik, payload 4000, 20%** | Arrival SOC ≥ 0 shown; if infeasible, honest multi-stop / red-line, no "-90%" | |
| B3c | Any infeasible trip → repeatability band | Band clamped to 0–100%, or infeasible state — never negative | |

## B. UI / polish (Ambarish's notes)

| # | Test | Expect | P/F |
|---|---|---|---|
| U1 | Long charger name (e.g. "Life Republic, Hingewadi") on a metric tile | Text wraps/truncates inside the card; nothing spills out (check at 375px too) | |
| U2 | Desktop Plan Trip layout | "Your Trip Plan" sits in the left column under inputs; right rail doesn't need long scrolling | |
| U3 | Driver guidance bullets | Clean text, **no** literal `**` before/after points | |
| U4 | Charging page, search a city | Each charger shows distance (km) from the searched place; sorted nearest-first | |
| U5 | Whole app at 375px | No horizontal scroll; verdict readable at a glance | |

## C. Reference trip vs the deck (same-story check)

| # | Test | Expect | P/F |
|---|---|---|---|
| C1 | **Mumbai→Pune, Ultra E.9, 4000 kg, 80%, ₹8.5** | Internally consistent: range = 200 / (kWh/km); ₹/km = kWh/km × 8.5; arrival math checks | |
| C2 | Same trip vs **board slide 9** (0.82 kWh/km, 244 km) | Likely DIVERGES (grounded app ≈ 1.0–1.35 kWh/km). **Decide: update slide 9 or the params.** Don't demo both side by side unreconciled. | |

## D. AI + differentiator

| # | Test | Expect | P/F |
|---|---|---|---|
| D1 | Trip Plan "AI model — what it learned" | Physics vs calibrated numbers differ sensibly; a real "what it learned" line | |
| D2 | Natural-language "Ask" (if built), e.g. "what if I add 2 tonnes?" | Answer grounded in the numbers; never invents figures | |
| D3 | **Guarantee** view: slider 95% → 99% | Committed ₹/km **rises**; buffer rises | |
| D4 | Guarantee breakdown bar | Energy + buffer + margin = committed price exactly | |
| D5 | Guarantee moat panel | Buffer falls as corridor trips rise; near 0 trips → "cannot underwrite" | |

## E. Governance red-line (demo highlight)

| # | Test | Expect | P/F |
|---|---|---|---|
| E1 | Very low battery or a marginal trip | Amber "Low confidence — manual planning advised", **not** a confident green | |
| E2 | (If testable) kill a data source / offline | Clean error + degraded state, never a white screen | |

## F. Deploy

| # | Test | Expect | P/F |
|---|---|---|---|
| F1 | Open URL on a phone + a second laptop | Loads and works on both | |
| F2 | Backup screen recording of both presets | Exists and current | |

---

## How to get me a real analysis
I can't drive the live app from here (no way to enter inputs or see API results). To get a precise
read from me, paste screenshots of: (1) the Mumbai→Pune result, (2) the same route at 20% vs 100%,
(3) the Varanasi→Banda 1% case, (4) the Guarantee view with the slider at 95% and 99%, (5) the
Charging page. I'll validate the numbers and logic against the deck and flag anything off.

## Priority if time is short
Fix/confirm **B1, B2, B3** first (they read as "broken" to a board), then **C2** (reconcile the app
number with slide 9), then **U1–U3**. Everything else is polish.
