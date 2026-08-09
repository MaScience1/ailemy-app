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

# End-of-question furniture. These lines belong to the PAPER, not to the
# question above them, and a box that swallows them claims the marks tally is
# part of the answer space. 23(c)(ii) ran to the page bottom and took
# "(Total for Question 23 = 21 marks)", "TOTAL FOR SECTION B" and "TOTAL FOR
# PAPER" with it.
END_FURNITURE = re.compile(
    r"^\(?\s*total\s+for\s+(question|section)|^total\s+for\s+paper"
    r"|^use\s+this\s+space\s+for\s+any\s+rough\s+working",
    re.I,
)


def is_answer_rule(line) -> bool:
    """A dotted rule a student writes on.

    Present as TEXT on some pages of this paper — a run of periods — and absent
    entirely on others, where the answer space is simply blank area inside the
    page border. Both are handled: this finds the former, and a question with
    neither falls back to the page bound and keeps the lower confidence that
    says so.
    """
    t = line["t"]
    return len(t) >= 8 and (t.count(".") / len(t)) > 0.8


def vector_rules(page):
    """Wide, near-horizontal drawn strokes — the other way this paper rules a
    page. p12 draws the line under 20(b)(iv) rather than typing dots."""
    out = []
    for path in page.get_drawings():
        r = path["rect"]
        if r.height < 3 and r.width > 200:
            out.append(r.y1)
    return out


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
                "draw": content_rects(p),
            }
        )
    return pages


def content_rects(page):
    """Drawn shapes that are part of the QUESTION, not the template.

    Answer boxes, tables and graph grids are vector rects with no text in them,
    so a column derived from text alone stops short of the answer area. On p12
    the second skeletal-formula box runs to x=541.5 while the widest text line
    ends at 514.2 — the region clipped 27pt off its own answer space. Every
    Edexcel paper draws its answer boxes this way, so this is fixed here rather
    than trimmed by hand per paper.

    Excluded, and each for a reason that recurs on every paper:
      - THE PAGE FRAME. A rect covering most of the page in both directions is
        the printed border. Including it widens every region to the frame and
        swallows the margins.
      - OFF-PAGE FURNITURE. Crop marks and bleed bars sit at negative x or past
        the page width; one of them spans x -30.2..26.5 and would drag every
        box to the left edge.
      - TICKS. Marks under ~20pt in both directions are template furniture, not
        content. Grid lines are kept: they are 0pt in ONE direction but long in
        the other, which is why the test is on the LARGER dimension.
    """
    # THE PRINTED BORDER IS THE FILTER. Edexcel rules a frame around the
    # content on every page, so "outside the frame" is a precise definition of
    # template furniture — better than any size threshold, which is what was
    # tried first and let p2's bleed bars through: 27x4pt at x 0..26.5, big
    # enough to pass a size test and enough to drag Q1 and Q2 to x=0.
    #
    # ⚠ ONE PASS over get_drawings(), because it returns FRESH Rect objects on
    # every call — an identity check against a frame found in an earlier pass
    # never matches, and the frame is then treated as content, which snaps
    # every region on the paper to the border.
    paths = [(p_["rect"], p_) for p_ in page.get_drawings()]

    frame_i, frame = None, None
    for i, (r, _) in enumerate(paths):
        if r.width > page.rect.width * 0.8 and r.height > page.rect.height * 0.8:
            if frame is None or r.width * r.height > frame.width * frame.height:
                frame_i, frame = i, r

    out = []
    for i, (r, _) in enumerate(paths):
        if i == frame_i:
            continue
        if frame is not None:
            # Wholly inside the border, with a hair of tolerance for strokes
            # drawn on the frame itself.
            if r.x0 < frame.x0 - 2 or r.x1 > frame.x1 + 2:
                continue
        elif r.x1 <= 0 or r.x0 >= page.rect.width:
            continue
        # Ticks and register marks. Grid lines are 0pt in ONE direction but
        # long in the other, so the test is on the LARGER dimension.
        if max(r.width, r.height) < 20:
            continue
        out.append((r.x0, r.y0, r.x1, r.y1))
    return out


