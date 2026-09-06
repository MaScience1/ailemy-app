#!/usr/bin/env python3
"""
4PH1 specification extractor — the one step between the official Pearson PDF
and everything downstream. The Physics sibling of extract_4bi1.py; the shared
shape is deliberate, the deltas are Physics's own and each is annotated.

============================================================================
⚠ SOURCE OF TRUTH: the official document, nothing else
============================================================================
Input : Pearson Edexcel International GCSE in Physics (4PH1) Specification,
        Issue 4, © Pearson Education Limited 2024 (first teaching September
        2017, first examination June 2019; ISBN 978 1 446 93119 6). The PDF
        is NOT in the repository; the default path is where it was
        downloaded from qualifications.pearson.com on 2026-09-06. Pearson no
        longer serves Issue 3; Issue 4's own change summary (spec p.i) lists
        only administrative deltas against the previous issue — series
        availability (pp. 8-9), forbidden combinations (p. 33) and the
        command word "Which" (p. 48) — NO content-section changes, so Issue 4
        is the correct pinned authority for the whole 2019-2025 paper corpus.
        The script refuses any PDF whose cover does not say 4PH1 + Issue 4,
        and records the file's sha256 in the output so the artefacts stay
        pinned to one exact document.

Output (both committed, both deterministic for a given PDF):
  4ph1-issue4-content-lines.txt — every text line of the content pages with
        its font names, sizes and position. The near-source evidence: the
        test suite re-derives its expectations from THIS file, independently
        of the JSON, so the parser below cannot quietly vouch for itself.
  4ph1-issue4.json — the canonical extraction: 8 sections, their lettered
        sub-topics, and every numbered specification statement with its
        official code, official wording, Physics-only flag and practical
        flag.

============================================================================
⚠ WHAT THE DOCUMENT'S OWN TYPOGRAPHY MEANS (spec p.1, "Referencing")
============================================================================
- Statements IN BOLD carry a 'P' code suffix: "specification statements that
  are in bold with a 'P' reference relate to content that is in the
  International GCSE in Physics only and is not found in the International
  GCSE in Science (Double Award)". Paper 1 "assesses core content that is
  not in bold and does not have a 'P' reference"; Paper 2 "assesses all the
  content" (spec pp.8-9). So the P SUFFIX IS the Paper 2-only marker,
  carried by the official code itself — no schema field is needed, and this
  script ASSERTS bold ⟺ P for every statement so the claim is checked
  against the document, not assumed.
- Statements IN ITALICS beginning "practical:" are practical investigations
  ("these are included within Section 3: Physics content as specification
  points in italics", spec p.1). Recorded as `practical: true`. A P-suffixed
  practical (e.g. 2.23P, 5.11P) is set bold-italic and carries both flags.
- Physics sets single VARIABLE SYMBOLS (the c of "critical angle c", the g
  of "gravitational field strength, g") in inline Times italic mid-sentence.
  Unlike 4BI1, "any italic on the row" therefore proves nothing; every
  fully-italic-row rule below demands ALL fonts italic, and the practical
  flag is carried by the official "practical:" prefix exactly as in 4BI1.
- 4BI1's context headings (whole-row italic headings inside sub-topic
  tables) do not occur in 4PH1's content tables; the detector is kept armed
  with tighter guards (fully italic, digit-free, '='-free — a symbol
  equation row like ' F = m × a' starts at the code column x and must never
  be mistaken for a heading) and the meta records how many were found (0).

============================================================================
⚠ EQUATIONS — the Physics-specific extraction problem, and its policy
============================================================================
The document displays many relationships twice — a word equation and a
symbol equation — and renders fractions as STACKED layout: numerator spans
above a drawn horizontal bar, denominator spans below it (the bar is a
vector drawing, not text; plain text extraction reads the three rows in the
wrong order and loses the structure — pdftotext renders "½" as "12").
Owner-approved policy (Phase 2 approval, decision 2): deterministic readable
inline representation, preserving Unicode scientific symbols, never altering
the academic relationship:

  - Every fraction is anchored to its DRAWN BAR: numerator = text spans
    whose baseline sits within 20pt above the bar and whose x-extent
    overlaps it; denominator likewise below. A bar that resolves to an
    empty numerator or denominator REFUSES the extraction.
  - The assembled fraction reads numerator/denominator inline, each side
    parenthesised iff it contains a space or an operator (and is not
    already parenthesised):
        average speed = (distance moved)/(time taken)
        v = (2 × π × r)/T
    A 1-over-2 (the document's built ½ glyph in the kinetic energy
    statements — once a horizontal mini-bar, once a DIAGONAL stroke with
    the 1 upper-left and the 2 lower-right) becomes the single Unicode
    character ½.
  - Fractions on BOTH sides of '=' (p₁/T₁ = p₂/T₂, the transformer and
    red-shift equations) fall out of the same rule: each bar is assembled
    independently and the row is re-joined left-to-right by x.
  - Raised/lowered small spans become Unicode super/subscripts (v², m/s²,
    λ₀, Vₚ, β⁻, the ¹⁴₆C nuclide). ⚠ A scripted character with no Unicode
    form REFUSES the extraction — nothing silently falls back to a baseline
    glyph that would read as ordinary text (the audit's highest-risk item).
  - Spans inside equations carry no explicit spaces; a horizontal gap
    > 0.8pt between adjacent spans is rendered as one space ("sin i", not
    "sini"). Prose spans carry their own spaces and are joined verbatim.
  - Each row containing '=' is kept as its own line of the statement, so
    the word form and the symbol form remain two lines, as printed.
  - The document's own irregularities are KEPT verbatim: 'E = I × V x t'
    really does set its third operator as the letter x (spec p.20), and
    the efficiency denominator really does read 'total energy output'
    (spec p.25) — faithful means faithful to Pearson, typos included.

Known normalisations (recorded here because faithful is not identical):
- Stacked fractions and super/subscripts are reconstructed as above; the
  committed content-lines.txt is the POST-assembly near-source (rows in
  reading order with fonts/positions), and the sha256-pinned PDF remains
  the byte-level source for anyone re-deriving from zero.
- The content pages contain NO embedded images (asserted below), so unlike
  4CH1 there are no image-adjacent statements: meta.imageAdjacent is [].
- Line breaks inside a statement are kept as '\\n' for bullets and equation
  rows; bullets keep their '•'.

Usage:
  python3 scripts/spec-extract/extract_4ph1.py \\
      [--pdf ~/Desktop/international-gcse-physics-4ph1-specification-issue4.pdf]
"""

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata

