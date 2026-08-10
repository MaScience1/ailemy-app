#!/usr/bin/env python3
"""
Deterministic mark-scheme extractor — PROPOSALS ONLY, NOTHING PUBLISHED.

    python3 scripts/exam-seed/extract-markscheme.py <markscheme.pdf> <out.json>

============================================================================
WHAT THIS IS FOR
============================================================================
Hand-transcribing a mark scheme is six to eight hours a paper, and it is the
step everything else waits on. This turns that into a review pass: it reads the
ruled table the examiner published and proposes, per question, the mark
allocation, the marking points, and every Accept / Do-not-award / Ignore line —
each carrying the SOURCE LINE it came from and a confidence recording HOW it
was derived, so a reviewer checks a claim against its evidence rather than
re-reading the PDF.

Same architecture as propose-regions.py: deterministic, no model, nothing
written to a database, and every proposal traceable to the page and y it was
read from.

============================================================================
⚠ IT MUST NOT INTERPRET, AND MOST OF THIS FILE IS THAT RULE
============================================================================
"Correct answer with some working scores 3" either does or does not condition
those marks on working being captured. "Ignore SF except 1 SF" either is or is
not enforceable when no working is captured. Those are EXAMINER RULINGS. They
belong to a human, they change what students score, and a plausible guess here
is worse than no extraction at all — it would arrive wearing the authority of
the printed scheme.

So a line whose meaning is conditional, negated, or mixed is NOT filed under
accept or reject. It is extracted verbatim, flagged `requiresRuling` with the
reason it was flagged, and left alone.

============================================================================
⚠ POLARITY IS THE TRAP, AND IT HAS ALREADY BITTEN ONCE
============================================================================
The equation marker scraped species out of accept[] with no regard for the
polarity of the sentence around them, so "Do not accept C12H26(g)" ADDED gas to
dodecane's allowed states — full marks for the exact error the examiner's
report says candidates lost the mark for. That was one layer downstream of
here, on data this extractor would have produced.

Every inverting construction is therefore tested for EXPLICITLY, and a line
carrying one is escalated rather than classified:

    Do not award / Do not accept / Reject / Not     outright negation
    unless / except / only if / provided (that)     conditional
    but no / but not                                mid-sentence inversion

"Ignore X" is NOT a negation: Edexcel uses it to mean "award despite X", which
is a permission, and the fixture header records that mapping. But "Ignore SF
except 1 SF" carries `except`, so it is escalated rather than filed.

The classifier reads the LEADING keyword. Any inverting token ANYWHERE in the
line overrides it. A line that is both is never quietly filed under one.
"""

import json
import re
import sys
from collections import Counter

import pymupdf

# ============================================================================
# GEOMETRY — read from the ruled table, not guessed
# ============================================================================
# The mark scheme is landscape (841.68 x 595.44) and every page is a ruled
# table. Column x-positions are taken from the vertical rules themselves rather
# than hardcoded, because a 3-column Section A page and a 4-column Section B
# page have genuinely different geometry and guessing would silently file
# guidance text as answer text.

MIN_RULE_HEIGHT = 40.0
MAX_RULE_WIDTH = 3.0
LINE_TOLERANCE = 4.0


def vertical_rules(page):
    xs = Counter()
    for drawing in page.get_drawings():
        r = drawing["rect"]
        if r.height > MIN_RULE_HEIGHT and r.width < MAX_RULE_WIDTH and 0 <= r.x0 <= page.rect.width:
            xs[round((r.x0 + r.x1) / 2)] += 1
    # Only rules that span most of the table matter; stray cell borders do not.
    strong = [x for x, n in xs.items() if n >= 1]
    return sorted(strong)


def cluster(xs, gap=15):
    """Group rules that are the edges of one drawn line. Returns the groups."""
    out = []
    for x in sorted(xs):
        if out and x - out[-1][-1] <= gap:
            out[-1].append(x)
        else:
            out.append([x])
    return out


