# Tata RangeSure — Route Guarantee & Moat (the differentiator)
### VS Code prompts to turn the trip planner into an underwriting instrument

This bolts the missing commercial layer onto the working app. It's what makes RangeSure *Tata's* and
not a generic EV route planner (ABRP/Chargetrip). **Do this only after your P0 app is deployed and
demo-safe** — it's an addition on top, not a rebuild. Run prompts in order; commit after each.

---

## The idea (and why it de-genericizes the app)

A route planner answers the **driver's** question: "will I make it?" — a solved, commodity problem.
RangeSure's actual product (deck slide 6, Move #3 "monetise performance") answers the **OEM's**
question: **"Can Tata *commit* to this route — at what price, at what risk?"**

So we take the confidence band the app already computes and turn it into a **priced commitment**:
> "Tata can commit **₹7.10/km** on Mumbai–Pune with a **96% completion guarantee** — risk buffer
> ₹0.40/km — priced from **1,500 corridor trips**."

And we make the **moat visible**: the buffer shrinks as Fleet Edge corridor data grows, so a new
entrant (0 trips) literally cannot underwrite. Prediction is the engine; the guarantee is the product.

Three additions: **G1/G2** the guarantee engine + view (core), **G3** the moat panel (core),
**G4** a cohort anomaly flag (optional, strong AI signal), **G5** fleet-portfolio roll-up (optional).

---

## The underwriting model (transparent — implement exactly, label as illustrative)

Inputs come from the trip engine you already have:
`expected_kwh_per_km` (calibrated), the scenario band `best_kwh_per_km` / `worst_kwh_per_km`,
`tariff` (₹/kWh), and a per-corridor `corridor_trips` count (synthetic, stands in for Fleet Edge history).

