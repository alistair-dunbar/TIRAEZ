#!/usr/bin/env python3
"""Builds the print-ready HTML for a template pack and its free preview.

    python3 packs/build_pdf.py docs/packs/coffee-shops-ar.md
    node packs/print-pdf.mjs            # HTML -> PDF with the pre-installed Chromium

Reads the pack's markdown (the single source of the template text), so the PDFs
never drift from it. Standard library only.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "build"

BRAND = {
    "name": "شهر قهوة",
    "tagline": "٣٠ منشور جاهز لمحلك. انسخ، عدّل، وانشر.",
    "preview_title": "٥ منشورات جاهزة لمحل قهوتك",
    "preview_ids": [1, 7, 13, 19, 25],
    "price": "٩٩ ريال",
    # Filled in once the store exists. Shown on the preview's last page.
    "store_url": "[رابط المتجر]",
}

TYPES = [
    ("ترويجي", "تعريف بمنتج أو خدمة", "#8a5a2b"),
    ("تعليمي", "تعطي متابعك معلومة تنفعه", "#2f6f62"),
    ("آراء العملاء", "غيرك يمدحك بدالك", "#7a4b7a"),
    ("من الكواليس", "تورّي الشغل اللي ما ينشاف", "#3d5a80"),
    ("عروض محدودة", "سبب يخلّي العميل يجي اليوم", "#a8442f"),
]

AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def parse(md: str):
    """Returns (usage bullets, templates, calendar rows)."""
    usage = re.findall(r"^- (.+)$", md.split("## طريقة الاستخدام")[1].split("##")[0], re.M)
    templates = []
    for m in re.finditer(r"^### (\S+)\. (.+?)\n```\n(.*?)\n```\nالصورة: (.+?)$", md, re.M | re.S):
        num = int(m.group(1).translate(AR_DIGITS))
        templates.append({"n": num, "n_ar": m.group(1), "title": m.group(2).strip(),
                          "body": m.group(3), "photo": m.group(4).strip(), "type": (num - 1) // 6})
    cal = md.split("## جدول النشر")[1]
    rows = [[c.strip() for c in line.strip("|").split("|")]
            for line in cal.splitlines() if line.startswith("|") and "---" not in line][1:]
    return usage, templates, rows


def inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"`(.+?)`", r"<bdi class='code'>\1</bdi>", text)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)


def body_html(body: str) -> str:
    # Placeholders are highlighted so the buyer sees at a glance what to replace.
    out = html.escape(body)
    out = re.sub(r"\[([^\]]+)\]", r"<span class='ph'>[\1]</span>", out)
    return out.replace("\n", "<br>")


def card(t) -> str:
    name, _, color = TYPES[t["type"]]
    return f"""
<section class="card" style="--c:{color}">
  <header><span class="num">{t['n_ar']}</span><h3>{html.escape(t['title'])}</h3><span class="tag">{name}</span></header>
  <div class="copy">{body_html(t['body'])}</div>
  <p class="photo"><b>الصورة:</b> {html.escape(t['photo'])}</p>
