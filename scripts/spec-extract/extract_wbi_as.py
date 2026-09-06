#!/usr/bin/env python3
"""
IAL AS Biology (WBI11/WBI12/WBI13) specification extractor — the one step
between the official Pearson PDF and everything downstream. The IAL sibling of
extract_4ph1.py; the shared machinery is deliberate, the deltas are IAL
Biology's own and each is annotated.

============================================================================
⚠ SOURCE OF TRUTH: the official document, nothing else
============================================================================
Input : Pearson Edexcel International Advanced Level Biology Specification —
        International Advanced Subsidiary in Biology (XBI11), International
        Advanced Level in Biology (YBI11) — Issue 2, February 2021,
        © Pearson Education Limited 2021 (ISBN 978 1 446 94575 9; first
        teaching September 2018, first examination from January 2019). The
        PDF is NOT in the repository; the default path is where it was
        downloaded from qualifications.pearson.com on 2026-09-06. Issue 2's
        own change summary lists exactly one delta against Issue 1 (a
        synoptic-questions sentence for Units 4/5, doc pp. 8-9) — NO AS
        content changes — so Issue 2 is the correct pinned authority for the
        whole 2019-2025 paper corpus. The script refuses any PDF whose cover
        does not carry the IAL Biology identity and whose content footer does
        not say Issue 2, and records the file's sha256 in the output so the
        artefacts stay pinned to one exact document.

Output (both committed, both deterministic for a given PDF):
  wbi-as-issue2-content-lines.txt — every text line of the AS content pages
        with its font names, sizes and position. The near-source evidence:
        the test suite re-derives its expectations from THIS file,
        independently of the JSON, so the parser below cannot quietly vouch
        for itself.
  wbi-as-issue2.json — the canonical extraction: the AS units, their topics,
        and every numbered specification statement with its official code,
        official wording, roman-numeral sub-point structure, practical
        classification and unit assignment.

============================================================================
⚠ AS SCOPE — the extraction STOPS at the Unit 4 opener
============================================================================
The one document covers IAS (Units 1-3) and IA2 (Units 4-6). This branch
seeds AS ONLY (owner decision, Phase 2 approval): the content page range runs
from the "Unit 1:" opener to the page before the "Unit 4:" opener, so no A2
row can even be seen, and every extracted unit must declare itself
"IAS compulsory unit" (the document's own level label) or the extraction
refuses.

============================================================================
⚠ WHAT THE DOCUMENT'S OWN TYPOGRAPHY MEANS (verified span-by-span)
============================================================================
- Unit openers are 16pt bold rows ("Unit 1: Molecules, Diet, Transport and
  Health"); a long title wraps onto a second 16pt row (Unit 2 does).
- Topic headings are 14pt bold rows "Topic N – Name" (en-dash); Topic 4's
  name wraps onto a second 14pt row. Topics 1-2 sit under Unit 1, Topics 3-4
  under Unit 2 — derived from the openers, never assumed.
- A statement's official code ("1.1" … "4.21") is a bold span at the code
  column (x ≈ 68) sharing its baseline with the first body row (one code
  renders at 11pt — 4.7 — so nothing here keys on the code's SIZE).
- Roman-numeral sub-points "(i)"/"(ii)"/… are body rows of the SAME
  numbered statement (owner decision: one canonical spec point per numbered
  Pearson statement; sub-points preserved as lines of the description and as
  structured subPoints metadata, never exploded into separate points).
- CORE PRACTICAL statements occupy their own numbered codes; the heading row
  "CORE PRACTICAL n" and the task rows are set bold at the body column.
  These ARE specification points (practical: true, corePractical: n).
- "RECOMMENDED ADDITIONAL PRACTICAL" boxes are bold rows at the CODE column
  between statements. They carry no code and are NOT specification points
  (owner decision 3: nothing unnumbered is seeded); they are recorded in the
  JSON so the count is reviewable and nothing is silently dropped.
- Fully-italic rows inside a statement are Pearson's own guidance notes
  ("β-glucose and cellulose are not required in this topic.") — part of the
  official statement text, kept as their own line. The β row mixes SymbolMT
  (the β glyph) with Verdana-Italic, so the italic test ignores symbol fonts.
  Mid-sentence italics (defined terms in 2.15/3.17/4.16) stay inline prose.
- Unit 3 ("Practical Skills in Biology I") defines NO numbered statements
  and NO topics — bulleted skills lists only. Nothing is fabricated for it:
  a code-shaped row outside an open topic REFUSES the extraction, and the
  meta records byUnit["3"] = 0.

============================================================================
⚠ EQUATIONS AND SOURCE FIDELITY
============================================================================
AS Biology has exactly two built-up formulae, both stacked fractions over a
drawn bar (4.17 heterozygosity index; 4.18 index of diversity with Σ). The
4PH1 drawn-bar assembly is reused verbatim: numerator/denominator spans are
anchored to the bar's geometry, an empty side REFUSES, and the inline form
parenthesises a side iff it contains a space or operator. There are NO
super/subscripts anywhere in the AS content pages (verified by size scan);
the scripted-glyph refusal machinery stays armed regardless.

The official wording is preserved verbatim, typos included: Issue 2 really
does print "knderstand" in 3.5(ii). The extraction REFUSES if a pinned typo
is no longer found — a corrected document is a different edition and must be
re-reviewed, never silently absorbed (owner decision 4).

Usage:
  python3 scripts/spec-extract/extract_wbi_as.py \\
      [--pdf ~/Desktop/international-a-level-biology-spec.pdf]
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
DEFAULT_PDF = os.path.expanduser("~/Desktop/international-a-level-biology-spec.pdf")

# Super/subscript tables (4PH1's). AS Biology is expected to use none, but a
# scripted character OUTSIDE these tables still aborts the extraction — nothing
# silently falls back to a baseline glyph that would read as ordinary text.
SUPER = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶",
         "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "–": "⁻", "−": "⁻",
         "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ"}
SUB = {"0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆",
       "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "–": "₋", "−": "₋",
       "(": "₍", ")": "₎", "p": "ₚ", "s": "ₛ", "e": "ₑ", "t": "ₜ"}

# AS content topics are 1-4; codes are T.S with no letter suffix (IAL has no
# Double-Award analogue of 4PH1's P / 4BI1's B / 4CH1's C).
CODE_RE = re.compile(r"^([1-4])\.(\d{1,2})\b\s*(.*)$")
UNIT_RE = re.compile(r"^Unit ([1-6]):\s*(.*)$")
TOPIC_RE = re.compile(r"^Topic ([1-9]) – (.+?)\s*$")  # en-dash, the document's own
SUBPOINT_RE = re.compile(r"^\((i|ii|iii|iv|v|vi)\)\s")
CP_RE = re.compile(r"^CORE PRACTICAL (\d+)$")
RAP_HEADING = "RECOMMENDED ADDITIONAL PRACTICAL"
CANDIDATES_ROW = "Candidates will be assessed on their ability to:"
CODE_COLUMN_MAX_X = 80.0  # codes and RAP boxes sit at x ≈ 68; body at ≈ 110

# The pinned source typos (owner decision 4): preserved verbatim in the
# canonical wording, recorded in meta, and REQUIRED to be present — a document
# where one is missing is a different edition.
PINNED_TYPOS = [
    {"code": "3.5", "subPoint": "ii", "token": "knderstand",
     "note": "Issue 2 prints 'knderstand' for 'understand' in 3.5(ii); "
             "preserved verbatim (source fidelity over editorial correction)."},
]

# Fraction-bar geometry (4PH1's): a fraction bar is a short horizontal
# segment indented into the text column; table rules start further left.
BAR_MIN_W, BAR_MAX_W, BAR_MIN_X = 3.0, 300.0, 80.0
FRACTION_FONT = "(assembled-fraction)"
SYMBOL_FONTS = ("SymbolMT",)  # carries β/Σ/parens; neither bold nor italic


def dominant_size(spans):
    """The row's text size, weighted by stripped text length; ties break to
    the LARGER size (4PH1's doctrine — scripts are the minority smaller spans)."""
    weight = {}
    for s in spans:
        weight[round(s["size"])] = weight.get(round(s["size"]), 0) + len(s["text"].strip())
    best = max(weight.values())
    return max(size for size, w in weight.items() if w == best)


def script_render(spans, where, gap=0.8):
    """Spans (x-sorted) → text, super/subscripts as Unicode, gap-spaced.
    ⚠ REFUSES on any scripted character with no table entry.

    `gap` is the horizontal distance that renders as one space. Prose keeps
    4PH1's 0.8pt; INSIDE an assembled fraction it is 1.0pt, because the
    document kerns the parentheses of 4.18's built formula 0.83pt from their
    neighbours while printing them tight ("Σn(n-1)", doc p.24) — measured
    span-by-span, and the only 0.8-1.0pt gap in the whole AS content."""
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
        table = None
        if round(s["size"]) < dom - 1.5 and t.strip():
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
        if prev is not None and not scripted \
                and s["x"] - prev["x1"] > gap \
                and not prev["text"].endswith(" ") and not t.startswith(" "):
            text += " "
        text += t
        prev = s
    return text


def spaced_operators(s):
    """Deterministic operator spacing for assembled math: exactly one space
    around ×, ÷, the true minus and '=' — math spans carry no space chars, so
    spacing there is geometric rendering, not rewording. Never applied to prose."""
    s = re.sub(r"\s*([×÷−=])\s*", r" \1 ", s)
    return re.sub(r"\s{2,}", " ", s).strip()


def fraction_bars(page):
    """Drawn fraction bars: short horizontal strokes/thin rects indented into
    the text column (the two AS Biology formulae both use one)."""
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
                    # Known normalisation: U+00A0 → space. The document sets
                    # exactly three spans with non-breaking spaces (4.17's
                    # built formula); NBSP is typography, not wording, and
                    # would defeat the space-aware fraction parenthesisation.
                    "text": s["text"].replace("\xa0", " "),
                    "x": s["origin"][0], "y": s["origin"][1],
                    "x1": s["bbox"][2], "size": s["size"], "font": s["font"],
                })
    return spans


