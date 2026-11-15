"""Builds the Dyaus Advisory Point of View as a designed A4 HTML page, then prints it to PDF
with headless Chromium. Run: python3 pov/build_pdf.py  (from the repo root).
The same HTML is reused by pov/build_web.py for the web version on dyausadvisory.live."""
import math, pathlib, subprocess, glob, os

HERE = pathlib.Path(__file__).parent
APP = "https://rangesure.vercel.app/"
SITE = "https://dyausadvisory.live"

NAVY, GOLD, BLUE, CREAM, LINE, MUTED = "#151A33", "#7D5F17", "#4A76C4", "#F7F3EA", "#DDD5C2", "#4D5470"

# ---------- Exhibit 1: four layers staircase ----------
def exhibit1():
    W, gap, x0, base = 150, 12, 10, 164
    steps = [
        ("1", "Predict", ["Will it make it,", "and at what cost?"], "Routing apps", False),
        ("2", "Optimise", ["Which route, speed", "and charge stop?"], "Telematics vendors", False),
        ("3", "Explain", ["Why, and how sure", "are we?"], "Few players today", True),
        ("4", "Underwrite", ["Can we commit to", "a price per km?"], "Corridor-data holders", True),
    ]
    out = []
    for i, (n, name, q, who, hot) in enumerate(steps):
        x, y = x0 + i * (W + gap), 78 - i * 24
        fill = "rgba(166,124,31,0.10)" if hot else "#FFFDF8"
        stroke = GOLD if hot else LINE
        sw = 1.6 if hot else 1
        out.append(f'<rect x="{x}" y="{y}" width="{W}" height="{base - y}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
        out.append(f'<text x="{x+12}" y="{y+22}" font-family="Cormorant Garamond" font-size="17" font-weight="600" fill="{NAVY}"><tspan fill="{GOLD}">{n}</tspan>  {name}</text>')
        for j, line in enumerate(q):
            out.append(f'<text x="{x+12}" y="{y+40+j*13}" font-size="9.5" fill="{NAVY}">{line}</text>')
        out.append(f'<text x="{x+12}" y="{base-10}" font-size="8.8" font-weight="{600 if i == 3 else 400}" fill="{NAVY if i == 3 else MUTED}">{who}</text>')
    span = 2 * W + gap
    out.append(f'<path d="M{x0} {base+8}v5H{x0+span}v-5" fill="none" stroke="{MUTED}" stroke-width="1"/>')
    out.append(f'<path d="M{x0+2*(W+gap)} {base+8}v5H{x0+2*(W+gap)+span}v-5" fill="none" stroke="{GOLD}" stroke-width="1.3"/>')
    out.append(f'<text x="{x0+span/2}" y="{base+28}" text-anchor="middle" font-size="9" fill="{MUTED}">Crowded: now commodities</text>')
    out.append(f'<text x="{x0+2*(W+gap)+span/2}" y="{base+28}" text-anchor="middle" font-size="9" font-weight="600" fill="{NAVY}">Scarce: needs honest bands and corridor history</text>')
    return f'<svg viewBox="0 0 {x0*2+4*W+3*gap} {base+36}" role="img" aria-label="Four layers of AI value" font-family="Inter">{"".join(out)}</svg>'

# ---------- Exhibit 2: risk buffer vs corridor trips ----------
def exhibit2():
    rows = [(100, 4.16), (250, 2.66), (500, 1.90), (1500, 1.13), (5000, 0.66), (10000, 0.49), (50000, 0.26)]
    L, R, T, B = 52, 620, 14, 150
    lo, hi = math.log10(30), math.log10(50000)
    X = lambda t: L + (math.log10(t) - lo) / (hi - lo) * (R - L)
    Y = lambda v: B - v / 5 * (B - T)
    o = [f'<rect x="{X(30):.1f}" y="{T}" width="{X(100)-X(30):.1f}" height="{B-T}" fill="#EEE7D6"/>']
    cx = (X(30) + X(100)) / 2
    for k, w in enumerate(["Under 100", "trips:", "no quote"]):
        o.append(f'<text x="{cx:.1f}" y="{Y(3.2)+k*11:.1f}" text-anchor="middle" font-size="9" fill="{NAVY}">{w}</text>')
    for v in range(6):
        o.append(f'<line x1="{X(30):.1f}" x2="{R}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="{"#9AA0B4" if v == 0 else "#E6DFCD"}" stroke-width="{1 if v == 0 else 0.7}"/>')
        o.append(f'<text x="{X(30)-6:.1f}" y="{Y(v)+3:.1f}" text-anchor="end" font-size="8.5" fill="{MUTED}">₹{v}</text>')
    for t in (100, 1000, 10000, 50000):
        o.append(f'<text x="{X(t):.1f}" y="{B+14}" text-anchor="middle" font-size="8.5" fill="{MUTED}">{t:,}</text>')
    o.append(f'<text x="{(L+R)/2:.1f}" y="{B+30}" text-anchor="middle" font-size="8.5" fill="{MUTED}">Logged trips on the corridor (log scale)</text>')
    d = "".join(f'{"M" if i == 0 else "L"}{X(t):.1f} {Y(v):.1f}' for i, (t, v) in enumerate(rows))
    o.append(f'<path d="{d}" fill="none" stroke="#8C90A3" stroke-width="1.8"/>')
    for t, v in rows:
        now = t == 1500
        o.append(f'<circle cx="{X(t):.1f}" cy="{Y(v):.1f}" r="{5 if now else 3}" fill="{GOLD if now else "#8C90A3"}"/>')
    o.append(f'<text x="{X(100)+8:.1f}" y="{Y(4.16)-5:.1f}" font-size="9.5" font-weight="600" fill="{NAVY}">₹4.16</text>')
    o.append(f'<text x="{X(1500)+6:.1f}" y="{Y(1.13)-22:.1f}" font-size="9.5" font-weight="600" fill="{NAVY}">₹1.13 at 1,500 trips</text>')
    o.append(f'<text x="{X(1500)+6:.1f}" y="{Y(1.13)-11:.1f}" font-size="8.8" fill="{MUTED}">the prototype\'s corridor today</text>')
    o.append(f'<text x="{X(50000):.1f}" y="{Y(0.26)-10:.1f}" text-anchor="end" font-size="9.5" font-weight="600" fill="{NAVY}">₹0.26</text>')
    return f'<svg viewBox="0 0 640 {B+36}" role="img" aria-label="Risk buffer falls as corridor history grows" font-family="Inter">{"".join(o)}</svg>'

SRC = {
    "ncaer": "https://www.itln.in/logistics/indian-logistics-costs-at-797-of-gdp-new-study-reveals-1356654",
    "niti": "https://www.outlookbusiness.com/news/india-s-truck-market-likely-to-grow-over-4-times-by-2050-niti-report-news-222300",
    "redseer": "https://redseer.com/articles/unlocking-growth-in-indias-fragmented-trucking-sector/",
    "sfc": "https://www.tribuneindia.com/news/business/smart-freight-centre-releases-report-on-zero-emission-trucks-aligned-with-indias-pm-e-drive-and-e-fast-programs",
    "evr": "https://evreporter.com/pm-e-drive-scheme-incentive-framework-announced-for-electric-trucks/",
}

HTML = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>From Selling Trucks to Selling Certainty — Dyaus Advisory Point of View</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page {{ size: A4; margin: 13mm 15mm 14mm 15mm;
  @bottom-left {{ content: "DYAUS ADVISORY  ·  POINT OF VIEW  ·  NOVEMBER 2026"; font: 600 6.8pt Inter, sans-serif; letter-spacing: .12em; color: #9A9FB3; }}
  @bottom-right {{ content: "dyausadvisory.live   " counter(page) " / " counter(pages); font: 500 6.8pt Inter, sans-serif; color: #9A9FB3; }} }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; }}
body {{ font-family: Inter, sans-serif; font-size: 8.75pt; line-height: 1.46; color: {NAVY}; background: #fff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
a {{ color: {GOLD}; text-decoration: none; }}
h1, h2, h3, .big, .k, .num, .lead, .q, text {{ font-variant-numeric: lining-nums; }}
.cover {{ background: {NAVY}; color: #F3EEDF; margin: 0; border-radius: 4px; padding: 9mm 10mm 6mm; position: relative; overflow: hidden; }}
.cover:after {{ content: ""; position: absolute; right: -40mm; top: -40mm; width: 120mm; height: 120mm; border-radius: 50%;
  background: radial-gradient(circle, rgba(224,184,78,0.22), rgba(224,184,78,0) 65%); }}
.brandrow {{ display: flex; justify-content: space-between; align-items: center; font-size: 8pt; letter-spacing: .18em; text-transform: uppercase; color: #E0B84E; font-weight: 600; }}
.brandrow .firm {{ font-family: "Cormorant Garamond"; font-size: 15pt; letter-spacing: .04em; text-transform: none; color: #fff; font-weight: 600; }}
.cover h1 {{ font-family: "Cormorant Garamond"; font-weight: 600; font-size: 31pt; line-height: 1.02; margin: 6mm 0 2.5mm; letter-spacing: -.01em; color: #fff; }}
.cover .sub {{ font-size: 11pt; color: #CFD4E6; margin: 0; max-width: 150mm; }}
.byline {{ margin-top: 4.5mm; padding-top: 3mm; border-top: 1px solid rgba(255,255,255,.16); font-size: 8pt; color: #AEB5CC; display: flex; justify-content: space-between; }}
.byline b {{ color: #fff; font-weight: 600; }}
.cover-url {{ margin-top: 2.5mm; font-size: 8.4pt; color: #CFD4E6; position: relative; z-index: 1; }}
.cover-url a {{ color: #E0B84E; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }}
h2 {{ font-family: "Cormorant Garamond"; font-weight: 600; font-size: 16pt; line-height: 1.1; margin: 4.5mm 0 1.2mm; break-after: avoid; }}
h2 .n {{ color: {GOLD}; margin-right: 2mm; }}
.lead {{ font-weight: 600; font-size: 9.6pt; margin: 0 0 2mm; }}
p {{ margin: 0 0 2mm; }}
.brief {{ background: {CREAM}; border-left: 3px solid {GOLD}; padding: 3.5mm 5mm; margin-top: 4mm; }}
.brief .lead {{ font-family: "Cormorant Garamond"; font-size: 13.5pt; font-weight: 600; line-height: 1.2; }}
.stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 3mm 0 3mm; }}
.stat {{ border-top: 2px solid {NAVY}; padding-top: 2mm; }}
.stat .big {{ font-family: "Cormorant Garamond"; font-size: 22pt; font-weight: 700; line-height: 1; }}
.stat .lbl {{ font-size: 7.8pt; color: {MUTED}; line-height: 1.35; margin-top: 1mm; }}
.stat .lbl a {{ color: {MUTED}; text-decoration: underline; text-decoration-color: {LINE}; }}
figure {{ margin: 2.5mm 0; padding: 3mm 4mm 2.5mm; border: 1px solid {LINE}; border-radius: 3px; break-inside: avoid; }}
figure .ttl {{ font-weight: 600; font-size: 9.6pt; margin-bottom: 2.5mm; }}
figure .ttl span {{ color: {GOLD}; font-weight: 700; letter-spacing: .12em; font-size: 7.4pt; text-transform: uppercase; display: block; margin-bottom: .6mm; }}
figure svg {{ width: 100%; height: auto; display: block; }}
figcaption {{ font-size: 7.3pt; color: {MUTED}; margin-top: 2mm; }}
table {{ width: 100%; border-collapse: collapse; margin: 2.5mm 0 3mm; font-size: 8.3pt; line-height: 1.4; break-inside: avoid; }}
th {{ text-align: left; font-size: 7.4pt; text-transform: uppercase; letter-spacing: .08em; color: {MUTED}; font-weight: 600; border-bottom: 1.5px solid {NAVY}; padding: 1.5mm 2mm; }}
td {{ padding: 1.4mm 2mm; border-bottom: 1px solid {LINE}; vertical-align: top; }}
td:first-child {{ font-weight: 600; white-space: nowrap; }}
td.num {{ color: {NAVY}; font-weight: 500; }}
.cta-inline {{ display: inline-block; background: {NAVY}; color: #fff; padding: 1mm 3mm; border-radius: 2px; font-weight: 600; font-size: 8.4pt; }}
.two {{ display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 1mm; break-inside: avoid; }}
.callout {{ background: {CREAM}; padding: 3mm 4mm; font-size: 8.4pt; }}
.callout b {{ display: block; font-size: 8.8pt; margin-bottom: .6mm; }}
.calls-wrap {{ break-before: page; }}
.keep {{ break-inside: avoid; }}
.calls {{ display: grid; grid-template-columns: 1fr; gap: 2.5mm; margin: 2.5mm 0; }}
.call {{ display: grid; grid-template-columns: 13mm 1fr; border: 1px solid {LINE}; background: #FFFDF8; break-inside: avoid; }}
.call .num {{ background: {NAVY}; color: #E0B84E; font-family: "Cormorant Garamond"; font-weight: 700; font-size: 26pt; display: flex; align-items: center; justify-content: center; }}
.call .body {{ padding: 2.5mm 4mm; }}
.call h3 {{ font-family: "Cormorant Garamond"; font-weight: 600; font-size: 14.5pt; margin: 0 0 1mm; line-height: 1.1; }}
.call p {{ margin: 0; font-size: 8.8pt; }}
.call .proof {{ margin-top: 1.5mm; font-size: 8pt; color: {GOLD}; font-weight: 600; }}
.start {{ border-top: 2px solid {GOLD}; border-bottom: 1px solid {LINE}; padding: 2.5mm 0; margin: 2.5mm 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }}
.start .s .k {{ font-family: "Cormorant Garamond"; font-size: 20pt; font-weight: 700; color: {GOLD}; line-height: 1; }}
.start .s .v {{ font-size: 8pt; color: {MUTED}; }}
.close {{ background: {NAVY}; color: #E8E4D8; padding: 4mm 6mm; margin-top: 3mm; break-inside: avoid; display: grid; grid-template-columns: 1fr auto; gap: 6mm; align-items: center; }}
.close .q {{ font-family: "Cormorant Garamond"; font-size: 14pt; line-height: 1.25; color: #fff; }}
.close .links {{ font-size: 8.2pt; text-align: right; line-height: 1.8; white-space: nowrap; }}
.close .links a {{ color: #E0B84E; font-weight: 600; }}
.sources {{ font-size: 6.9pt; color: {MUTED}; margin-top: 3mm; line-height: 1.5; }}
.sources a {{ color: {MUTED}; text-decoration: underline; text-decoration-color: {LINE}; }}
.foot {{ position: fixed; bottom: -9mm; left: 0; right: 0; font-size: 7pt; color: #9A9FB3; display: flex; justify-content: space-between; letter-spacing: .04em; }}
</style></head><body>


<section class="cover">
  <div class="brandrow"><span class="firm">Dyaus Advisory</span><span>Point of View · Transport &amp; Logistics</span></div>
  <h1>From Selling Trucks<br>to Selling Certainty</h1>
  <p class="sub">How AI will reprice Indian road freight, and what OEMs, fleets and financiers should do about it.</p>
  <div class="byline"><span>By <b>Dyaus Advisory</b></span><span>November 2026</span></div>
  <div class="cover-url">Try the prototype: <a href="{APP}">rangesure.vercel.app</a></div>
</section>

<div class="brief">
  <p class="lead">Over the next five years, AI's largest payoff in Indian road freight will not come from driverless trucks. It will come from turning operating uncertainty into a price someone is willing to guarantee.</p>
  <p>Trucking has always been a business of educated guesses: how long a trip will take, what it will cost, whether the truck will make it. Diesel hid the cost of those guesses behind a dense refuelling network. Electric trucks remove that cushion. On a live run over the Western Ghats, a loaded 11-tonne e-truck fell 14% short of its brochure range on a normal day and 27% short on a bad one, from terrain, load and weather alone. Fleet owners respond the rational way: they keep buying diesel trucks.</p>
  <p style="margin:0">We built <b>Dyaus RangeSure</b>, a working AI prototype, to test a simple claim. If an operator can predict cost-per-km within a narrow, honest band, it can <i>commit</i> to that number contractually. The company that can make that commitment changes from selling vehicles to selling certainty.</p>
</div>

<h2><span class="n">01</span>An industry at an inflection point</h2>
<p class="lead">India's freight system is large, road-dependent and fragmented, and it is being asked to electrify. The bottleneck is not the battery. It is trust in the number.</p>
<div class="stats">
  <div class="stat"><div class="big">7.97%</div><div class="lbl">of GDP spent on logistics, ₹24.01 lakh crore in FY2023-24 (<a href="{SRC['ncaer']}">NCAER</a>)</div></div>
  <div class="stat"><div class="big">~70%</div><div class="lbl">of domestic freight moves by road; trucks rise from 4 m to ~17 m by 2050 (<a href="{SRC['niti']}">NITI Aayog</a>)</div></div>
  <div class="stat"><div class="big">75%</div><div class="lbl">of truck operators own fewer than five trucks (<a href="{SRC['redseer']}">Redseer</a>)</div></div>
  <div class="stat"><div class="big">3% → 34%</div><div class="lbl">medium and heavy trucks' share of vehicles vs. road CO2 (<a href="{SRC['sfc']}">Smart Freight Centre</a>)</div></div>
</div>
<p>Policy is pushing hard: PM E-DRIVE set aside ₹500 crore in July 2025 to support 5,643 e-trucks, with incentives tied to scrapping old vehicles (<a href="{SRC['evr']}">EVreporter</a>). But subsidies lower the purchase price. They do nothing about the question a fleet owner actually asks: <i><u>will this truck finish my route, and what will each kilometre cost?</u></i> A brochure range is measured on flat roads in mild weather. Indian freight runs through ghats, 45°C summers and overloaded tail-ends. Until someone answers that question with a number they will stand behind, electrification stays a pilot, not a purchasing decision.</p>

<div class="keep"><h2><span class="n">02</span>Where AI creates value: four layers, rising in worth</h2>
<p class="lead">AI in transport creates value in four layers. Each rests on the one below and is worth more than it. Most of the market has stopped at the second.</p>
<figure>
  <div class="ttl"><span>Figure 1</span>Value rises with each layer while competition thins out</div>
  {exhibit1()}
  <figcaption>Source: Dyaus Advisory analysis.</figcaption>
</figure></div>
<p>Routing apps and telematics dashboards are crowded and cheap, because prediction and optimisation are now commodities. The layers above are scarce for a structural reason. An explanation is only trusted if the number underneath is honest about its own uncertainty. A guarantee is only safe to write if you hold enough history on that exact corridor to price the tail. That history sits with whoever already runs the trucks.</p>

<h2><span class="n">03</span>Dyaus RangeSure: all four layers in one working product</h2>
<p class="lead">RangeSure shows that a small team can build all four layers today, on public data, in a tool a non-technical fleet owner can use.</p>
<p>Enter an origin, a destination, a payload and a battery level. In seconds it returns a verdict, a confidence level with a bad-day to good-day range, a charging plan if one is needed and, if you want one, a guaranteed price.</p>
<p><a class="cta-inline" href="{APP}" style="color:#fff">Try it live: rangesure.vercel.app →</a></p>
<table>
  <tr><th>Layer</th><th>What RangeSure does</th><th>Mumbai → Pune, 11-tonne e-truck, 4,000 kg, full battery</th></tr>
  <tr><td>Predict</td><td>Physics model over the real truck route, smoothed elevation, live weather (including wind direction and rain) at four points, and payload; corrected by a calibration layer learned from 1,500 past trips.</td><td class="num">156 km via the ghat road · 1.01 kWh/km · 198 km real range vs. a 230 km brochure claim</td></tr>
  <tr><td>Optimise</td><td>Finds the biggest sustained climb and a steady speed for it, and searches every combination of up to four charging stops for the fastest plan.</td><td class="num">Bhor ghat: 7.3 km rising 487 m. No stop at full battery; from 40% on the Nashik run, one charge at a 120 kW station</td></tr>
  <tr><td>Explain</td><td>A language model turns the numbers into plain guidance. It may explain numbers but is never allowed to invent one.</td><td class="num">Arrive with ~21%, but 7–29% from a bad day to a good day, so the app rates it Medium confidence</td></tr>
  <tr><td>Underwrite</td><td>Prices a per-km commitment from the uncertainty band and the corridor's trip history.</td><td class="num">₹10.50/km at a 96% guarantee level = ₹8.59 energy + ₹1.13 risk buffer + ₹0.78 margin</td></tr>
</table>
<div class="two">
  <div class="callout"><b>What it proves</b>Two design choices matter more than the model. A <i>governance red line</i>: when a data feed fails or a bad day would breach the battery reserve, the app refuses to show a confident green and says why. And an <i>honest no</i>: on a thin corridor it declines to quote rather than invent a price.</div>
  <div class="callout"><b>What it does not yet prove</b>The trip history is synthetic, standing in for real telematics. The pricing model is illustrative, not actuarial. Many public chargers don't list their power, so the planner assumes a modest 30 kW. Live weather can tip a borderline trip from no stop to one. These are exactly the gaps a pilot with a real fleet would close.</div>
</div>

<div class="keep"><h2><span class="n">04</span>What this means for each player</h2>
<p class="lead">Once cost-per-km can be guaranteed, value moves from whoever sells the asset to whoever holds the corridor data. The cost of a guarantee falls with every trip logged.</p>
<figure>
  <div class="ttl"><span>Figure 2</span>The risk buffer falls from ₹4.16 to ₹0.26 per km as corridor history grows</div>
  {exhibit2()}
  <figcaption>Risk buffer (₹/km, excluding margin) at a 96% guarantee level on the Mumbai–Pune trip; energy cost ₹8.59/km held constant. Source: Dyaus RangeSure pricing model (illustrative, not actuarial). A new entrant with no history cannot quote at all.</figcaption>
</figure></div>
<table>
  <tr><th>Player</th><th>What changes</th><th>The move to make now</th></tr>
  <tr><td>Truck OEMs</td><td>The truck becomes the way a per-km contract is delivered, not the product itself. Margin moves into the service.</td><td>Bundle telematics into every e-truck sold. Price the first guaranteed corridors before a competitor does.</td></tr>
  <tr><td>Fleet operators</td><td>Energy becomes a fixed line on the budget. Dispatch relies on confidence bands, not rules of thumb.</td><td>Log every trip and share the data in return for a lower guaranteed rate.</td></tr>
  <tr><td>Shippers &amp; 3PLs</td><td>Electric capacity becomes bookable with an SLA, making green freight procurable at scale.</td><td>Write completion guarantees into freight tenders.</td></tr>
  <tr><td>Lenders &amp; insurers</td><td>Predicted cost-per-km becomes an input for underwriting both the loan and the risk policy.</td><td>Use corridor-level guarantees to cut e-truck loan pricing and cover.</td></tr>
</table>
<p><b>The risks are real, and manageable.</b> Telematics data quality varies from fleet to fleet. Drivers may trust a green light too much. Language models can sound confident about numbers they never computed. The fix is the one RangeSure builds in: every figure traceable to a model, a governance red line that falls back to manual planning, and an explicit refusal to price where data is thin.</p>

<div class="calls-wrap">
<h2><span class="n">—</span>Conclusion: three calls from Dyaus</h2>
<p class="lead">The e-truck transition will be won by whoever is first to put a guaranteed number on the road, not by whoever builds the best truck. We would make three calls today.</p>
<div class="calls">
  <div class="call"><div class="num">1</div><div class="body"><h3>Sell the kilometre, not the truck.</h3>
    <p>Publish a guaranteed ₹/km rate card for your top ten corridors within twelve months, written the way a freight rate card is written: lane, load class, price, completion %. The buyer stops comparing purchase prices and starts comparing certainty.</p>
    <div class="proof">The first company to publish one sets the reference price everyone else is measured against.</div></div></div>
  <div class="call"><div class="num">2</div><div class="body"><h3>Pay fleets in price for their data.</h3>
    <p>No small operator holds enough trips to be underwritten alone, and 75% run fewer than five trucks. Offer them a lower guaranteed rate in exchange for their telematics: data-for-discount. Whoever pools the long tail of small fleets first builds a moat that money alone cannot copy.</p>
    <div class="proof">On our model, 100 → 1,500 logged trips cuts the risk buffer from ₹4.16 to ₹1.13 per km.</div></div></div>
  <div class="call"><div class="num">3</div><div class="body"><h3>Make "I don't know" a feature.</h3>
    <p>Insist that every AI number carries its confidence band, its source and a red line where it hands back to a human. Then turn that discipline into a <i>range certificate</i> attached to each corridor, which a lender can price a loan against and an insurer can price cover against.</p>
    <div class="proof">In a market flooded with confident AI, the system that admits uncertainty is the one trusted with capital.</div></div></div>
</div>

<h2 style="font-size:13pt;margin-top:3mm">Where to start: a 90-day corridor pilot</h2>
<div class="start">
  <div class="s"><div class="k">3</div><div class="v">corridors with the highest e-truck intent and repeat volume</div></div>
  <div class="s"><div class="k">50</div><div class="v">trucks instrumented for 90 days to build real corridor history</div></div>
  <div class="s"><div class="k">1</div><div class="v">guaranteed ₹/km rate published, and held to</div></div>
</div>
<p>That pilot costs a fraction of one e-truck order, and it answers the only question that blocks the next thousand.</p>

<div class="close">
  <div class="q">Dyaus Advisory, the accountable consultants. We built RangeSure to test our own thesis before asking anyone to act on it.</div>
  <div class="links">Try the prototype: <a href="{APP}">rangesure.vercel.app</a><br>Talk to us about a pilot: <a href="{SITE}">dyausadvisory.live</a></div>
</div>

<div class="sources"><b>Sources.</b> NCAER, <i>Assessment of Logistics Cost in India</i>, via <a href="{SRC['ncaer']}">ITLN</a> · NITI Aayog, <i>Transforming Trucking in India</i>, via <a href="{SRC['niti']}">Outlook Business</a> · <a href="{SRC['redseer']}">Redseer</a>, Dec 2024 · <a href="{SRC['sfc']}">Smart Freight Centre</a> via PTI, Sept 2025 · <a href="{SRC['evr']}">EVreporter</a>, PM E-DRIVE e-truck guidelines, July 2025. RangeSure figures come from a live run of the prototype on 15 November 2026 (Mumbai → Pune, 11-tonne e-truck, 4,000 kg, full battery, 27–33 °C); live weather moves them a little from run to run. Its trip history and corridor volumes are synthetic and its pricing model is illustrative, not actuarial.</div>
</div>
</body></html>"""

if __name__ == "__main__":
    html_path = HERE / "Dyaus_PoV_Selling_Certainty.html"
    html_path.write_text(HTML, encoding="utf-8")
    chrome = sorted(glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell")))[-1]
    pdf = HERE / "Dyaus_PoV_Selling_Certainty.pdf"
    subprocess.run([chrome, "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=8000",
                    f"--print-to-pdf={pdf}", html_path.as_uri()], check=True, capture_output=True)
    print("wrote", pdf)