</section>"""


CSS = """
@font-face{font-family:Plex;font-weight:400;src:url(../fonts/plex-arabic-400.woff2)}
@font-face{font-family:Plex;font-weight:600;src:url(../fonts/plex-arabic-600.woff2)}
@font-face{font-family:Plex;font-weight:700;src:url(../fonts/plex-arabic-700.woff2)}
@page{size:A4;margin:16mm 15mm 18mm}
*{box-sizing:border-box}
html{direction:rtl}
body{font-family:Plex,"DejaVu Sans","Noto Color Emoji",sans-serif;color:#2a211b;font-size:11.5pt;line-height:1.75;margin:0}
h1,h2,h3{margin:0;line-height:1.3}
.cover{height:262mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;
  background:#2a211b;color:#f6efe6;border-radius:6mm;page-break-after:always;padding:20mm}
.cover .kicker{letter-spacing:.5px;color:#d9b88a;font-weight:600;font-size:13pt;margin-bottom:10mm}
.cover h1{font-size:54pt;font-weight:700}
.cover .tag{font-size:17pt;margin-top:8mm;color:#eadfce}
.cover .foot{margin-top:26mm;font-size:11pt;color:#b9a892}
.cover .cup{font-size:40pt;margin-bottom:6mm}
h2.sec{font-size:20pt;font-weight:700;margin:0 0 5mm;padding-bottom:2.5mm;border-bottom:1.2mm solid var(--c,#2a211b)}
.page{page-break-after:always}
ul.usage{padding:0 5mm 0 0;margin:0 0 8mm}
ul.usage li{margin-bottom:2.2mm}
.code{background:#efe6d9;border-radius:1mm;padding:0 1.2mm;font-size:10.5pt}
table{width:100%;border-collapse:collapse;font-size:11pt}
th,td{border-bottom:.3mm solid #e2d6c5;padding:2mm 3mm;text-align:right}
th{background:#f3ebdf;font-weight:600}
.dot{display:inline-block;width:3mm;height:3mm;border-radius:50%;background:var(--c);margin-left:2mm;vertical-align:middle}
.sechead{page-break-before:always;--c:#2a211b;margin-bottom:6mm}
.sechead p{margin:0 0 4mm;color:#6b5d50}
.card{break-inside:avoid;margin-bottom:7mm;border:.3mm solid #e2d6c5;border-radius:3mm;overflow:hidden}
.card header{display:flex;align-items:center;gap:3mm;background:#f6efe6;padding:2.5mm 4mm;border-bottom:.3mm solid #e2d6c5}
.card .num{background:var(--c);color:#fff;font-weight:700;min-width:8.5mm;height:8.5mm;border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-size:11pt}
.card h3{font-size:13.5pt;font-weight:700;flex:1}
.card .tag{font-size:9pt;color:var(--c);border:.3mm solid var(--c);border-radius:10mm;padding:0 2.5mm;font-weight:600}
.card .copy{padding:4mm 5mm;font-size:11.5pt;line-height:1.85;background:#fff}
.ph{color:var(--c);font-weight:600}
.card .photo{margin:0;padding:2mm 5mm 3mm;font-size:10pt;color:#6b5d50;border-top:.3mm dashed #e2d6c5}
.cal td:first-child,.cal th:first-child{width:18mm;text-align:center}
.cal td:nth-child(2),.cal th:nth-child(2){width:22mm;text-align:center}
.cols{columns:2;column-gap:8mm}
.cols table{break-inside:avoid}
.cta{break-inside:avoid;background:#2a211b;color:#f6efe6;border-radius:4mm;padding:9mm;text-align:center;margin-top:6mm}
.cta h2{font-size:22pt;margin-bottom:3mm}
.cta p{margin:0 0 2mm;color:#eadfce}
.cta .price{font-size:16pt;font-weight:700;color:#d9b88a;margin-top:4mm}
.note{color:#6b5d50;font-size:10.5pt}
"""


def page(title: str, body: str) -> str:
    return (f"<!doctype html><html lang='ar' dir='rtl'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style></head><body>{body}</body></html>")


def cover(kicker: str, title: str, tag: str, foot: str) -> str:
    return (f"<div class='cover'><div class='cup'>☕</div><div class='kicker'>{kicker}</div>"
            f"<h1>{title}</h1><div class='tag'>{tag}</div><div class='foot'>{foot}</div></div>")


def usage_html(usage) -> str:
    return "<ul class='usage'>" + "".join(f"<li>{inline(u)}</li>" for u in usage) + "</ul>"


def build_full(usage, templates, rows) -> str:
    parts = [cover("لمحلات القهوة المختصة", BRAND["name"], BRAND["tagline"],
                   "٣٠ قالب · جدول نشر لـ ٣٠ يوم · دليل استخدام")]
    types = "".join(
        f"<tr><td><span class='dot' style='--c:{c}'></span>{n}</td><td>{'–'.join(ar(x) for x in (i*6+1, i*6+6))}</td><td>{d}</td></tr>"
        for i, (n, d, c) in enumerate(TYPES))
    parts.append(f"<div class='page'><h2 class='sec'>طريقة الاستخدام</h2>{usage_html(usage)}"
                 f"<h2 class='sec'>الأنواع الخمسة</h2><table><tr><th>النوع</th><th>القوالب</th><th>الهدف</th></tr>{types}</table></div>")
    for i, (name, desc, color) in enumerate(TYPES):
        cards = "".join(card(t) for t in templates if t["type"] == i)
        parts.append(f"<div class='sechead' style='--c:{color}'><h2 class='sec'>{name}</h2><p>{desc}</p></div>{cards}")
    half = (len(rows) + 1) // 2
    def tbl(rs):
        return ("<table class='cal'><tr><th>اليوم</th><th>القالب</th><th>النوع</th></tr>"
                + "".join(f"<tr><td>{a}</td><td>{b}</td><td>{html.escape(c)}</td></tr>" for a, b, c in rs) + "</table>")
    parts.append("<div class='sechead'><h2 class='sec'>جدول النشر: ٣٠ يوم</h2>"
                 "<p>كل أسبوع فيه الأنواع الخمسة، وما يتكرر نفس النوع يومين ورا بعض.</p></div>"
                 f"<div class='cols'>{tbl(rows[:half])}{tbl(rows[half:])}</div>")
    return page(BRAND["name"], "".join(parts))


def build_preview(usage, templates) -> str:
    picked = [t for i in BRAND["preview_ids"] for t in templates if t["n"] == i]
    # Renumber 1-5 for the preview; keep each template's own type colour.
    for k, t in enumerate(picked, 1):
        t = dict(t); t["n_ar"] = ar(k); picked[k - 1] = t
    parts = [cover("عيّنة مجانية من باقة «" + BRAND["name"] + "»", BRAND["preview_title"],
                   "وحدة من كل نوع. انسخها، حط معلومات محلك، وانشرها هالأسبوع.", "ببلاش")]
    parts.append(f"<h2 class='sec'>طريقة الاستخدام</h2>{usage_html(usage)}")
    parts.append("".join(card(t) for t in picked))
    parts.append(f"<div class='cta'><h2>عجبتك؟</h2><p>الباقة الكاملة «{BRAND['name']}» فيها ٣٠ منشور وجدول نشر لشهر كامل.</p>"
                 f"<p>دفعة وحدة، بدون اشتراك، وضمان ٧ أيام.</p><div class='price'>{BRAND['price']}</div>"
                 f"<p style='margin-top:3mm'>{html.escape(BRAND['store_url'])}</p></div>")
    return page(BRAND["preview_title"], "".join(parts))


def ar(n: int) -> str:
    return str(n).translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))


def main():
    src = Path(sys.argv[1])
    usage, templates, rows = parse(src.read_text(encoding="utf-8"))
    assert len(templates) == 30, f"expected 30 templates, found {len(templates)}"
    assert len(rows) == 30, f"expected 30 calendar rows, found {len(rows)}"
    OUT.mkdir(exist_ok=True)
    (OUT / "shahr-qahwa.html").write_text(build_full(usage, templates, rows), encoding="utf-8")
    (OUT / "shahr-qahwa-preview.html").write_text(build_preview(usage, templates), encoding="utf-8")
    (OUT / "jobs.json").write_text(json.dumps([
        {"html": "shahr-qahwa.html", "pdf": "shahr-qahwa.pdf"},
        {"html": "shahr-qahwa-preview.html", "pdf": "shahr-qahwa-preview.pdf"}]))
    print(f"wrote {OUT}/*.html ({len(templates)} templates)")


if __name__ == "__main__":
    main()