def assemble_fractions(spans, bars, pageno, fractions_log):
    """Replace each drawn bar's numerator/denominator spans with one inline
    fraction span sitting on the equation's own baseline (4PH1's algorithm)."""
    # ⚠ Membership is by span CENTRE, not edge (a Biology delta from 4PH1):
    # 4.17's left-hand side ("heterozygosity index = ") ends 0.0pt from the
    # bar's x-start, so an edge-overlap test swallowed the equation's LHS
    # into the denominator. A span belongs to the fraction iff its horizontal
    # centre sits over the bar; the LHS's centre is 60pt to the left.
    def over_bar(s, bx0, bx1):
        centre = (s["x"] + s["x1"]) / 2
        return bx0 - 1 < centre < bx1 + 1

    for (by, bx0, bx1) in bars:
        num = [s for s in spans if by - 20 < s["y"] < by
               and over_bar(s, bx0, bx1) and s["text"].strip()]
        den = [s for s in spans if by < s["y"] < by + 20
               and over_bar(s, bx0, bx1) and s["text"].strip()]
        if not num or not den:
            sys.exit(f"EXTRACTION REFUSED: fraction bar p{pageno + 1} y={by} "
                     f"x={bx0}-{bx1} has empty numerator or denominator — "
                     f"geometry drifted; investigate before trusting any formula")
        where = f"fraction p{pageno + 1} y={by}"
        ntext = spaced_operators(script_render(num, where, gap=1.0))
        dtext = spaced_operators(script_render(den, where, gap=1.0))
        text = f"{parenthesise(ntext)}/{parenthesise(dtext)}"
        mid = [s for s in spans if abs(s["y"] - (by + 3)) < 4 and s["text"].strip()
               and not over_bar(s, bx0, bx1) and s not in num and s not in den]
        y = min((s["y"] for s in mid), default=by + 3.0)
        size = max((s["size"] for s in mid), default=10.0)
        for s in num + den:
            spans.remove(s)
        spans.append({"text": text, "x": bx0, "y": y, "x1": bx1,
                      "size": size, "font": FRACTION_FONT})
        fractions_log.append({"page": pageno + 1, "text": text})
    return spans