def column_bounds(page):
    """
    Left edges of (question number, answer, guidance, mark); guidance absent on
    Section A.

    ⚠ DERIVED FROM THE RULES, NOT FROM FIXED WINDOWS. The first version looked
    for a left edge between x=40 and x=60 — true of every Section B page and of
    none of Section A, whose table is indented and starts at x=72. Eleven pages
    reported "no table rules found", including the two Section A questions in
    the self-check set, and the run looked like a success because the count it
    printed was of the pages it HAD read.
    """
    groups = cluster(vertical_rules(page))
    if len(groups) < 4:
        return None
    q0, q1 = min(groups[0]), min(groups[1])
    mark0, right = min(groups[-2]), max(groups[-1])
    if not (q0 < q1 < mark0 < right):
        return None
    # Anything strictly between the answer column and the mark column divides
    # Answer from Additional Guidance. Section A has none.
    #
    # ⚠ THE LEFT EDGE OF THAT GROUP, NOT ITS CENTRE. The divider is drawn as
    # three rules (453 / 463 / 476); averaging them put the boundary at 464,
    # and the guidance cell's first character — the `n` of "n = 101000 …" —
    # sits at 461. It was filed as answer text and appended to two marking
    # criteria, so 20(a) M3 read "…and rearrangement n". The answer cell ends
    # where its border is drawn.
    guidance = min(groups[2]) if len(groups) > 4 else None
    return {"q0": q0, "q1": q1, "guidance": guidance, "mark0": mark0, "right": right}


def words_in(page, x0, x1):
    """Words whose centre falls in [x0, x1), grouped into visual lines by y."""
    lines = {}
    for wx0, wy0, wx1, wy1, text, *_ in page.get_text("words"):
        cx = (wx0 + wx1) / 2
        if not (x0 <= cx < x1):
            continue
        key = None
        for y in lines:
            if abs(y - wy0) <= LINE_TOLERANCE:
                key = y
                break
        if key is None:
            key = wy0
            lines[key] = []
        lines[key].append((wx0, text))
    return {y: sorted(ws) for y, ws in sorted(lines.items())}


def joined(line):
    return " ".join(t for _, t in line).strip()


# ============================================================================
# POLARITY — the whole reason this file is careful
# ============================================================================

NEGATION = re.compile(
    r"\b(do\s*not|don't|dont|never|reject|no\s+credit|not\s+acceptable)\b", re.I
)
CONDITIONAL = re.compile(r"\b(unless|except|only\s+if|provided(\s+that)?|if\s+and\s+only)\b", re.I)
MID_INVERSION = re.compile(r"\b(but\s+n(o|ot)|however\s+n(o|ot))\b", re.I)

ACCEPT_LEAD = re.compile(r"^\s*(accept|allow)\b", re.I)
IGNORE_LEAD = re.compile(r"^\s*ignore\b", re.I)
REJECT_LEAD = re.compile(r"^\s*(do\s*not\s*(award|accept|allow|credit)|reject)\b", re.I)

# Sentences that make a mark depend on something this app may or may not be
# able to test. Every one is an examiner ruling.
RULING_PATTERNS = [
    (re.compile(r"correct answer with .* scores?\b", re.I), "conditions the whole tariff on working"),
    (re.compile(r"\bwith (no|some) working\b", re.I), "conditions marks on working"),
    (re.compile(r"\bTE\b"), "transferred-error rule — scope must be decided"),
    (re.compile(r"\bSF\b|significant figures?", re.I), "significant-figure rule — enforceability must be decided"),
    (re.compile(r"\bmust be\b", re.I), "states a requirement that may or may not be testable"),
]