try:
    import pymupdf  # PyMuPDF
except ImportError:  # pragma: no cover
    sys.exit("PyMuPDF is required: pip3 install pymupdf")

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PDF = os.path.expanduser(
    "~/Desktop/international-gcse-physics-4ph1-specification-issue4.pdf"
)

# Super/subscript tables. Extended over 4BI1's digits-and-signs: Physics
# subscripts letters with Unicode forms (Vₚ, Iₛ — U+209A/U+209B). Any scripted
# character OUTSIDE these tables aborts the extraction (see script_render).
SUPER = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶",
         "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "–": "⁻", "−": "⁻",
         "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ"}
SUB = {"0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆",
       "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "–": "₋", "−": "₋",
       "(": "₍", ")": "₎", "p": "ₚ", "s": "ₛ", "e": "ₑ", "t": "ₜ"}

# Eight content sections; the official suffix letter is P (4BI1's is B).
CODE_RE = re.compile(r"^([1-8])\.(\d{1,2})(P?)\b\s*(.*)$")
SUBSECTION_RE = re.compile(r"^\(([a-z])\)\s+(.+?)\s*$")
# A context heading sits at the code column; continuation text never does.
# (Kept from 4BI1; 4PH1 is expected to have none — see the docstring.)
CONTEXT_MAX_X = 80.0
CONTEXT_MAX_LEN = 48

# Fraction-bar geometry: content-table rules run the full width (x 57–539);
# a fraction bar is a short horizontal segment indented into the text column.
BAR_MIN_W, BAR_MAX_W, BAR_MIN_X = 3.0, 300.0, 80.0
FRACTION_FONT = "(assembled-fraction)"  # synthetic; carries no bold/italic

# A wrapped equation row ends mid-phrase on one of these; its continuation
# row is re-joined so one relationship stays one printed line (5.13P's
# "… × change in" ↵ "temperature" is the document's only case).
DANGLING_TAIL = {"in", "of", "the", "a", "per", "and", "to", "with",
                 "×", "÷", "+", "−", "/", "="}