def line_records(doc, first, last):
    """Rows of pages [first, last] in reading order: spans → fraction assembly
    → baseline clustering → rendering (4PH1's span-level clustering, kept so
    the code column and its first body row form ONE row)."""
    records = []
    fractions_log = []
    for pageno in range(first, last + 1):
        page = doc[pageno]
        # ⚠ The running footer (8pt, y≈803-813) and the 10pt page number
        # (y≈803-805) share a baseline, so clustered together they form a
        # mixed-size row that no size-only furniture rule can catch — and a
        # statement left open across a page boundary would swallow it (found
        # by the independent pdfplumber reparse: '… platelet inhibitors) 16
        # Pearson Edexcel …'). Content ends at y≈773 on every AS page; the
        # footer band is dropped before clustering.
        FOOTER_Y = 790.0
        spans = [s for s in page_spans(page) if s["text"].strip() and s["y"] < FOOTER_Y]
        spans = assemble_fractions(spans, fraction_bars(page), pageno, fractions_log)
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
    return records, fractions_log


def is_furniture(rec):
    if not rec["text"].strip():
        return True
    if rec["sizes"] == [8]:  # running footer (Pearson/Issue 2 lines)
        return True
    # Bare page numbers sit at the outer margins in body size; a statement row
    # can never be digit-only (asserted again over the parsed output below).
    if re.fullmatch(r"\d{1,3}", rec["text"].strip()) and (
            rec["x"] < 70.0 or rec["x"] > 500.0):
        return True
    return False