```
sigma0      = max((worst_kwh_per_km - best_kwh_per_km) / 4, 0.001)   // band ≈ ±2σ
data_scale  = sqrt(baseline_trips / max(corridor_trips, 1))          // FLYWHEEL: more data → less uncertainty
sigma       = sigma0 * data_scale
z           = invNorm(clamp(guarantee_pct/100, 0.50, 0.999))         // std-normal quantile
committed_kwh   = expected_kwh_per_km + z * sigma                    // price against the guaranteed percentile
expected_cost   = expected_kwh_per_km * tariff
risk_cost       = committed_kwh * tariff - expected_cost             // variance buffer
disruption_load = (1 - guarantee_pct/100) * disruption_cost_per_km   // residual-risk load for the rare miss
buffer          = risk_cost + disruption_load
committed_price = (expected_cost + buffer) * (1 + margin)            // Tata's cost-per-km quote
```
Defaults (expose in Settings, label as assumptions): `baseline_trips = 1500`, `margin = 0.08`,
`disruption_cost_per_km = 2.0`. Behaviour to sanity-check: tighter guarantee → higher z → bigger
buffer; more `corridor_trips` → smaller sigma → smaller buffer; `corridor_trips → 0` → sigma explodes
→ buffer huge / "cannot underwrite" (that's the moat).

Reference implementation:
```js
// lib/guarantee.js — illustrative underwriting model (NOT actuarial); every number is explainable.
// Acklam inverse-normal approximation:
function invNorm(p){
  const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924];
  const b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857];
  const c=[-0.00778489400243029,-0.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878];
  const d=[0.00778469570904146,0.32246712907004,2.445134137143,3.75440866190742];
  const pl=0.02425, ph=1-pl; let q,r;
  if(p<pl){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  if(p<=ph){q=p-0.5;r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}
  q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
}
export function priceGuarantee({
  expected_kwh_per_km, best_kwh_per_km, worst_kwh_per_km, tariff,
  guarantee_pct, corridor_trips,
  baseline_trips=1500, margin=0.08, disruption_cost_per_km=2.0,
}){
  const sigma0 = Math.max((worst_kwh_per_km - best_kwh_per_km)/4, 0.001);
  const data_scale = Math.sqrt(baseline_trips / Math.max(corridor_trips, 1));
  const sigma = sigma0 * data_scale;
  const z = invNorm(Math.min(Math.max(guarantee_pct/100, 0.5), 0.999));
  const committed_kwh = expected_kwh_per_km + z*sigma;
  const expected_cost = expected_kwh_per_km * tariff;
  const risk_cost = committed_kwh*tariff - expected_cost;
  const disruption_load = (1 - guarantee_pct/100) * disruption_cost_per_km;
  const buffer = risk_cost + disruption_load;
  const committed_price = (expected_cost + buffer) * (1 + margin);
  const underwritable = corridor_trips >= 100 && isFinite(committed_price) && buffer < expected_cost*3;
  return { committed_price_per_km: committed_price, expected_cost_per_km: expected_cost,
           buffer_per_km: committed_price - expected_cost, sigma, underwritable, guarantee_pct, corridor_trips };
}
```

---

## G1 — Guarantee engine
**PROMPT**
```
Add lib/guarantee.js EXACTLY as the reference implementation in our Route-Guarantee doc (pure
functions, no fetch, with the Acklam invNorm and priceGuarantee). Also add a synthetic per-corridor
trip-count lookup in data/corridors.js: a map of corridor key (e.g. "Mumbai-Pune") -> trips, with a
few seeded corridors (Mumbai-Pune: 1500, Delhi-Jaipur: 900, Chennai-Bengaluru: 2200) and a default of
300 for unknown corridors. Expose getCorridorTrips(start,end). Unit-sanity: log priceGuarantee for
Mumbai-Pune at 95% and 99% guarantee so we can confirm 99% costs more.
```
**VERIFY:** 99% guarantee yields a higher committed ₹/km than 95%; a corridor with more trips yields a smaller buffer.

## G2 — Route Guarantee view (the commercial hero screen)
**PROMPT**
```
Add a new primary view "Guarantee" (nav item next to Plan Trip and Fleet) that runs AFTER a trip is
computed and reuses its outputs (expected/best/worst kWh/km, tariff). Using lib/guarantee.js and the
corridor trip count, render a board-grade commercial card (shadcn/ui, our dark cockpit theme):

HERO: "Tata can commit ₹<committed_price>/km on <origin> → <destination>" with a large
"<guarantee_pct>% completion guarantee" badge. Sub-line: "Expected ₹<expected_cost>/km ·
risk buffer ₹<buffer>/km · priced from <corridor_trips> corridor trips."

CONTROLS: a guarantee slider (90%–99.5%). Moving it live-updates committed price and buffer, and shows
the tradeoff in one line ("Tighter guarantee → larger buffer"). Optional inputs in Settings: margin,
disruption cost.

BREAKDOWN: a small stacked bar — Energy cost | Risk buffer | Margin — summing to the committed price,
so the CFO sees exactly what they're paying for.

EDGE STATE: if priceGuarantee returns underwritable=false (too few trips / runaway buffer), do NOT
show a price — show "Not yet underwritable on this corridor — insufficient trip history," which sets
up the moat story.

Mobile: single column, hero on top, slider below, breakdown last. Desktop: two columns (hero+slider
left, breakdown+context right).
```
**VERIFY:** the slider visibly trades guarantee % against ₹/km; the breakdown bar sums to the committed price; a low-trip corridor shows "not yet underwritable".

## G3 — The moat / data-flywheel panel
**PROMPT**
```
On the Guarantee view add a "Why only Tata can price this" panel. Using lib/guarantee.js, compute the
risk buffer for the SAME trip and guarantee across a sweep of corridor_trips = [0, 100, 500, 1500,
10000, 50000] and plot buffer_per_km vs trips as a small line/area chart (recharts). Annotate points:
"New entrant (0 trips) — cannot underwrite", "Tata today (~1,500)", "Tata Year-2 (~10,000)". Add a
one-line caption: "Every completed trip on Fleet Edge tightens the guarantee and lowers the price —
a moat that compounds and a new entrant starts at zero." Keep it honest: label the model illustrative.
```
**VERIFY:** the buffer curve falls as trips rise and blows up near zero; the new-entrant point reads "cannot underwrite".

## G4 — (Optional, strong AI signal) cohort anomaly flag
**PROMPT**
```
Add a pre-trip anomaly check that only fleet data could enable. In data/cohort.js, synthesize a cohort
baseline energy draw per vehicle model (mean + std). For the selected truck, derive its "recent draw"
(expected_kwh_per_km ± a seeded per-truck offset) and compute a z-score vs its cohort. If it exceeds
~1.5σ, show an amber "Fleet insight: this truck is drawing ~<X>% above its cohort — possible battery
degradation; schedule a check" on the Plan Trip and Guarantee views. Explain it's derived from
fleet-cohort comparison (impossible without Tata's data).
```
**VERIFY:** some trucks flag an anomaly with a sensible % and explanation; most don't.

## G5 — (Optional) fleet-portfolio roll-up
**PROMPT**
```
On the Fleet view add a "Guarantee book" strip: for each corridor in the fleet, compute the
committed ₹/km at a house guarantee (e.g. 96%) and show total guaranteed contract value
(Σ committed ₹/km × annual km) and a weighted-average buffer. Flag corridors that are "not yet
underwritable". One insight line, e.g. "3 of 5 corridors are underwritable today; the other 2 need
~<N> more trips." This turns the fleet page into the commercial book, not just a status table.
```
**VERIFY:** the guarantee book totals across corridors and flags the thin ones.

---

## Demo hooks (the money moment — hand to Module A)
1. Plan Trip → compute Mumbai–Pune (Ultra E.9). "Here's the prediction."
2. Switch to **Guarantee** → "But prediction isn't the product. Here's what Tata can *sell*:
   **₹7.10/km, 96% guaranteed.**" Drag the slider to 99% → price rises. "Certainty has a price, and
   we can quote it."
3. Open the **moat panel** → "A startup can build this math in a weekend. What it can't build is
   this —" point at the buffer curve near zero — "600,000 vehicles of trip history. Every trip makes
   our guarantee cheaper and theirs impossible."
4. (If built) show the **anomaly flag** → "and only fleet data can warn you a battery's fading before
   the trip." Close: "One trip decision today; an underwriting platform tomorrow."

## Validation additions
```
- Guarantee monotonicity: higher guarantee % => higher ₹/km, always; more corridor trips => lower buffer.
- Breakdown integrity: energy + buffer + margin equals committed price exactly.
- Moat curve: buffer decreases with trips and is non-underwritable near zero.
- Honesty: the "illustrative underwriting model" label and assumptions (margin, disruption cost,
  baseline trips) are visible; nothing claims actuarial precision.
- Same story: committed/expected ₹/km reconcile with the Plan Trip numbers and the deck's ₹/km KPI.
```

## Honesty & framing notes
- Call it an **illustrative underwriting model**, not an actuarial one — the professor will respect the
  honesty and it matches the deck's "transparent assumptions" thread.
- The corridor trip counts and cohort baselines are **synthetic stand-ins for Fleet Edge data** — say so.
- This is the answer to "why isn't this generic?": the guarantee + the compounding data moat are things
  a standalone route planner structurally cannot offer.

## Build order & time-box
G1 → G2 → G3 gives you the full differentiator and demo. G4 (anomaly) is the strongest *AI* add-on if
this professor weights that — do it next. G5 is polish. Re-deploy and re-run the Mumbai–Pune preset
after each. Remember: a deployed generic app beats a broken brilliant one — only build this on a green,
live base.