def dominant_size(spans):
    """The row's text size, weighted by stripped text length; ties break to
    the LARGER size — scripts are always the minority smaller spans, and a
    tie decided by dict insertion order once hid the Vₚ/Vₛ subscripts."""
    weight = {}
    for s in spans:
        weight[round(s["size"])] = weight.get(round(s["size"]), 0) + len(s["text"].strip())
    best = max(weight.values())
    return max(size for size, w in weight.items() if w == best)


def script_render(spans, where):
    """Spans (x-sorted) → text, super/subscripts as Unicode, gap-spaced.

    A span is scripted iff its size is well below the dominant size AND its
    baseline is offset from the dominant baseline (|off| > 0.3pt — the
    speed² superscript in the kinetic-energy word equation sits at exactly
    -0.5). Equal-x scripted pairs render superscript before subscript, which
    is what stacks ¹⁴₆C correctly. ⚠ REFUSES on any scripted character with
    no table entry — a silently kept baseline glyph would read as prose."""
    if not spans:
        return ""
    dom = dominant_size(spans)
    baselines = [s["y"] for s in spans if round(s["size"]) == dom]
    base = min(baselines) if baselines else spans[0]["y"]
    ordered = sorted(spans, key=lambda s: (round(s["x"], 1), s["y"]))
    text = ""
    prev = None
    for s in ordered:
        t = s["text"]
        forced = s.get("script")  # pre-tagged by the orphan-superscript pass
        table = None
        if forced == "sup":
            table = SUPER
        elif forced == "sub":
            table = SUB
        elif round(s["size"]) < dom - 1.5 and t.strip():
            off = s["y"] - base
            if off < -0.3:
                table = SUPER
            elif off > 0.3:
                table = SUB
        scripted = table is not None
        if scripted:
            out = []
            for ch in t.strip():
                if ch not in table:
                    sys.exit(f"EXTRACTION REFUSED: scripted character {ch!r} in {where} "
                             f"has no Unicode super/subscript form — extend the table, "
                             f"never fall back silently")
                out.append(table[ch])
            t = "".join(out)
        # A super/subscript belongs to the token before it: never open a gap
        # in front of one (the Vₚ Iₚ and λ₀ cases have real x-gaps there),
        # nor after a force-stacked pair (¹⁴₆C reads as one symbol).
        if prev is not None and not scripted and prev.get("script") is None \
                and s["x"] - prev["x1"] > 0.8 \
                and not prev["text"].endswith(" ") and not t.startswith(" "):
            text += " "
        text += t
        prev = s
    return text


def spaced_operators(s):
    """Deterministic operator spacing for assembled math: exactly one space
    around ×, ÷ and the true minus (U+2212), and around '=' — the PDF's math
    spans carry no space characters, spacing there is purely geometric, so
    this is rendering, not rewording. Never applied to prose."""
    s = re.sub(r"\s*([×÷−=])\s*", r" \1 ", s)
    return re.sub(r"\s{2,}", " ", s).strip()


def fraction_bars(page):
    """Drawn fraction bars on the page: short horizontal strokes/thin rects
    indented into the text column (full-width table rules start at x≈57)."""
    bars = set()
    for d in page.get_drawings():
        for item in d["items"]:
            if item[0] == "l":
                p1, p2 = item[1], item[2]
                if abs(p1.y - p2.y) < 0.5:
                    x0, x1 = min(p1.x, p2.x), max(p1.x, p2.x)
                    if BAR_MIN_W <= x1 - x0 <= BAR_MAX_W and x0 > BAR_MIN_X:
                        bars.add((round(p1.y, 1), round(x0, 1), round(x1, 1)))
            elif item[0] == "re":
                r = item[1]
                if r.height < 2 and BAR_MIN_W <= r.width <= BAR_MAX_W and r.x0 > BAR_MIN_X:
                    bars.add((round(r.y0, 1), round(r.x0, 1), round(r.x1, 1)))
    return sorted(bars)


