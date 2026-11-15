"""Builds the web version of the Point of View for dyausadvisory.live — the same design and the
same content as the PDF (it reuses build_pdf.HTML), as a page to read on the site rather than a
file to download. Writes into the Dyaus website repo:

  ../dyaus/public/insights/from-selling-trucks-to-selling-certainty/index.html
  ../dyaus/public/insights/from-selling-trucks-to-selling-certainty/og.png   (LinkedIn preview)

Run: python3 pov/build_web.py  (from the rangesure repo root)."""
import glob, importlib.util, os, pathlib, subprocess, tempfile

HERE = pathlib.Path(__file__).parent
SITE = "https://dyausadvisory.live"
SLUG = "from-selling-trucks-to-selling-certainty"
OUT = HERE.parent.parent / "dyaus" / "public" / "insights" / SLUG
URL = f"{SITE}/insights/{SLUG}/"
TITLE = "From Selling Trucks to Selling Certainty | Dyaus Advisory"
DESC = ("How AI will reprice Indian road freight, and what truck makers, fleets and financiers should do "
        "about it. A Dyaus Advisory Point of View, built on Dyaus RangeSure, a working AI prototype.")

spec = importlib.util.spec_from_file_location("build_pdf", HERE / "build_pdf.py")
build_pdf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_pdf)
html = build_pdf.HTML

HEAD = f"""<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{DESC}">
<link rel="canonical" href="{URL}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Dyaus Advisory">
<meta property="og:title" content="From Selling Trucks to Selling Certainty">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="{URL}">
<meta property="og:image" content="{URL}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="From Selling Trucks to Selling Certainty">
<meta name="twitter:description" content="{DESC}">
<meta name="twitter:image" content="{URL}og.png">
<script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':
new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
}})(window,document,'script','dataLayer','GTM-PJ725VM4');</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-6YPVQ5LW59"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-6YPVQ5LW59');</script>
"""

LOGO = ('<svg viewBox="140 120 744 784" width="22" height="23" aria-hidden="true"><path d="M512 140 L539 506 Q591 519 647 557 '
        'Q512 531 377 557 Q433 519 485 506 Z" fill="#eae6da"/><path d="M485 621 L539 621 L512 884 Z" fill="#eae6da"/>'
        '<path d="M166 724C278 598 389 557 512 557C635 557 746 598 858 724C746 641 635 609 512 609C389 609 278 641 166 724Z" fill="#d4b36a"/></svg>')

TOP = f"""<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PJ725VM4" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<header class="site-bar"><div class="site-bar-in">
  <a class="brand" href="/">{LOGO}<span>Dyaus Advisory</span></a>
  <nav><a href="/#insights">All insights</a><a class="cta" href="/#contact">Talk to us</a></nav>
</div></header>
<main class="page">"""

BOTTOM = """</main>
<footer class="site-foot"><div class="site-bar-in">
  <a href="/#insights">← More insights from Dyaus Advisory</a>
  <a class="cta" href="/#contact">Start a conversation</a>
</div></footer>"""