def content_x_extent(pg, top, bottom, fallback):
    """Left/right edge of everything that lives in this vertical band.

    Computed PER REGION rather than per page, so a wide answer box widens the
    question it belongs to and leaves its neighbours alone.
    """
    x0s, x1s = [], []
    for l in pg["lines"]:
        if not l["horizontal"]:
            continue
        if l["bbox"][3] <= top or l["bbox"][1] >= bottom:
            continue
        x0s.append(l["bbox"][0])
        x1s.append(l["bbox"][2])
    for rx0, ry0, rx1, ry1 in pg["draw"]:
        if ry1 <= top or ry0 >= bottom:
            continue
        x0s.append(max(0.0, rx0))
        x1s.append(min(pg["w"], rx1))
    if not x0s:
        return fallback
    return min(x0s), max(x1s)


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
            # ⚠ A STEMLESS CONTAINER GETS NO REGION, BY DESIGN — not by
            # omission, and it must not be hand-filled later.
            #
            # 21(c) on WCH11/01 is the case: its "(c)" shares a printed line
            # with its child's "(i)", so it owns no page area at all. Every
            # point inside a box drawn for it would also be inside a CHILD,
            # more specifically, so the row could never win a
            # most-specific-match lookup — it would be unreachable by the
            # question a region exists to answer, while being the only row in
            # the table that fully contains other rows.
            #
            # Where a whole-container box IS wanted (question -> highlight,
            # the reverse lookup), it is the union of the children's regions,
            # and unionByPage() in region-geometry.ts computes it on demand.
            # Computed, not stored: re-draw one child and a stored union goes
            # silently stale with nothing to detect it.
            if qn in container:
                unmapped.append(
                    (qn, "stemless container — shares its line with a child, so it owns no "
                         "page area. No region BY DESIGN; use unionByPage() if a whole-"
                         "container box is ever needed.")
                )
            else:
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
                # No sibling below, so the box would run to the page bound and
                # swallow whatever the template prints at the foot of the
                # question. Trim to where the ANSWER SPACE actually ends.
                page_bound = pg["h"] - BOTTOM_MARGIN
                anchor_y = a["line"]["bbox"][3]

                # 1. End-of-question furniture is not part of the answer.
                furniture_top = None
                for l in pg["lines"]:
                    if not l["horizontal"] or l["bbox"][1] <= anchor_y:
                        continue
                    if END_FURNITURE.match(l["t"]):
                        furniture_top = l["bbox"][1]
                        break

                ceiling = min(furniture_top - PAD_BOTTOM, page_bound) if furniture_top else page_bound

                # 2. The last rule the student can write on, above that.
                last_rule = None
                for l in pg["lines"]:
                    if l["horizontal"] and is_answer_rule(l) and anchor_y < l["bbox"][3] <= ceiling:
                        last_rule = max(last_rule or 0, l["bbox"][3])
                for y1 in vector_rules(doc[pg["n"] - 1]):
                    if anchor_y < y1 <= ceiling:
                        last_rule = max(last_rule or 0, y1)

                if last_rule is not None:
                    bottom = min(last_rule + PAD_BOTTOM, ceiling)
                    confidence = 0.8  # ends on a real answer line
                elif furniture_top is not None:
                    bottom = ceiling
                    confidence = 0.8  # ends where the question's content does
                else:
                    # Genuinely blank working space to the page bound — Q20(a)
                    # is a 4-mark calculation with no ruled lines at all. The
                    # position is anchored; the extent is still a guess.
                    bottom = page_bound
                    confidence = 0.72

        x0 = max(0.0, min(x0c, a["line"]["bbox"][0]) - 4.0)
        x1 = min(pg["w"], x1c + 4.0)

        if bottom - top < 8 or x1 - x0 < 8:
            dropped.append((qn, f"degenerate box {x1-x0:.0f}x{bottom-top:.0f}pt"))
            continue

        # Widen to whatever actually occupies this band — text AND drawn
        # answer boxes — then keep the anchor's own left edge so the question
        # label stays inside.
        cx0, cx1 = content_x_extent(pg, top, bottom, (x0c, x1c))
        x0 = max(0.0, min(x0, cx0) - 4.0)
        x1 = min(pg["w"], max(x1, cx1) + 4.0)

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