def diagonal_strokes(page):
    """Short DIAGONAL strokes: the kinetic-energy word equation builds its ½
    as digit-stroke-digit with a slanted line (p.26), unlike every other
    fraction's horizontal bar. Returns (x0, y_top, x1, y_bottom) boxes."""
    out = []
    for d in page.get_drawings():
        for item in d["items"]:
            if item[0] == "l":
                p1, p2 = item[1], item[2]
                dx, dy = abs(p1.x - p2.x), abs(p1.y - p2.y)
                if 2.0 <= dx <= 20.0 and 2.0 <= dy <= 20.0:
                    out.append((min(p1.x, p2.x), min(p1.y, p2.y),
                                max(p1.x, p2.x), max(p1.y, p2.y)))
    return out


def parenthesise(part):
    part = part.strip()
    if part.startswith("(") and part.endswith(")"):
        depth = 0
        for i, ch in enumerate(part):
            depth += ch == "("
            depth -= ch == ")"
            if depth == 0 and i < len(part) - 1:
                break
        else:
            return part  # already one balanced group — never double-wrap
    return f"({part})" if re.search(r"[ ×÷+/]|[−–]|(?<=.)-", part) else part


def page_spans(page):
    spans = []
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block.get("lines", []):
            for s in line["spans"]:
                spans.append({
                    "text": s["text"], "x": s["origin"][0], "y": s["origin"][1],
                    "x1": s["bbox"][2], "size": s["size"], "font": s["font"],
                })
    return spans


def assemble_fractions(spans, bars, pageno, fractions_log):
    """Replace each drawn bar's numerator/denominator spans with one inline
    fraction span sitting on the equation's own baseline. Bars are processed
    left-to-right, top-to-bottom; 4PH1 has no nested bars (a ½ bar and a
    wide bar never overlap in x)."""
    for (by, bx0, bx1) in bars:
        num = [s for s in spans if by - 20 < s["y"] < by
               and s["x"] < bx1 + 1 and s["x1"] > bx0 - 1 and s["text"].strip()]
        den = [s for s in spans if by < s["y"] < by + 20
               and s["x"] < bx1 + 1 and s["x1"] > bx0 - 1 and s["text"].strip()]
        if not num or not den:
            sys.exit(f"EXTRACTION REFUSED: fraction bar p{pageno + 1} y={by} "
                     f"x={bx0}-{bx1} has empty numerator or denominator — "
                     f"geometry drifted; investigate before trusting any equation")
        where = f"fraction p{pageno + 1} y={by}"
        ntext = spaced_operators(script_render(num, where))
        dtext = spaced_operators(script_render(den, where))
        if (ntext, dtext) == ("1", "2"):
            text = "½"  # the document's built one-half glyph
        else:
            text = f"{parenthesise(ntext)}/{parenthesise(dtext)}"
        # The fraction sits on the equation's main baseline: the nearest span
        # outside the bar's x-range on the bar's own visual line ('v =', the
        # lone '='), else just below the bar.
        mid = [s for s in spans if abs(s["y"] - (by + 3)) < 4 and s["text"].strip()
               and (s["x1"] <= bx0 - 1 or s["x"] >= bx1 + 1) and s not in num and s not in den]
        y = min((s["y"] for s in mid), default=by + 3.0)
        size = max((s["size"] for s in mid), default=10.0)
        for s in num + den:
            spans.remove(s)
        spans.append({"text": text, "x": bx0, "y": y, "x1": bx1,
                      "size": size, "font": FRACTION_FONT})
        fractions_log.append({"page": pageno + 1, "text": text})
    return spans