def bold(fonts):
    return any("Bold" in f for f in fonts)


def fully_italic(fonts):
    """All non-symbol, non-fraction fonts italic — the β note row mixes
    SymbolMT (the β glyph, neither bold nor italic) with Verdana-Italic."""
    real = [f for f in fonts if f != FRACTION_FONT and f not in SYMBOL_FONTS]
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
    for needle in ("INTERNATIONAL ADVANCED LEVEL", "BIOLOGY", "XBI11", "YBI11"):
        if needle not in cover:
            sys.exit(f"REFUSED: cover page does not say {needle!r} — wrong document?")
    if "ISBN 978 1 446 94575 9" not in doc[1].get_text():
        sys.exit("REFUSED: page 2 does not carry the pinned Issue 2 ISBN — wrong edition?")

    # AS content page range: the 16pt "Unit 1:" opener through the page before
    # the 16pt "Unit 4:" opener (the IAS/IA2 boundary; nothing A2 is ever read).
    def unit_opener_pages():
        found = {}
        for i in range(len(doc)):
            for block in doc[i].get_text("dict")["blocks"]:
                if block["type"] != 0:
                    continue
                for line in block.get("lines", []):
                    for s in line["spans"]:
                        if round(s["size"]) == 16 and "Bold" in s["font"]:
                            m = UNIT_RE.match(s["text"].strip())
                            if m and int(m.group(1)) not in found:
                                found[int(m.group(1))] = i
        return found

    openers = unit_opener_pages()
    for n in (1, 2, 3, 4):
        if n not in openers:
            sys.exit(f"REFUSED: could not locate the 16pt 'Unit {n}:' opener")
    first, last = openers[1], openers[4] - 1
    if not (openers[1] < openers[2] < openers[3] < openers[4]):
        sys.exit("REFUSED: unit openers out of order — document structure drifted")

    # The content pages carry no images at all — assert it so a future reissue
    # that adds one cannot silently lose content (4BI1/4PH1's guard).
    paged_images = {
        i + 1: len([b for b in doc[i].get_text("dict")["blocks"] if b["type"] == 1])
        for i in range(first, last + 1)
    }
    if any(paged_images.values()):
        sys.exit(f"REFUSED: image blocks on content pages {paged_images} — "
                 "text extraction would lose content; investigate first")
    footer_probe = doc[first].get_text()
    if "Specification – Issue 2 – February 2021" not in footer_probe:
        sys.exit("REFUSED: content footer does not say Issue 2 February 2021 — wrong edition?")

    records, fractions_log = line_records(doc, first, last)

    # ── the committed near-source evidence ──────────────────────────────────
    lines_path = os.path.join(HERE, "wbi-as-issue2-content-lines.txt")
    with open(lines_path, "w") as f:
        f.write(
            "# Pearson Edexcel International Advanced Level Biology (XBI11/YBI11) — Issue 2\n"
            f"# AS content pages {first + 1}-{last + 1} (Unit 1 opener .. page before Unit 4 opener),\n"
            f"# extracted {os.path.basename(args.pdf)}\n"
            f"# pdf sha256 {sha256}\n"
            "# Rows are POST-fraction-assembly: the two stacked formulae (4.17, 4.18)\n"
            "# appear inline at their drawn bar's position. The pinned PDF is the\n"
            "# byte-level source for re-deriving from zero.\n"
        )
        for r in records:
            f.write(
                f"[p={r['page']} x={r['x']} {'|'.join(r['fonts'])} {r['sizes']}] {r['text']}\n"
            )

    # ── parse ───────────────────────────────────────────────────────────────
    units, topics, points, raps, notes = [], [], [], [], []
    cur_unit = None
    cur_topic = None
    cur_point = None
    pending = None  # "unit-title" | "topic-title"
    in_rap = False

    def close_point():
        nonlocal cur_point
        if cur_point is None:
            return
        chunks = cur_point.pop("chunks")
        cur_point["text"] = "\n".join(c[1].strip() for c in chunks).strip()
        subs = [SUBPOINT_RE.match(c[1]).group(1) for c in chunks if c[0] == "sub"]
        cur_point["subPoints"] = subs
        cp = next((c for c in chunks if c[0] == "cp-heading"), None)
        cur_point["practical"] = cp is not None
        cur_point["corePractical"] = int(CP_RE.match(cp[1]).group(1)) if cp else None
        for c in chunks:
            if c[0] == "note":
                notes.append({"code": cur_point["code"], "text": c[1].strip()})
        points.append(cur_point)
        cur_point = None

    for rec in records:
        if is_furniture(rec):
            continue
        text, fonts = rec["text"].strip(), rec["fonts"]

        if 16 in rec["sizes"] and bold(fonts):
            m = UNIT_RE.match(text)
            if m:
                close_point()
                cur_unit = {"number": int(m.group(1)), "title": text, "level": None}
                units.append(cur_unit)
                cur_topic = None
                in_rap = False
                pending = "unit-title"
                continue
            if pending == "unit-title":
                cur_unit["title"] += " " + text
                continue
        pending = None if pending == "unit-title" else pending

        if 14 in rec["sizes"] and bold(fonts):
            m = TOPIC_RE.match(text)
            if m:
                if cur_unit is None:
                    sys.exit(f"REFUSED: topic heading {text!r} before any unit opener")
                close_point()
                in_rap = False
                cur_topic = {"number": int(m.group(1)), "unit": cur_unit["number"],
                             "name": m.group(2), "order": len(topics) + 1}
                topics.append(cur_topic)
                pending = "topic-title"
                continue
            if pending == "topic-title":
                cur_topic["name"] += " " + text
                continue
            # Other 14pt headings are unit furniture (IAS compulsory unit,
            # Unit description, Assessment information, Planning, …): they end
            # any open topic table.
            if text in ("IAS compulsory unit", "IA2 compulsory unit") and cur_unit:
                cur_unit["level"] = text
            close_point()
            cur_topic = None
            in_rap = False
            continue
        pending = None

        if text == CANDIDATES_ROW:
            continue
        if cur_unit is None:
            continue  # pre-opener furniture (none expected: the range starts at Unit 1)

        if text == RAP_HEADING and bold(fonts) and rec["x"] <= CODE_COLUMN_MAX_X:
            close_point()
            in_rap = True
            raps.append({
                "unit": cur_unit["number"],
                "topic": cur_topic["number"] if cur_topic else None,
                "afterCode": points[-1]["code"] if points else None,
                "text": "",
            })
            continue
        if in_rap and bold(fonts) and rec["x"] <= CODE_COLUMN_MAX_X \
                and not CODE_RE.match(text):
            raps[-1]["text"] = (raps[-1]["text"] + " " + text).strip()
            continue

        code = CODE_RE.match(text)
        if code and rec["x"] <= CODE_COLUMN_MAX_X:
            if cur_topic is None:
                sys.exit(f"REFUSED: statement {text[:24]!r} outside any topic "
                         "(a numbered row under Unit 3 would mean fabricated "
                         "practical syllabus content — investigate)")
            close_point()
            in_rap = False
            rest = code.group(3)
            chunks = []
            if rest:
                if CP_RE.match(rest):
                    chunks.append(("cp-heading", rest))
                elif SUBPOINT_RE.match(rest):
                    chunks.append(("sub", rest))
                else:
                    chunks.append(("stem", rest))
            cur_point = {
                "code": f"{code.group(1)}.{code.group(2)}",
                "topic": cur_topic["number"],
                "unit": cur_topic["unit"],
                "number": int(code.group(2)),
                "order": len(points) + 1,
                "chunks": chunks,
            }
            continue

        if cur_point is not None:
            chunks = cur_point["chunks"]
            tail = chunks[-1] if chunks else None
            if SUBPOINT_RE.match(text):
                chunks.append(("sub", text))
            elif fully_italic(fonts):
                # Pearson's own guidance note — its own line of the official
                # wording; a wrapped note joins its previous note row.
                if tail and tail[0] == "note":
                    chunks[-1] = ("note", tail[1] + " " + text)
                else:
                    chunks.append(("note", text))
            elif "=" in text:
                # A formula row (4.17/4.18) is its own printed line; operator
                # spacing normalised deterministically here (never in prose).
                chunks.append(("equation", spaced_operators(text)))
            elif tail is None:
                chunks.append(("stem", text))
            elif tail[0] in ("cp-heading", "equation", "note"):
                # Prose never wraps INTO a heading, formula or note line.
                chunks.append(("stem", text))
            else:
                chunks[-1] = (tail[0], tail[1] + " " + text)
            continue

        if cur_topic is not None:
            sys.exit(f"REFUSED: unclaimed row inside Topic {cur_topic['number']}: "
                     f"{text[:60]!r} — content would be lost silently")
        # Rows outside any topic (unit descriptions, assessment bullets,
        # Unit 3 skills lists) are intentionally not specification content.

    close_point()

    # ── assertions: the extraction refuses to look plausible while wrong ────
    problems = []
    if [u["number"] for u in units] != [1, 2, 3]:
        problems.append(f"expected AS units 1,2,3 — found {[u['number'] for u in units]}")
    for u in units:
        if u["level"] != "IAS compulsory unit":
            problems.append(f"unit {u['number']}: level {u['level']!r}, expected "
                            "'IAS compulsory unit' (A2 contamination guard)")
    if [t["number"] for t in topics] != [1, 2, 3, 4]:
        problems.append(f"expected topics 1-4 — found {[t['number'] for t in topics]}")
    for t in topics:
        if t["unit"] not in (1, 2):
            problems.append(f"topic {t['number']} landed on unit {t['unit']} — "
                            "only Units 1 and 2 carry topics")
    unit3_points = [p for p in points if p["unit"] == 3]
    if unit3_points:
        problems.append(f"unit 3 acquired {len(unit3_points)} points — it defines none")
    for p in points:
        if not p["text"]:
            problems.append(f"{p['code']}: empty statement text")
        if int(p["code"].split(".")[0]) != p["topic"]:
            problems.append(f"{p['code']}: code prefix does not match Topic {p['topic']}")
    codes = [p["code"] for p in points]
    if len(set(codes)) != len(codes):
        problems.append("duplicate codes: " + str(sorted({c for c in codes if codes.count(c) > 1})))
    for t in topics:
        nums = [p["number"] for p in points if p["topic"] == t["number"]]
        if nums != list(range(1, len(nums) + 1)):
            problems.append(f"topic {t['number']}: codes not contiguous 1..{len(nums)}")
    order = [p["order"] for p in points]
    if order != sorted(order):
        problems.append("points out of document order")
    ROMAN = ["i", "ii", "iii", "iv", "v", "vi"]
    for p in points:
        subs = p["subPoints"]
        if subs and subs != ROMAN[: len(subs)]:
            problems.append(f"{p['code']}: sub-points {subs} not contiguous from (i)")
        if len(subs) == 1:
            problems.append(f"{p['code']}: a lone (i) with no (ii) — mis-split statement?")
    cps = [p["corePractical"] for p in points if p["practical"]]
    if cps != list(range(1, len(cps) + 1)):
        problems.append(f"core practicals not contiguous from 1: {cps}")
    for r in raps:
        if not r["text"]:
            problems.append("a RECOMMENDED ADDITIONAL PRACTICAL box with no task text")
    all_text = "\n".join(p["text"] for p in points)
    for fr in fractions_log:
        if fr["text"] not in all_text:
            problems.append(f"assembled fraction {fr['text']!r} (p{fr['page']}) "
                            "reached no statement")
    for p in points:
        for line in p["text"].split("\n"):
            if not line.strip() or re.fullmatch(r"[\d\s.]+", line):
                problems.append(f"{p['code']}: empty or digit-only line in statement")
    for typo in PINNED_TYPOS:
        target = next((p for p in points if p["code"] == typo["code"]), None)
        if target is None or typo["token"] not in target["text"]:
            problems.append(f"pinned source typo {typo['token']!r} not found in "
                            f"{typo['code']} — different edition? Review before proceeding")
    # The two known Greek-bearing renderings must have survived extraction.
    p42 = {p["code"]: p["text"] for p in points}
    if "β-glucose" not in (p42.get("1.2", "") + p42.get("4.3", "")):
        problems.append("β-glucose lost from 1.2/4.3 — Greek glyph handling drifted")
    if "Σn" not in p42.get("4.18", ""):
        problems.append("Σ lost from 4.18 — the index-of-diversity formula drifted")
    if problems:
        sys.exit("EXTRACTION REFUSED:\n  " + "\n  ".join(problems))

    by_unit = {str(u["number"]): sum(1 for p in points if p["unit"] == u["number"])
               for u in units}
    by_topic = {str(t["number"]): sum(1 for p in points if p["topic"] == t["number"])
                for t in topics}
    meta = {
        "document": "Pearson Edexcel International Advanced Level Biology — Specification",
        "qualification": {"ias": "XBI11", "ial": "YBI11"},
        "issue": "Issue 2",
        "published": "February 2021",
        "publisher": "© Pearson Education Limited 2021",
        "isbn": "978 1 446 94575 9",
        "firstTeaching": "September 2018",
        "firstAssessment": "January 2019",
        "source": "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Biology/2018/Specification-and-Sample-Assessment/International-A-Level-Biology-Spec.pdf",
        "pdfSha256": sha256,
        "contentPages": [first + 1, last + 1],
        "issue2Note": (
            "Issue 2 (February 2021) is the document Pearson serves for the 2018 "
            "qualification; its own change summary lists exactly one delta against "
            "Issue 1 — a synoptic-questions sentence for Units 4/5 — with NO AS "
            "content changes, so Issue 2 is authoritative for the whole 2019-2025 "
            "WBI11-13 paper corpus."
        ),
        "asScope": (
            "IAS = Units 1-3 (WBI11/01, WBI12/01, WBI13/01), content Topics 1-4. "
            "The extraction runs from the Unit 1 opener to the page before the "
            "Unit 4 opener, so IA2 content (Units 4-6, Topics 5-8) is never read; "
            "every extracted unit must declare 'IAS compulsory unit'."
        ),
        "unit3": (
            "Unit 3 (Practical Skills in Biology I) is a real assessed AS unit but "
            "defines NO numbered specification statements and NO topics — bulleted "
            "practical-skills lists only, assessing the practicals of Units 1-2. "
            "Nothing is fabricated for it (owner decision 3): byUnit['3'] is 0 and "
            "a code-shaped row under Unit 3 refuses the extraction."
        ),
        "subPointPolicy": (
            "One canonical specification point per officially numbered Pearson "
            "statement (owner decision 2). Roman-numeral sub-points (i)/(ii)/… are "
            "preserved as their own lines of the official wording AND as structured "
            "subPoints metadata; they are never exploded into separate points."
        ),
        "recommendedAdditionalPracticalPolicy": (
            "The document's boxed RECOMMENDED ADDITIONAL PRACTICAL items carry no "
            "specification code and are NOT seeded as points; they are recorded in "
            "recommendedPracticals so the review can see nothing was silently lost."
        ),
        "equationRendering": (
            "AS Biology's two built-up formulae (4.17 heterozygosity index, 4.18 "
            "index of diversity) are stacked fractions over a drawn bar, "
            "re-assembled into deterministic inline form — numerator/denominator "
            "each parenthesised iff containing a space or operator — with a hard "
            "refusal on an empty fraction side or any scripted glyph without a "
            "Unicode form. Fraction membership is decided by span centre (4.17's "
            "left-hand side ends exactly at the bar's x-start and must stay "
            "outside the fraction). Known normalisations: the three U+00A0 "
            "non-breaking spaces of 4.17's formula render as ordinary spaces, and "
            "the sub-1pt kerning around 4.18's parentheses renders tight "
            "(Σn(n-1)), as printed. There are no super/subscripts in the AS "
            "content pages. Greek letters (β, Σ) are preserved as Unicode; 4.18's "
            "N-1 keeps the document's own hyphen. The academic relationship is "
            "never altered."
        ),
        "notesMeaning": (
            "Fully-italic rows inside a statement are Pearson's own guidance notes "
            "(exclusions such as 'β-glucose and cellulose are not required in this "
            "topic.'); they are part of the official statement wording, kept as "
            "their own line, and indexed in notes[]."
        ),
        "sourceTypos": PINNED_TYPOS,
        "counts": {
            "points": len(points),
            "topics": len(topics),
            "units": len(units),
            "practical": sum(1 for p in points if p["practical"]),
            "subPointed": sum(1 for p in points if p["subPoints"]),
            "subPoints": sum(len(p["subPoints"]) for p in points),
            "notes": len(notes),
            "recommendedPracticals": len(raps),
            "fractions": len(fractions_log),
            "byUnit": by_unit,
            "byTopic": by_topic,
        },
    }

    out = {
        "meta": meta,
        "units": units,
        "topics": topics,
        "points": points,
        "recommendedPracticals": raps,
        "notes": notes,
    }
    json_path = os.path.join(HERE, "wbi-as-issue2.json")
    with open(json_path, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(f"AS content pages {first + 1}-{last + 1} · pdf sha256 {sha256[:16]}…")
    print(f"units {len(units)} · topics {len(topics)} · points {len(points)}"
          f" ({meta['counts']['practical']} core practicals,"
          f" {meta['counts']['subPointed']} statements with {meta['counts']['subPoints']} roman sub-points,"
          f" {meta['counts']['notes']} italic notes,"
          f" {meta['counts']['recommendedPracticals']} recommended-practical boxes,"
          f" {meta['counts']['fractions']} assembled fractions)")
    print("by unit:", by_unit, "· by topic:", by_topic)
    print(f"wrote {lines_path}\nwrote {json_path}")


if __name__ == "__main__":
    main()