def classify(text):
    """
    ('accept' | 'reject' | 'guidance' | None, confidence, [reasons to escalate])

    ⚠ INVERSION ANYWHERE OVERRIDES THE LEADING KEYWORD. "Allow multiples" is a
    permission; "Do not allow multiples" contains that permission as a
    substring and is the opposite. Leading-keyword-only classification is
    exactly how a prohibition became a permission downstream.
    """
    escalate = []
    if MID_INVERSION.search(text):
        escalate.append("contains a mid-sentence inversion (but no / but not)")
    if CONDITIONAL.search(text):
        escalate.append("conditional (unless / except / only if / provided)")
    for pattern, why in RULING_PATTERNS:
        if pattern.search(text):
            escalate.append(why)

    leads_reject = bool(REJECT_LEAD.match(text))
    leads_accept = bool(ACCEPT_LEAD.match(text))
    leads_ignore = bool(IGNORE_LEAD.match(text))
    negated = bool(NEGATION.search(text))

    # A negation that is NOT the leading construction means the line says two
    # things. Never file it as one of them.
    if negated and not leads_reject:
        escalate.append("negation appears mid-line, so the polarity is mixed")

    if escalate:
        return (None, 0.4, escalate)
    if leads_reject:
        return ("reject", 0.95, [])
    if leads_accept:
        return ("accept", 0.95, [])
    if leads_ignore:
        # Edexcel's "Ignore X" = award despite X. A permission, per 0029's
        # column mapping and the fixture header.
        return ("accept", 0.8, [])
    return ("guidance", 0.6, [])


# ============================================================================
# EXTRACTION
# ============================================================================

QUESTION_LABEL = re.compile(r"^\s*(\d{1,2}\s*(?:\([a-z]\))?\s*(?:\([ivxlc]+\))?)\s*$")
BRACKETED_INT = re.compile(r"^\((\d{1,2})\)$")
DISTRACTOR_RE = re.compile(r"^\s*[A-D]\s+is\s+incorrect\b", re.I)
TOTAL_RE = re.compile(r"Total for Question\s+(\d+)\s*=\s*(\d+)\s*marks?", re.I)


def question_blocks(page, bounds):
    """
    Split a page into question blocks by the "Question / Number" header rows.

    A block runs from its own label down to the next header, so the guidance
    that belongs to a question cannot bleed into the next one.
    """
    qcol = words_in(page, bounds["q0"], bounds["q1"])
    headers = [y for y, line in qcol.items() if joined(line).lower() in ("question", "number")]
    labels = []
    for y, line in qcol.items():
        text = joined(line)
        m = QUESTION_LABEL.match(text)
        if m and not text.lower() in ("question", "number"):
            labels.append((y, re.sub(r"\s+", "", m.group(1))))
    labels.sort()

    blocks = []
    for i, (y, label) in enumerate(labels):
        # bounded below by the next header row, or the page bottom
        after = [h for h in headers if h > y + LINE_TOLERANCE]
        nxt = labels[i + 1][0] if i + 1 < len(labels) else None
        bottom = min([h for h in after] + ([nxt] if nxt else []) + [page.rect.height])
        blocks.append({"label": label, "top": y - LINE_TOLERANCE, "bottom": bottom})
    return blocks


