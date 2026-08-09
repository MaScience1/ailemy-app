#!/usr/bin/env python3
"""
Propose question_regions for a paper, deterministically, from its text layer.

    python3 scripts/exam-seed/propose-regions.py <paper.pdf> <questions.json> <out.json>

NOT AI. No model, no heuristic about what a question "looks like". Every region
is anchored on text this repository already holds — paper_questions.question_text,
the same string a human transcribed — located in the PDF's own text layer. The
output is a PROPOSAL for review in the admin region mapper, which is why every
region carries a `confidence` and none carries an approval.

============================================================================
THE COORDINATE SPACE, AND WHY NO CONVERSION IS APPLIED
============================================================================
question_regions.bbox_* are in pdf.js getViewport({scale:1}) space: top-left
origin, y DOWNWARD, /Rotate applied.

PyMuPDF's page.rect is ALREADY that space — top-left origin, y downward, and
page.rect reflects /Rotate. This was verified against the live document rather
than assumed:

    PyMuPDF  page1 rect 595.276 x 841.890, rotation 0
    pdf.js   viewport  595      x 842     , /Rotate 0
    "Pearson Edexcel…" y0 = 131.5  ->  16% down the page (it is near the top)

So NO y-flip is applied here, and none must be added. If someone "fixes" this
by writing `pageHeight - y`, every region will be mirrored vertically — a
failure that produces a plausible-looking layout rather than an obvious bug.
The assertion below is what would catch it.

============================================================================
⚠ EVERY REGION IS ASSERTED TO CONTAIN ITS OWN QUESTION'S TEXT
============================================================================
A proposal that is confidently in the wrong place is worse than no proposal:
it looks reviewed. So after computing each box, the text inside that box is
re-extracted from the PDF and checked to contain the question's own anchor
text. A region that fails is DROPPED and reported, never emitted.

That check is what makes a mirrored or off-by-a-column region impossible to
ship silently — a flipped box lands on different text and fails.
"""

import json
import re
import sys

import pymupdf

# Header/footer furniture to keep out of a question's box. The Edexcel template
# puts a barcode and "Turn over" in the bottom band and a rule at the top.
TOP_MARGIN = 45.0
BOTTOM_MARGIN = 60.0
# Padding around the anchored text, in points.
PAD_TOP = 6.0
PAD_BOTTOM = 4.0


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def squash(s: str) -> str:
    """Lowercase alphanumerics only.

    Subscripts defeat a literal match: the fixture holds "C12H26" while the
    text layer emits "C", "12", "H", "26" as separate spans that normalise to
    "C 12 H 26". Comparing only letters and digits makes the two identical
    without loosening the match to the point where it could hit another
    question.
    """
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def load_pages(doc):
    pages = []
    for i in range(doc.page_count):
        p = doc[i]
        lines = []
        for b in p.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                t = norm("".join(s["text"] for s in l["spans"]))
                if t:
                    lines.append({
                        "t": t,
                        "sq": squash(t),
                        "bbox": list(l["bbox"]),
                        # The paragraph this line belongs to. A container's
                        # region is its stem, and the stem is the block.
                        "block": list(b["bbox"]),
                        # (1,0) is horizontal. Edexcel prints "DO NOT WRITE IN
                        # THIS AREA" vertically down both margins as (0,-1);
                        # including it in the column bounds pushed every box
                        # out to x=5.6, swallowing the margin furniture.
                        "horizontal": abs(l.get("dir", (1, 0))[0]) > 0.9,
                    })
        lines.sort(key=lambda l: (round(l["bbox"][1], 1), l["bbox"][0]))
        pages.append(
            {
                "n": i + 1,
                "w": p.rect.width,
                "h": p.rect.height,
                "rot": p.rotation,
                "lines": lines,
            }
        )
    return pages


def find_anchor(pages, question_text):
    """The first line that begins this question, by squashed prefix match.

    Returns (page, line_index) or None. Deliberately fails closed: a question
    whose text cannot be located is reported unmapped rather than guessed at.
    """
    needle = squash(question_text)[:30]
    if len(needle) < 12:
        return None
    for pg in pages:
        for idx, l in enumerate(pg["lines"]):
            if needle in l["sq"]:
                return pg, idx
    return None


