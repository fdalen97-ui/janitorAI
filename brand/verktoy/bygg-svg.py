# Krever: pip install fonttools
# Bygger mesterfilene for DocrAI-merket «Stemmen i søkeren» (valgt av gruppa 04.11.2026).
import os, json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

import pathlib
OUT = str(pathlib.Path(__file__).resolve().parents[1])
# Manrope 700 (OFL). Last ned: https://fonts.google.com/specimen/Manrope — eller
# python3 bygg-svg.py /sti/til/Manrope-Bold.ttf
import sys
FONT = sys.argv[1] if len(sys.argv) > 1 else str(pathlib.Path(OUT) / "verktoy" / "Manrope-700.ttf")

# Glass og stål (valgt 05.10.2026)
STEEL="#2F4A5E"; PAPER="#FBFEFF"; INK="#072227"; YEL="#FFD84D"; YEL_D="#ECC745"; DINK="#E6ECEE"; GLASS="#E8F5F8"

# ---------- merket, 96-grid ----------
CORNERS = "M8 28 V8 H28 M68 8 H88 V28 M88 68 V88 H68 M28 88 H8 V68"
D_CLIP  = "M8 4 H40 C62 4 76 19 76 40 C76 61 62 76 40 76 H8 Z"   # i 80-grid
BARS = [(8,4,72),(22,22,36),(36,10,60),(50,26,28),(64,18,44)]   # x, y, h (bredde 9)

def mark(fg, dot, uid, scale=1.0):
    bars = "".join(f'<rect x="{x}" y="{y}" width="9" height="{h}" rx="4.5"/>' for x,y,h in BARS)
    return (f'<g transform="scale({scale})">'
            f'<path d="{CORNERS}" fill="none" stroke="{fg}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<clipPath id="{uid}"><path d="{D_CLIP}" transform="translate(20 20) scale(0.7)"/></clipPath>'
            f'<g clip-path="url(#{uid})" fill="{fg}" transform="translate(20 20) scale(0.7)">{bars}</g>'
            f'<circle cx="78" cy="18" r="5" fill="{dot}"/></g>')

# ---------- ordmerket som kurver ----------
font = TTFont(FONT)
upem = font["head"].unitsPerEm
cmap = font.getBestCmap(); glyphs = font.getGlyphSet(); hmtx = font["hmtx"]
# GPOS parvis kerning (format 1 og 2), nok for «DocrAI»
def kern_pairs():
    pairs = {}
    gpos = font["GPOS"].table
    for lookup in gpos.LookupList.Lookup:
        for st in lookup.SubTable:
            if lookup.LookupType == 9: st = st.ExtSubTable
            if getattr(st, "LookupType", lookup.LookupType) != 2: continue
            cov = st.Coverage.glyphs
            if st.Format == 1:
                for g, ps in zip(cov, st.PairSet):
                    for pvr in ps.PairValueRecord:
                        v = pvr.Value1.XAdvance if pvr.Value1 and hasattr(pvr.Value1, "XAdvance") else 0
                        pairs.setdefault((g, pvr.SecondGlyph), v)
            elif st.Format == 2:
                c1 = st.ClassDef1.classDefs; c2 = st.ClassDef2.classDefs
                for g1 in cov:
                    k1 = c1.get(g1, 0)
                    for g2, k2 in list(c2.items()) + [(None,0)]:
                        rec = st.Class1Record[k1].Class2Record[k2]
                        v = rec.Value1.XAdvance if rec.Value1 and hasattr(rec.Value1, "XAdvance") else 0
                        if g2 is not None and v: pairs.setdefault((g1, g2), v)
    return pairs
KERN = kern_pairs()

def text_path(text, size, tracking_em=-0.028):
    s = size / upem
    x = 0.0; d = []
    names = [cmap[ord(ch)] for ch in text]
    for i, gn in enumerate(names):
        pen = SVGPathPen(glyphs)
        glyphs[gn].draw(TransformPen(pen, (s, 0, 0, -s, x, 0)))
        d.append(pen.getCommands())
        adv = hmtx[gn][0]
        if i + 1 < len(names): adv += KERN.get((gn, names[i+1]), 0)
        x += adv * s + tracking_em * size
    cap = font["OS/2"].sCapHeight * s
    return " ".join(d), x, cap

WM_SIZE = 53  # ved merke på 96
wm_d, wm_w, cap = text_path("DocrAI", WM_SIZE)
GAP = 22
mark_h = 96
# ordmerket plasseres med versalhøyden sentrert på merket
baseline = mark_h/2 + cap/2
lock_w = 96 + GAP + wm_w

def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" role="img" aria-labelledby="t">'
            f'<title id="t">{title}</title>{body}</svg>\n')

files = {}
files["docrai-merke.svg"] = svg(96, 96, mark(STEEL, YEL, "d"), "DocrAI")
files["docrai-merke-mork.svg"] = svg(96, 96, mark(PAPER, YEL_D, "d"), "DocrAI")
files["docrai-logo.svg"] = svg(round(lock_w,1), 96, mark(STEEL, YEL, "d") + f'<path transform="translate({96+GAP} {baseline:.2f})" d="{wm_d}" fill="{INK}"/>', "DocrAI")
files["docrai-logo-mork.svg"] = svg(round(lock_w,1), 96, mark(PAPER, YEL_D, "d") + f'<path transform="translate({96+GAP} {baseline:.2f})" d="{wm_d}" fill="{DINK}"/>', "DocrAI")
# app-ikon: full kvadrat, stålblå flate, merket på 62 % av flaten
files["docrai-app-ikon.svg"] = svg(1024, 1024, f'<rect width="1024" height="1024" fill="{STEEL}"/><g transform="translate(195 195)">{mark(PAPER, YEL, "d", scale=6.6)}</g>', "DocrAI")
# favicon: samme som app-ikon men med avrundede hjørner (vises uten maske i fanen)
files["docrai-favicon.svg"] = svg(96, 96, f'<rect width="96" height="96" rx="20" fill="{STEEL}"/><g transform="translate(16 16)">{mark(PAPER, YEL, "d", scale=0.6667)}</g>', "DocrAI")

for name, content in files.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f: f.write(content)

print(json.dumps({"lock_w": round(lock_w,1), "cap": round(cap,1), "kern_pairs": len(KERN), "files": list(files)}))