def extract_page(page, page_no):
    bounds = column_bounds(page)
    if bounds is None:
        return [], {"page": page_no, "problem": "no table rules found — page not read"}

    has_guidance = bounds["guidance"] is not None
    answer_x1 = bounds["guidance"] if has_guidance else bounds["mark0"]

    answers = words_in(page, bounds["q1"], answer_x1)
    guidance = words_in(page, bounds["guidance"], bounds["mark0"]) if has_guidance else {}
    marks = words_in(page, bounds["mark0"], bounds["right"])

    out = []
    for block in question_blocks(page, bounds):
        top, bottom = block["top"], block["bottom"]
        in_block = lambda d: {y: v for y, v in d.items() if top <= y < bottom}
        a, g, m = in_block(answers), in_block(guidance), in_block(marks)

        # ── total marks: a bracketed integer in the MARK column ────────────
        total = None
        for y, line in m.items():
            for _, tok in line:
                hit = BRACKETED_INT.match(tok)
                if hit:
                    total = {
                        "value": int(hit.group(1)),
                        "confidence": 1.0,
                        "derivedFrom": "bracketed integer in the ruled Mark column",
                        "sourceLine": joined(line),
                        "page": page_no,
                        "y": round(y, 1),
                    }
        # ── per-point marks: bracketed integers right-aligned in the ANSWER
        #    column. Identified by the MODE of their x, because a worked value
        #    like "(11400)" also sits in that column and is not a mark.
        point_mark_xs = Counter()
        for y, line in a.items():
            for x, tok in line:
                if BRACKETED_INT.match(tok):
                    point_mark_xs[round(x)] += 1
        mark_x = point_mark_xs.most_common(1)[0][0] if point_mark_xs else None

        # ── method blocks: "Method", "Alternative method" ──────────────────
        # ⚠ RECORDED, NOT RESOLVED. 22(c) prints three marking points twice —
        # once per route to the answer — so a flat count says six points on a
        # three-mark question. Which route a script took is a marking decision;
        # this only records WHICH BLOCK each point sits under and says the
        # question has alternatives, so the count is never mistaken for a total.
        method_rows = sorted(
            (y, joined(line)) for y, line in a.items()
            if re.match(r"^\s*(alternative\s*(method)?|method\s*\d*)\s*$", joined(line), re.I)
        )

        def method_for(y):
            current = None
            for my, label in method_rows:
                if my <= y:
                    current = label
            return current

        # ── marking points: a line carrying a bullet starts one ────────────
        # ⚠ THE PER-POINT MARK SITS ON ITS OWN LINE, SLIGHTLY ABOVE THE BULLET.
        # Pairing them by "same visual line" lost 20(a)'s M4, whose (1) is 4.4pt
        # above its bullet — just outside the line tolerance. Marks are matched
        # to the NEAREST bullet instead, which is what the layout actually means.
        bullet_ys = sorted(y for y, line in a.items() if any(t == "•" for _, t in line))
        point_marks = {}
        for y, line in a.items():
            for x, tok in line:
                hit = BRACKETED_INT.match(tok)
                if hit and mark_x is not None and abs(x - mark_x) <= 6:
                    if not bullet_ys:
                        continue
                    nearest = min(bullet_ys, key=lambda by: abs(by - y))
                    if abs(nearest - y) <= 12:
                        point_marks[nearest] = int(hit.group(1))

        points = []
        pending = None
        for y in sorted(a):
            line = a[y]
            text = joined(line)
            is_bullet = any(t == "•" for _, t in line)
            body = " ".join(
                t for x, t in line
                if t != "•"
                and not (BRACKETED_INT.match(t) and mark_x is not None and abs(x - mark_x) <= 6)
            ).strip()

            if is_bullet:
                if pending:
                    points.append(pending)
                per_point = point_marks.get(y)
                # ⚠ NUMBERED WITHIN ITS ROUTE, AND PREFIXED SO THE CODE IS
                # UNIQUE. 22(c) prints three marks twice because there are two
                # routes to the same answer; a script takes ONE and can earn
                # three. Numbering them M1..M6 said six marks on a three-mark
                # question, and mark_scheme_items has UNIQUE (question_id,
                # point_code) so both routes cannot both be called M1.
                #
                # THE RULING (Muhammed, and it belongs in the data, not in a
                # marker's head): store both routes, mark against whichever the
                # script matches, cap at the question tariff. NEVER sum across
                # routes — the same three marks appearing twice is a printing
                # convention, not six marks.
                route_label = method_for(y)
                route_index = 1
                if route_label:
                    seen = [lbl for _, lbl in method_rows]
                    route_index = seen.index(route_label) + 1
                in_route = sum(1 for pt in points if pt["route"] == route_index) + 1
                prefix = "" if route_index == 1 else f"ALT{route_index - 1}."
                pending = {
                    "pointCode": f"{prefix}M{in_route}",
                    "route": route_index,
                    "criterion": body,
                    "marks": per_point,
                    "methodBlock": route_label,
                    "confidence": 0.9 if per_point else 0.6,
                    "derivedFrom": "bullet in the Answer column"
                    + ("" if per_point else " with NO per-point mark found nearby"),
                    "sourceLine": text,
                    "page": page_no,
                    "y": round(y, 1),
                }
            elif pending is not None and body and not re.match(r"^(Method|Alternative)", body, re.I):
                pending["criterion"] = (pending["criterion"] + " " + body).strip()
        if pending:
            points.append(pending)

        # ── SECTION A: no bullets, the whole cell is one marking point ─────
        # ⚠ THE DISTRACTOR LINES ARE NOT CLASSIFIED. "A is incorrect because
        # the number of electrons is for a 79Br atom" explains why a WRONG
        # OPTION is wrong. Whether that belongs in reject[] — a rule about the
        # student's own answer — or is commentary that belongs nowhere is a
        # judgement about what reject[] means, and this file does not make
        # judgements. They are extracted separately and flagged.
        distractors = []
        if not points:
            body_lines = [
                (y, joined(line)) for y, line in sorted(a.items())
                if joined(line) and joined(line).lower() != "answer"
            ]
            head = [(y, t) for y, t in body_lines if not DISTRACTOR_RE.match(t)]
            distractors = [
                {"text": t, "page": page_no, "y": round(y, 1), "sourceLine": t,
                 "confidence": 0.9,
                 "derivedFrom": "distractor explanation in the Answer column",
                 "requiresRuling": [
                     "explains why a WRONG option is wrong — whether this is a "
                     "reject[] rule or commentary is a judgement"
                 ]}
                for y, t in body_lines if DISTRACTOR_RE.match(t)
            ]
            if head:
                criterion = " ".join(t for _, t in head).strip()
                points = [{
                    "pointCode": "M1",
                    "route": 1,
                    "criterion": criterion,
                    "marks": total["value"] if total else None,
                    "methodBlock": None,
                    "confidence": 0.75,
                    "derivedFrom": "whole Answer cell — Section A prints no bullets, "
                                   "so the cell is taken as one marking point",
                    "sourceLine": head[0][1],
                    "page": page_no,
                    "y": round(head[0][0], 1),
                }]

        # ── alternative-method blocks ──────────────────────────────────────
        alternatives = [
            {"heading": joined(line), "page": page_no, "y": round(y, 1),
             "confidence": 1.0, "derivedFrom": "heading in the Answer column",
             "sourceLine": joined(line)}
            for y, line in a.items()
            if re.match(r"^\s*(alternative|method)\b", joined(line), re.I)
        ]

        # ── guidance column: classify by polarity, escalate anything mixed ──
        # ⚠ WORKED EXAMPLES ARE FLAGGED UNPARSED, NOT REPAIRED.
        #
        # Under "Example of calculation" the guidance column prints arithmetic
        # with superscripts, and superscripts interleave in the PDF text layer:
        # "415 x 10-6 / 4.15 x 10-4" comes out as "415 x ÷ 10-6 / x 10-4". That
        # is a real limitation and it is recorded as one.
        #
        # It is deliberately NOT solved. This text is an illustration of one
        # route to the answer — nothing marks against it, no criterion depends
        # on it, and no student sees it. Reconstructing reading order from glyph
        # positions to rescue prose that decides nothing would be effort spent
        # where a wrong result costs nothing and a right one buys nothing.
        # Marked `unparsed` so a reviewer knows not to trust the characters, and
        # left alone.
        in_worked_example = False
        accept, reject, notes, rulings = [], [], [], []
        for y, line in sorted(g.items()):
            text = joined(line)
            if not text or text.lower() in ("additional guidance",):
                continue
            if re.match(r"^\s*example of (calculation|answer)", text, re.I):
                in_worked_example = True
            kind, confidence, escalate = classify(text)
            entry = {
                "text": text,
                "confidence": confidence,
                "derivedFrom": "Additional Guidance column",
                "sourceLine": text,
                "page": page_no,
                "y": round(y, 1),
            }
            # A worked-example line that carries no marking keyword is
            # arithmetic, and its characters are not reliable.
            if in_worked_example and kind == "guidance" and not escalate:
                entry["unparsed"] = True
                entry["unparsedReason"] = (
                    "worked example — superscripts interleave in the PDF text layer, so the "
                    "characters are unreliable. Nothing marks against this text."
                )
                entry["confidence"] = 0.2
                notes.append(entry)
                continue
            if escalate:
                entry["requiresRuling"] = escalate
                rulings.append(entry)
            elif kind == "accept":
                accept.append(entry)
            elif kind == "reject":
                reject.append(entry)
            else:
                notes.append(entry)

        # ⚠ THE CAP, CHECKED RATHER THAN ASSUMED. Per route, the marks a script
        # can earn must not exceed the tariff. If they do, either the tariff was
        # misread or a route boundary was missed — and quietly emitting a route
        # worth more than the question is how six marks appear on a three-mark
        # question in the first place.
        overrun = []
        if total:
            for r in range(1, max(1, len(method_rows)) + 1):
                claimed = sum(pt["marks"] or 0 for pt in points if pt["route"] == r)
                if claimed > total["value"]:
                    overrun.append(
                        f"route {r} claims {claimed} mark(s) against a tariff of {total['value']}"
                    )

        out.append({
            "questionNumber": block["label"],
            "problems": overrun,
            "page": page_no,
            "marks": total,
            "points": points,
            "accept": accept,
            "reject": reject,
            "guidance": notes,
            "requiresRuling": rulings + distractors,
            "alternativeMethods": alternatives,
            # ⚠ When true, the number of points is NOT the number of marks:
            # the same marks are printed once per route. A reviewer must pick.
            "hasAlternativeMethods": len(method_rows) > 1,
            # How many routes the scheme prints, and the ceiling any script can
            # reach. marksAvailable is the TARIFF, never the point count: with
            # alternatives those differ, and reading the point count as a total
            # is the mistake this records the answer to.
            "routes": max(1, len(method_rows)),
            "marksAvailable": total["value"] if total else None,
            "markingRule": (
                "Two or more routes to the same marks. Mark against whichever route the "
                "script matches and cap the award at marksAvailable. Never sum across routes."
                if len(method_rows) > 1 else None
            ),
        })
    return out, None


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    pdf_path, out_path = sys.argv[1], sys.argv[2]
    doc = pymupdf.open(pdf_path)

    questions, problems, totals = [], [], []
    for n in range(doc.page_count):
        page = doc[n]
        text = page.get_text()
        for m in TOTAL_RE.finditer(text):
            totals.append({"question": m.group(1), "marks": int(m.group(2)),
                           "page": n, "sourceLine": m.group(0)})
        if "Question" not in text:
            continue
        found, problem = extract_page(page, n)
        if problem:
            problems.append(problem)
        questions.extend(found)

    payload = {
        "source": pdf_path,
        "pages": doc.page_count,
        "extractor": "extract-markscheme.py",
        # ⚠ Stated in the artefact itself, not only in a README, because this
        # file is what a reviewer will open.
        "status": "PROPOSALS — nothing here has been reviewed, ruled on, or written to a database",
        "questions": questions,
        "questionTotals": totals,
        "problems": problems,
    }
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    ruled = sum(len(q["requiresRuling"]) for q in questions)
    unparsed = sum(1 for q in questions for g in q["guidance"] if g.get("unparsed"))
    print(f"{len(questions)} question block(s) across {doc.page_count} pages")
    print(f"{sum(len(q['points']) for q in questions)} marking point(s)")
    print(f"{sum(len(q['accept']) for q in questions)} accept, "
          f"{sum(len(q['reject']) for q in questions)} reject, "
          f"{sum(len(q['guidance']) for q in questions)} guidance")
    print(f"{ruled} line(s) FLAGGED FOR A RULING — not classified")
    print(f"{unparsed} worked-example line(s) FLAGGED UNPARSED — nothing marks against them")
    overruns = [(q["questionNumber"], p) for q in questions for p in q.get("problems", [])]
    if overruns:
        print(f"⚠ {len(overruns)} ROUTE(S) CLAIM MORE MARKS THAN THE TARIFF:")
        for qn, p in overruns:
            print(f"    {qn}: {p}")
    if problems:
        print(f"{len(problems)} page(s) could not be read: {problems}")
    print(f"-> {out_path}")


if __name__ == "__main__":
    main()