def column_bounds(pg):
    """Left and right edges of the body column on this page.

    Taken from the page's own content rather than a constant, so a page with a
    different template still produces a box that covers its text.
    """
    body = [
        l for l in pg["lines"]
        if TOP_MARGIN < l["bbox"][1] < pg["h"] - BOTTOM_MARGIN and l["horizontal"]
    ]
    if not body:
        return 40.0, pg["w"] - 40.0
    return min(l["bbox"][0] for l in body), max(l["bbox"][2] for l in body)


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    pdf_path, questions_path, out_path = sys.argv[1:4]

    doc = pymupdf.open(pdf_path)
    questions = json.load(open(questions_path))
    pages = load_pages(doc)

    # A question that something else names as its parent is a CONTAINER: it
    # holds a stem and no answer space, and its children carry their own
    # regions. Its box is therefore its stem, not "everything until the next
    # seeded question" — which produced a 26pt box for Q20 (a sibling followed
    # on the same page) and a full-page box for Q21 (none did). Same kind of
    # question, wildly different box, decided by an accident of what happens to
    # be seeded.
    container = {q["parent"] for q in questions if q.get("parent")}
    qtext_of = {q["questionNumber"]: (q.get("questionText") or "") for q in questions}

    # Anchor every question first: a question's box ends where the NEXT
    # question starts, so the extents cannot be computed one at a time.
    anchors = {}
    unmapped = []
    for q in questions:
        qn = q["questionNumber"]
        if not norm(q.get("questionText") or ""):
            unmapped.append((qn, "no question_text recorded to anchor on"))
            continue
        hit = find_anchor(pages, q["questionText"])
        if not hit:
            unmapped.append((qn, "question_text not found in the PDF text layer"))
            continue
        pg, idx = hit
        anchors[qn] = {"page": pg, "line": pg["lines"][idx], "order": q["displayOrder"]}

    # Next anchor ON THE SAME PAGE, in display order, bounds the box below.
    ordered = sorted(anchors.items(), key=lambda kv: kv[1]["order"])
    regions, dropped = [], []

    for i, (qn, a) in enumerate(ordered):
        pg = a["page"]
        x0c, x1c = column_bounds(pg)
        top = max(TOP_MARGIN, a["line"]["bbox"][1] - PAD_TOP)

        # The next anchored question that starts on this page, whatever kind
        # it is. Bounds a container's stem from below and a leaf's answer
        # space.
        next_top = None
        for _, b in ordered[i + 1 :]:
            if b["page"]["n"] == pg["n"] and b["line"]["bbox"][1] > a["line"]["bbox"][1]:
                next_top = b["line"]["bbox"][1] - PAD_BOTTOM
                break

        if qn in container:
            # A container is a STEM: prose, no answer space, children carry
            # their own regions. Grow to the smallest box that holds the whole
            # recorded stem, then stop.
            #
            # Text-driven growth is safe HERE and nowhere else. Every stem on
            # this paper is prose; the questions containing tables — Q1,
            # 21(c)(i) — are leaves, and a table's cells extract in an order
            # that never equals the transcribed prose, so growth keyed on text
            # would run to the bottom of the page. Purely geometric grouping
            # was tried and fails the other way: "(a) According to data…" sits
            # close below Q20's stem and is not indented further left, so a
            # paragraph rule swallows the child.
            want = squash(qtext_of[qn])[:150]
            ceiling = min(next_top or (pg["h"] - BOTTOM_MARGIN), pg["h"] - BOTTOM_MARGIN)
            bottom = min(a["line"]["bbox"][3] + PAD_BOTTOM, ceiling)
            confidence = 0.6  # stem not confirmed; the fallback below
            for l in pg["lines"]:
                if not l["horizontal"] or l["bbox"][1] < a["line"]["bbox"][1]:
                    continue
                cand = min(l["bbox"][3] + PAD_BOTTOM, ceiling)
                if cand <= bottom:
                    continue
                probe = pymupdf.Rect(x0c - 4.0, top, x1c + 4.0, cand)
                bottom = cand
                if want in squash(doc[pg["n"] - 1].get_text("text", clip=probe)):
                    confidence = 0.85  # the whole stem, and no more than it
                    break
                if cand >= ceiling:
                    break
        else:
            # A leaf owns its answer space: down to the next question that
            # starts on this page, else the bottom of the printable area.
            if next_top is not None:
                bottom = min(next_top, pg["h"] - BOTTOM_MARGIN)
                confidence = 0.9  # both edges anchored on real text
            else:
                bottom = pg["h"] - BOTTOM_MARGIN
                confidence = 0.72  # bounded by the page, not by a sibling

        x0 = max(0.0, min(x0c, a["line"]["bbox"][0]) - 4.0)
        x1 = min(pg["w"], x1c + 4.0)

        if bottom - top < 8 or x1 - x0 < 8:
            dropped.append((qn, f"degenerate box {x1-x0:.0f}x{bottom-top:.0f}pt"))
            continue

        rect = pymupdf.Rect(x0, top, x1, bottom)

        # ⚠ THE ASSERTION. Re-read the text inside the computed box and require
        # this question's own anchor text to be in it. A mirrored, shifted or
        # mis-columned box lands on different text and is dropped here.
        inside = squash(doc[pg["n"] - 1].get_text("text", clip=rect))
        # A distinctive prefix — the opening line and a little more. Not the
        # full text: a question containing a table extracts its cells in an
        # order that never equals the transcribed prose, and asserting on that
        # rejects perfectly good boxes (it rejected Q1 and 21(c)(i)). Not a
        # handful of characters either, which would assert almost nothing.
        needle = squash(qtext_of[qn])[:60]
        if needle not in inside:
            dropped.append((qn, "computed box does not contain the question's own text"))
            continue

        regions.append(
            {
                "questionNumber": qn,
                "pageNumber": pg["n"],
                "x": round(x0, 2),
                "y": round(top, 2),
                "width": round(x1 - x0, 2),
                "height": round(bottom - top, 2),
                "rotationApplied": pg["rot"] % 360,
                "confidence": confidence,
                # Carried so the TypeScript side can re-validate against the
                # real page box rather than trusting these numbers.
                "pageWidth": round(pg["w"], 2),
                "pageHeight": round(pg["h"], 2),
            }
        )

    json.dump(
        {
            "coordinateSpace": "pdfjs-getViewport-scale-1-top-left-y-down",
            "source": "deterministic text-layer anchoring; PROPOSALS for review",
            "regions": regions,
            "unmapped": [{"questionNumber": q, "reason": r} for q, r in unmapped],
            "dropped": [{"questionNumber": q, "reason": r} for q, r in dropped],
        },
        open(out_path, "w"),
        indent=2,
    )

    print(f"  {len(regions)} of {len(questions)} questions proposed")
    for r in regions:
        print(
            f"    {r['questionNumber']:<12} p{r['pageNumber']:<3} "
            f"{r['x']:6.1f},{r['y']:6.1f}  {r['width']:5.1f}x{r['height']:5.1f}pt  "
            f"conf {r['confidence']}"
        )
    for qn, reason in unmapped + dropped:
        print(f"    {qn:<12} NOT PROPOSED — {reason}")


if __name__ == "__main__":
    main()