def assemble_diagonal_fractions(spans, strokes, pageno, fractions_log):
    """The slash-built ½: a short diagonal stroke with one small digit whose
    baseline sits at or above the stroke's vertical middle (the numerator,
    upper-left) and one below it (the denominator, lower-right)."""
    for (x0, y0, x1, y1) in strokes:
        mid = (y0 + y1) / 2
        near = [s for s in spans if s["text"].strip().isdigit() and s["size"] <= 9
                and x0 - 6 <= s["x"] <= x1 + 6 and y0 - 2 <= s["y"] <= y1 + 3]
        num = [s for s in near if s["y"] <= mid + 1]
        den = [s for s in near if s["y"] > mid + 1]
        if len(num) != 1 or len(den) != 1:
            sys.exit(f"EXTRACTION REFUSED: diagonal stroke p{pageno + 1} "
                     f"({round(x0, 1)},{round(y0, 1)}) is not a clean digit/digit "
                     f"fraction ({len(num)} above, {len(den)} below) — investigate")
        ntext, dtext = num[0]["text"].strip(), den[0]["text"].strip()
        text = "½" if (ntext, dtext) == ("1", "2") else f"{ntext}/{dtext}"
        # Sit on the row of the nearest normal-size span to the stroke's right.
        row = [s for s in spans if s not in near and s["size"] > 9
               and abs(s["y"] - mid) < 6 and s["text"].strip()]
        y = min((s["y"] for s in row), default=mid)
        for s in num + den:
            spans.remove(s)
        spans.append({"text": text, "x": x0, "y": y, "x1": x1,
                      "size": 10.0, "font": FRACTION_FONT})
        fractions_log.append({"page": pageno + 1, "text": text})
    return spans


def attach_orphan_scripts(spans, stacked_log, pageno):
    """The ¹⁴₆C nuclide (7.2): its superscript '14' renders as a tiny row of
    its own ABOVE the statement row, x-aligned with the subscript '6'. Any
    small digit-only span whose nearest small neighbour 3-9pt BELOW shares
    its x-position is re-baselined onto that neighbour's row and force-tagged
    superscript, so the pair stacks super-then-sub at one x."""
    small = [s for s in spans if round(s["size"]) <= 8 and s["text"].strip()
             and s["text"].strip().isdigit()]
    for s in small:
        for other in small:
            if other is s:
                continue
            if 3.0 < other["y"] - s["y"] < 10.0 and abs(other["x"] - s["x"]) < 4.0:
                s["y"] = other["y"]
                s["script"] = "sup"
                other["script"] = "sub"  # the pair stacks at one x: ¹⁴₆C
                stacked_log.append({"page": pageno + 1,
                                    "pair": f"{s['text'].strip()}|{other['text'].strip()}"})
    return spans


def line_records(doc, first, last):
    """Rows of pages [first, last] in reading order: spans → fraction
    assembly → orphan-script attachment → baseline clustering → rendering.

    4BI1 clustered pymupdf lines; Physics clusters raw spans, because the
    fraction pass has already dissolved the lines a stacked equation was
    split into. The 3.5pt threshold and the dominant-baseline doctrine (a
    raised 6pt superscript must not represent the row it decorates) carry
    over unchanged."""
    records = []
    fractions_log, stacked_log = [], []
    for pageno in range(first, last + 1):
        page = doc[pageno]
        spans = [s for s in page_spans(page) if s["text"].strip()]
        spans = assemble_fractions(spans, fraction_bars(page), pageno, fractions_log)
        spans = assemble_diagonal_fractions(
            spans, diagonal_strokes(page), pageno, fractions_log)
        spans = attach_orphan_scripts(spans, stacked_log, pageno)
        # Cluster spans into visual rows: normal-size spans first (the 3.5pt
        # baseline doctrine), then each small span attaches to the row with
        # the nearest baseline. ⚠ Small spans must never seed a row of their
        # own — a superscript pair rendered above its equation once formed a
        # sizes=[8] row that the footer-furniture rule silently ate, and
        # v² = u² lost both its squares.
        normal = sorted((s for s in spans if round(s["size"]) > 8),
                        key=lambda s: (s["y"], s["x"]))
        small = [s for s in spans if round(s["size"]) <= 8]
        rows = []
        for s in normal:
            if rows and abs(s["y"] - rows[-1]["base"]) <= 3.5:
                rows[-1]["spans"].append(s)
            else:
                rows.append({"base": s["y"], "spans": [s]})
        for s in small:
            if not rows:
                rows.append({"base": s["y"], "spans": [s]})
                continue
            nearest = min(rows, key=lambda r: abs(s["y"] - r["base"]))
            if abs(s["y"] - nearest["base"]) <= 6.5:
                nearest["spans"].append(s)
            else:
                rows.append({"base": s["y"], "spans": [s]})
                rows.sort(key=lambda r: r["base"])
        for row in rows:
            rs = row["spans"]
            text = script_render(rs, f"row p{pageno + 1} y={round(row['base'], 1)}")
            text = unicodedata.normalize("NFC", text).rstrip()
            fonts = sorted({s["font"] for s in rs if s["text"].strip()})
            sizes = sorted({round(s["size"]) for s in rs})
            x = round(min(s["x"] for s in rs), 1)
            records.append(
                {"page": pageno + 1, "x": x, "fonts": fonts, "sizes": sizes, "text": text}
            )
    return records, fractions_log, stacked_log