SCREEN_CSS = """<style>
@media screen {
  html { background: #F7F3EA; scroll-behavior: smooth; }
  body { background: #F7F3EA; }
  .site-bar { background: #151A33; position: sticky; top: 0; z-index: 10; }
  .site-bar-in { max-width: 940px; margin: 0 auto; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .brand { display: flex; align-items: center; gap: 10px; color: #fff; font-family: "Cormorant Garamond", serif; font-size: 21px; font-weight: 600; text-decoration: none; }
  .site-bar nav { display: flex; align-items: center; gap: 18px; font: 500 14px Inter, sans-serif; }
  .site-bar nav a { color: #CFD4E6; text-decoration: none; }
  .site-bar nav a:hover { color: #fff; }
  .site-bar .cta, .site-foot .cta { background: #E0B84E; color: #151A33 !important; padding: 8px 14px; font-weight: 600; text-decoration: none; }
  .page { width: 180mm; margin: 0 auto; padding: 10mm 0 8mm; zoom: 1.3; }
  .site-foot { border-top: 1px solid #DDD5C2; margin-top: 24px; }
  .site-foot .site-bar-in { padding: 24px; font: 500 15px Inter, sans-serif; }
  .site-foot a { color: #7D5F17; text-decoration: none; }
  .calls-wrap { break-before: auto; }
}
@media screen and (max-width: 980px) { .page { zoom: 1.12; } }
@media screen and (max-width: 760px) {
  .site-bar nav a:not(.cta) { display: none; }
  .brand { font-size: 19px; }
  .page { zoom: 1; width: auto; padding: 16px 16px 8px; font-size: 14.5px; line-height: 1.55; }
  .cover { padding: 26px 22px 20px; }
  .cover h1 { font-size: 36px; }
  .cover .sub { font-size: 15px; }
  .brandrow { flex-direction: column; align-items: flex-start; gap: 6px; }
  .byline { flex-direction: column; gap: 4px; font-size: 12px; }
  .cover-url { font-size: 13px; }
  .brief { padding: 16px 18px; }
  .brief .lead { font-size: 20px; }
  h2 { font-size: 25px; margin-top: 28px; }
  .lead { font-size: 15px; }
  p, td, .callout, .call p { font-size: 14.5px; }
  .stats { grid-template-columns: 1fr 1fr; gap: 16px; }
  .stat .big { font-size: 30px; }
  .stat .lbl { font-size: 12.5px; }
  .two, .start { grid-template-columns: 1fr; }
  figure { padding: 14px 12px; overflow-x: auto; }
  figure svg { min-width: 600px; }
  figure .ttl { font-size: 14px; }
  figcaption { font-size: 12px; }
  table { display: block; overflow-x: auto; font-size: 13.5px; }
  table tbody, table thead { display: table; width: 100%; min-width: 600px; }
  th { font-size: 11px; }
  .call { grid-template-columns: 44px 1fr; }
  .call .num { font-size: 30px; }
  .call h3 { font-size: 21px; }
  .call .proof { font-size: 13px; }
  .start .s .k { font-size: 30px; }
  .start .s .v { font-size: 13px; }
  .close { grid-template-columns: 1fr; padding: 20px; gap: 12px; }
  .close .q { font-size: 20px; }
  .close .links { text-align: left; white-space: normal; font-size: 14px; }
  .sources { font-size: 12px; }
  .cta-inline { font-size: 14px; padding: 8px 12px; }
  .site-foot .site-bar-in { flex-direction: column; align-items: flex-start; }
}
</style>"""

assert "</head>" in html and "<body>" in html and "</body>" in html
page = (
    html.replace("<title>From Selling Trucks to Selling Certainty — Dyaus Advisory Point of View</title>", f"<title>{TITLE}</title>")
    .replace("</head>", HEAD + SCREEN_CSS + "</head>", 1)
    .replace("<body>", "<body>" + TOP, 1)
    .replace("</body>", BOTTOM + "</body>", 1)
)

OG = f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Inter:wght@500;600&display=swap" rel="stylesheet">
<style>html,body{{margin:0;width:1200px;height:630px;}}
body{{background:#151A33;color:#fff;font-family:Inter,sans-serif;position:relative;overflow:hidden}}
body:after{{content:"";position:absolute;right:-180px;top:-180px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(224,184,78,.28),rgba(224,184,78,0) 65%)}}
.in{{position:absolute;inset:70px 80px}}
.row{{display:flex;justify-content:space-between;align-items:center}}
.firm{{font-family:"Cormorant Garamond",serif;font-size:38px;display:flex;gap:14px;align-items:center}}
.tag{{color:#E0B84E;font-size:20px;letter-spacing:.18em;font-weight:600}}
h1{{font-family:"Cormorant Garamond",serif;font-weight:600;font-size:86px;line-height:1;margin:70px 0 24px}}
p{{color:#CFD4E6;font-size:27px;margin:0;max-width:900px;line-height:1.35}}
.url{{position:absolute;bottom:0;left:0;color:#E0B84E;font-size:22px;font-weight:600}}</style></head>
<body><div class="in"><div class="row"><div class="firm">{LOGO.replace('width="22" height="23"', 'width="40" height="42"')}Dyaus Advisory</div>
<div class="tag">POINT OF VIEW</div></div>
<h1>From Selling Trucks<br>to Selling Certainty</h1>
<p>How AI will reprice Indian road freight, and what OEMs, fleets and financiers should do about it.</p>
<div class="url">dyausadvisory.live/insights</div></div></body></html>"""

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "index.html").write_text(page, encoding="utf-8")
    chrome = sorted(glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell")))[-1]
    with tempfile.TemporaryDirectory() as tmp:
        og_html = pathlib.Path(tmp) / "og.html"
        og_html.write_text(OG, encoding="utf-8")
        subprocess.run([chrome, "--disable-gpu", "--hide-scrollbars", "--window-size=1200,630", "--virtual-time-budget=5000",
                        f"--screenshot={OUT / 'og.png'}", og_html.as_uri()], check=True, capture_output=True)
    print("wrote", OUT / "index.html", "and og.png")
