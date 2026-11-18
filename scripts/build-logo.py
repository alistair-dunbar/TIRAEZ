# Builds the Tiraez logo files in app/public/brand and app/public/favicon.svg.
# One-off design tool, not part of the app: run it in a throwaway virtualenv with
#   pip install fonttools brotli uharfbuzz
# and a TTF copy of app/public/fonts/newsreader-latin.woff2 saved as newsreader.ttf in the working folder. Wordmark: "Tiraez" set in Newsreader (SIL OFL) at wght 500, opsz 72,
# outlined to paths, with the i's dot replaced by a small square in the clay accent.
# Mark: a T whose crossbar is a band with a fine incised line, on forest.
import sys, uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.recordingPen import DecomposingRecordingPen as _DRP
from fontTools.pens.boundsPen import BoundsPen
from fontTools.varLib.instancer import instantiateVariableFont

OUT = "/home/user/TIRAEZ/app/public/brand"
FONT = "/home/user/TIRAEZ/app/public/fonts/newsreader-latin.woff2"
INK, CLAY, FOREST, IVORY = "#20221F", "#9B513A", "#244638", "#F3F0E8"

blob = hb.Blob(open("newsreader.ttf", "rb").read())
face = hb.Face(blob); font = hb.Font(face)
font.set_variations({"wght": 500, "opsz": 72})
buf = hb.Buffer(); buf.add_str("Tiraez"); buf.guess_segment_properties()
hb.shape(font, buf, {"kern": True, "liga": True})

tt = instantiateVariableFont(TTFont(FONT), {"wght": 500, "opsz": 72})
gs = tt.getGlyphSet(); order = tt.getGlyphOrder()
upm = tt["head"].unitsPerEm
TRACK = -0.02 * upm  # matches the site's letter-spacing

x = 0; parts = []; tittle = None
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    name = order[info.codepoint]
    rec = _DRP(gs); gs[name].draw(rec)
    # split into contours
    contours, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ("closePath", "endPath"): contours.append(cur); cur = []
    keep = contours
    if name == "i":
        def bounds(c):
            bp = BoundsPen(gs); 
            for op, args in c: getattr(bp, op)(*args)
            return bp.bounds
        bs = [bounds(c) for c in contours]
        top = max(range(len(bs)), key=lambda k: bs[k][1])  # the dot sits highest
        b = bs[top]; keep = [c for k, c in enumerate(contours) if k != top]
        cx, cy = (b[0] + b[2]) / 2 + x + pos.x_offset, (b[1] + b[3]) / 2
        size = (b[2] - b[0]) * 0.74
        tittle = (cx - size / 2, cy - size / 2, size)
    pen = SVGPathPen(gs)
    for c in keep:
        for op, args in c: getattr(pen, op)(*args)
    d = pen.getCommands()
    parts.append(f'<path transform="translate({x + pos.x_offset:.1f} 0)" d="{d}"/>')
    x += pos.x_advance + TRACK + (45 if name == 'T' else 0)  # room for the i's square under the T's arm
width = x - TRACK
hhea = tt["hhea"]; asc, desc = hhea.ascent, hhea.descent
cap = tt["OS/2"].sCapHeight if hasattr(tt["OS/2"], "sCapHeight") else 1300

def wordmark_group(fill=INK, accent=CLAY):
    tx, ty, s = tittle
    return (f'<g fill="{fill}">' + "".join(parts) + "</g>"
            f'<rect x="{tx:.1f}" y="{ty:.1f}" width="{s:.1f}" height="{s:.1f}" rx="{s*0.08:.1f}" fill="{accent}"/>')

# font units are y-up: flip
top = asc; height = asc - desc
def svg(w, h, body, label):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img" aria-label="{label}">'
            f'<title>{label}</title>{body}</svg>\n')

pad = 20
wm_body = f'<g transform="translate({pad} {top + pad}) scale(1 -1)">{wordmark_group()}</g>'
open(f"{OUT}/tiraez-wordmark.svg", "w").write(svg(width + 2 * pad, height + 2 * pad, wm_body, "Tiraez"))
inv_body = f'<g transform="translate({pad} {top + pad}) scale(1 -1)">{wordmark_group(IVORY, "#C98B73")}</g>'
open(f"{OUT}/tiraez-wordmark-inverse.svg", "w").write(svg(width + 2 * pad, height + 2 * pad, inv_body, "Tiraez"))

def mark(size=64, radius=2, detail=True, bg=FOREST, fg=IVORY):
    s = size / 64
    r = lambda x, y, w, h, f=fg: f'<rect x="{x*s:g}" y="{y*s:g}" width="{w*s:g}" height="{h*s:g}" fill="{f}"/>'
    body = f'<rect width="{size}" height="{size}" rx="{radius}" fill="{bg}"/>'
    if detail:   # band with a fine incised line, stem through it
        body += r(14, 14, 36, 6.5) + r(14, 22, 14.5, 2) + r(35.5, 22, 14.5, 2) + r(28.5, 20.5, 7, 30)
    else:        # simplified for 16-32 px
        body += r(13, 14, 38, 9) + r(27.5, 23, 9, 28)
    return body

open(f"{OUT}/tiraez-mark.svg", "w").write(svg(64, 64, mark(64, 2), "Tiraez"))
open("/home/user/TIRAEZ/app/public/favicon.svg", "w").write(svg(32, 32, mark(32, 2, detail=False), "Tiraez"))

# Lockup: mark at cap height + wordmark
scale = cap / 64 * 1.18
gap = 0.32 * cap
lock_w = 64 * scale + gap + width + 2 * pad
lock = (f'<g transform="translate({pad} {top + pad - cap*1.09:.1f}) scale({scale:.3f})">{mark(64, 2)}</g>'
        f'<g transform="translate({pad + 64*scale + gap:.1f} {top + pad}) scale(1 -1)">{wordmark_group()}</g>')
open(f"{OUT}/tiraez-logo.svg", "w").write(svg(lock_w, height + 2 * pad, lock, "Tiraez"))

print("width", round(width), "asc", asc, "desc", desc, "cap", cap, "tittle", [round(v) for v in tittle])