def is_furniture(rec):
    if not rec["text"].strip():
        return True
    if any("TrebuchetMS" in f for f in rec["fonts"]):
        return True
    if rec["sizes"] == [8]:  # running footer
        return True
    return False


def bold(fonts):
    return any("Bold" in f for f in fonts)


def fully_italic(fonts):
    real = [f for f in fonts if f != FRACTION_FONT]
    return bool(real) and all("Italic" in f for f in real)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default=DEFAULT_PDF)
    args = ap.parse_args()

    with open(args.pdf, "rb") as f:
        pdf_bytes = f.read()
    sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    doc = pymupdf.open(args.pdf)
    cover = doc[0].get_text()
    for needle in ("4PH1", "Issue 4", "International GCSE"):
        if needle not in cover:
            sys.exit(f"REFUSED: cover page does not say {needle!r} — wrong document?")

    # Content page range: from the "3 Physics content" part-opener to the
    # page before the assessment part.
    first = last = None
    for i in range(len(doc)):
        text = doc[i].get_text()
        if first is None and "3 Physics content" in text and i > 5:
            first = i
        elif first is not None and ("Assessment information" in text and i > first + 5):
            last = i - 1
            break
    if first is None or last is None:
        sys.exit("REFUSED: could not locate the Physics content pages")

    # Like 4BI1 (and unlike 4CH1), the content pages carry no images at all —
    # assert it so a future reissue that adds one cannot silently lose content.
    paged_images = {
        i + 1: len([b for b in doc[i].get_text("dict")["blocks"] if b["type"] == 1])
        for i in range(first, last + 1)
    }
    if any(paged_images.values()):
        sys.exit(f"REFUSED: image blocks on content pages {paged_images} — "
                 "text extraction would lose content; investigate first")

    records, fractions_log, stacked_log = line_records(doc, first, last)

    # ── the committed near-source evidence ──────────────────────────────────
    lines_path = os.path.join(HERE, "4ph1-issue4-content-lines.txt")
    with open(lines_path, "w") as f:
        f.write(
            "# Pearson Edexcel International GCSE in Physics (4PH1) — Issue 4\n"
            f"# Content pages {first + 1}-{last + 1}, extracted {os.path.basename(args.pdf)}\n"
            f"# pdf sha256 {sha256}\n"
            "# Rows are POST-equation-assembly: stacked fractions appear inline at\n"
            "# their drawn bar's position, super/subscripts as Unicode. The pinned\n"
            "# PDF is the byte-level source for re-deriving from zero.\n"
        )
        for r in records:
            f.write(
                f"[p={r['page']} x={r['x']} {'|'.join(r['fonts'])} {r['sizes']}] {r['text']}\n"
            )

    # ── parse ───────────────────────────────────────────────────────────────
    sections, topics, points = [], [], []
    context_rows = []
    cur_section = None
    cur_topic = None
    cur_point = None
    cur_context = None
    started = False
    in_preview = False

    def close_point():
        nonlocal cur_point
        if cur_point is not None:
            cur_point["text"] = "\n".join(c.strip() for c in cur_point["chunks"]).strip()
            # The document's own labelling: a practical investigation is a
            # point set in italics and BEGINNING "practical:". Italic alone
            # proves nothing in Physics — variable symbols (the g of field
            # strength) are set in inline Times italic mid-sentence.
            cur_point["practical"] = cur_point["text"].startswith("practical:")
            del cur_point["chunks"]
            points.append(cur_point)
            cur_point = None

    for rec in records:
        if is_furniture(rec):
            continue
        text, fonts = rec["text"].strip(), rec["fonts"]

        if 16 in rec["sizes"] and bold(fonts):
            m = re.match(r"^([1-8])\s+(.+?)\s*$", text)
            if m:
                close_point()
                started, in_preview = True, False
                cur_section = {"number": int(m.group(1)), "name": m.group(2)}
                sections.append(cur_section)
                cur_topic = None
                cur_context = None
                continue
        if not started:
            continue  # part-opener page furniture before "1 Forces and motion"

        if text == "The following sub-topics are covered in this section.":
            in_preview = True
            continue

        sub = SUBSECTION_RE.match(text)
        if sub and bold(fonts):
            close_point()
            in_preview = False
            cur_context = None  # a heading never outlives its sub-topic
            cur_topic = {
                "section": cur_section["number"],
                "sectionName": cur_section["name"],
                "letter": sub.group(1),
                "name": sub.group(2),
                "order": len(topics) + 1,
            }
            topics.append(cur_topic)
            continue
        if in_preview:
            continue  # the section-opener sub-topic list, not content
        if text == "Students should:":
            continue

        code = CODE_RE.match(text)
        if code:
            close_point()
            if cur_topic is None:
                sys.exit(f"REFUSED: statement {text[:20]!r} outside any sub-topic")
            cur_point = {
                "code": f"{code.group(1)}.{code.group(2)}{code.group(3)}",
                "section": int(code.group(1)),
                "number": int(code.group(2)),
                "pOnly": code.group(3) == "P",
                "bold": bold(fonts),
                "practical": False,
                "context": cur_context,
                "topicOrder": cur_topic["order"],
                "order": len(points) + 1,
                "chunks": [code.group(4)] if code.group(4) else [],
            }
            continue

        # Context heading (4BI1 machinery, tightened for Physics): a WHOLE-ROW
        # fully-italic heading at the code column with no digits and no '='.
        # Symbol equation rows (' F = m × a') also start at the code column
        # but always mix upright fonts and carry '='; practical continuation
        # text sits at the description column (x > 80). 4PH1 is expected to
        # have zero of these — the assertion block checks the count.
        if (
            cur_topic is not None
            and fully_italic(fonts)
            and rec["x"] <= CONTEXT_MAX_X
            and len(text) <= CONTEXT_MAX_LEN
            and "=" not in text
            and not any(ch.isdigit() for ch in text)
        ):
            close_point()
            cur_context = text
            context_rows.append(
                {"topicOrder": cur_topic["order"], "name": text, "fonts": fonts}
            )
            continue

        if cur_point is not None:
            chunks = cur_point["chunks"]
            tail = chunks[-1] if chunks else ""
            if text.startswith("•"):
                chunks.append(text)
            elif "=" in text:
                # An equation row (word or symbol form) is its own printed
                # line; gluing it into the prose would corrupt the wording.
                # Math spans carry no space characters, so operator spacing
                # is normalised deterministically here (never in prose).
                chunks.append(spaced_operators(text))
            elif "=" in tail and (tail.split()[-1] in DANGLING_TAIL if tail.split() else False):
                # A wrapped equation ("… × change in" ↵ "temperature") ends
                # mid-phrase; re-join it so one relationship stays one line.
                chunks[-1] = tail + " " + text
            elif chunks and "=" not in tail:
                chunks[-1] = tail + " " + text
            else:
                chunks.append(text)

    close_point()

    # ── assertions: the extraction refuses to look plausible while wrong ────
    problems = []
    if len(sections) != 8:
        problems.append(f"expected 8 sections, found {len(sections)}")
    for p in points:
        if p["bold"] != p["pOnly"]:
            problems.append(f"{p['code']}: bold={p['bold']} but P-suffix={p['pOnly']}")
        if not p["text"]:
            problems.append(f"{p['code']}: empty statement text")
    codes = [p["code"] for p in points]
    if len(set(codes)) != len(codes):
        problems.append("duplicate codes: " + str([c for c in codes if codes.count(c) > 1]))
    for s in sections:
        nums = [p["number"] for p in points if p["section"] == s["number"]]
        if nums != list(range(1, len(nums) + 1)):
            problems.append(f"section {s['number']}: codes not contiguous 1..{len(nums)}")
    order = [p["order"] for p in points]
    if order != sorted(order):
        problems.append("points out of document order")
    # Every assembled fraction must have landed inside some statement's text —
    # an orphaned fraction means the assembly put it on a row the parser then
    # discarded, i.e. lost content.
    all_text = "\n".join(p["text"] for p in points)
    for fr in fractions_log:
        if fr["text"] not in all_text:
            problems.append(f"assembled fraction {fr['text']!r} (p{fr['page']}) "
                            "reached no statement")
    # Context headings: 4PH1 has none; if any matched, they must satisfy the
    # 4BI1 invariants so a future reissue that introduces them is not lost.
    for c in context_rows:
        if not any(
            p["topicOrder"] == c["topicOrder"] and p["context"] == c["name"]
            for p in points
        ):
            problems.append(f"context {c['name']!r} (topic {c['topicOrder']}): scopes no point")
    for p in points:
        if p["context"] is not None and any(p["text"] == c["name"] for c in context_rows):
            problems.append(f"{p['code']}: a context heading leaked into statement text")
    if problems:
        sys.exit("EXTRACTION REFUSED:\n  " + "\n  ".join(problems))

    meta = {
        "document": "Pearson Edexcel International GCSE in Physics (4PH1) — Specification",
        "issue": "Issue 4",
        "publisher": "© Pearson Education Limited 2024",
        "isbn": "978 1 446 93119 6",
        "firstTeaching": "September 2017",
        "firstAssessment": "June 2019",
        "source": "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Physics/2017/specification-and-sample-assessments/international-gcse-physics-2017-specification.pdf",
        "pdfSha256": sha256,
        "contentPages": [first + 1, last + 1],
        "issue4Note": (
            "Pearson serves Issue 4 (September 2024) as the current document; its "
            "own change summary lists only administrative deltas against the "
            "previous issue (series availability pp. 8-9, forbidden combinations "
            "p. 33, command word 'Which' p. 48) — no content-section changes, so "
            "Issue 4 is authoritative for the whole 2019-2025 paper corpus."
        ),
        "paper2OnlyMeaning": (
            "A 'P' code suffix (rendered bold in the document) marks content that "
            "is in the International GCSE in Physics only, not in Science (Double "
            "Award); Paper 1 assesses only non-P content, Paper 2 assesses all "
            "content — so the P suffix in the official code IS the Paper 2-only "
            "marker (spec pp.1, 8-9). Asserted bold ⟺ P for every statement."
        ),
        "equationRendering": (
            "Stacked fractions are re-assembled from their drawn bars into "
            "deterministic inline form — numerator/denominator each "
            "parenthesised iff containing a space or operator; a built "
            "1-over-2 renders as ½; raised/lowered spans become Unicode "
            "super/subscripts (v², λ₀, Vₚ, β⁻, ¹⁴₆C) with a hard refusal on "
            "any unmappable character; word and symbol equation rows stay "
            "separate lines. The academic relationship is never altered; the "
            "document's own quirks (the letter x in 'E = I × V x t', 'total "
            "energy output' in the efficiency denominator) are kept verbatim."
        ),
        "imageAdjacent": [],
        "stackedScripts": sorted({f"{s['page']}:{s['pair']}" for s in stacked_log}),
        "counts": {
            "points": len(points),
            "topics": len(topics),
            "pOnly": sum(1 for p in points if p["pOnly"]),
            "practical": sum(1 for p in points if p["practical"]),
            "contexts": len(context_rows),
            "fractions": len(fractions_log),
            "bySection": {
                str(s["number"]): sum(1 for p in points if p["section"] == s["number"])
                for s in sections
            },
        },
    }
    for p in points:
        del p["bold"]  # asserted ⟺ pOnly above; pOnly is the durable fact

    out = {"meta": meta, "sections": sections, "topics": topics, "points": points}
    json_path = os.path.join(HERE, "4ph1-issue4.json")
    with open(json_path, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(f"content pages {first + 1}-{last + 1} · pdf sha256 {sha256[:16]}…")
    print(f"sections {len(sections)} · sub-topics {len(topics)} · points {len(points)}"
          f" ({meta['counts']['pOnly']} P-only, {meta['counts']['practical']} practical,"
          f" {meta['counts']['fractions']} assembled fractions,"
          f" {meta['counts']['contexts']} context headings)")
    print("by section:", meta["counts"]["bySection"])
    print(f"wrote {lines_path}\nwrote {json_path}")


if __name__ == "__main__":
    main()
