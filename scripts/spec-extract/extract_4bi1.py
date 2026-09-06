#!/usr/bin/env python3
"""
4BI1 specification extractor — the one step between the official Pearson PDF
and everything downstream. The Biology sibling of extract_4ch1.py; the shared
shape is deliberate, the deltas are Biology's own and each is annotated.

============================================================================
⚠ SOURCE OF TRUTH: the official document, nothing else
============================================================================
Input : Pearson Edexcel International GCSE in Biology (4BI1) Specification,
        Issue 3, © Pearson Education Limited 2024 (first teaching September
        2017, first examination June 2019). The PDF is NOT in the repository;
        the default path is where it was downloaded from
        qualifications.pearson.com on 2026-09-05. The script refuses any PDF
        whose cover does not say 4BI1 + Issue 3, and records the file's
        sha256 in the output so the artefacts stay pinned to one exact
        document.

Output (both committed, both deterministic for a given PDF):
  4bi1-issue3-content-lines.txt — every text line of the content pages with
        its font names, sizes and position. The near-source evidence: the
        test suite re-derives its expectations from THIS file, independently
        of the JSON, so the parser below cannot quietly vouch for itself.
  4bi1-issue3.json — the canonical extraction: 5 sections, their lettered
        sub-topics, and every numbered specification statement with its
        official code, official wording, Biology-only flag, practical flag
        and context heading.

============================================================================
⚠ WHAT THE DOCUMENT'S OWN TYPOGRAPHY MEANS (spec p.1, "Referencing")
============================================================================
- Statements IN BOLD carry a 'B' code suffix: "specification statements that
  are in bold with a 'B' reference relate to content that is only in the
  International GCSE in Biology and is not found in the International GCSE
  in Science (Double Award)". Paper 1 "assesses core content that is not in
  bold and does not have a 'B' reference"; Paper 2 "assesses all the
  content" (spec pp.7-8). So the B SUFFIX IS the Paper 2-only marker,
  carried by the official code itself — no schema field is needed, and this
  script ASSERTS bold ⟺ B for every statement so the claim is checked
  against the document, not assumed.
- Statements IN ITALICS beginning "practical:" are practical investigations
  ("these are included in 2: Biology content as specification points in
  italics", spec p.1). Recorded as `practical: true`. A B-suffixed practical
  (e.g. 2.33B, 4.4B) is set bold-italic and carries both flags.
- CONTEXT HEADINGS — Biology's one structural addition over 4CH1: whole-row
  bold-italic headings inside sub-topic tables (Flowering plants, Humans,
  Crop plants, Micro-organisms, Fish farming) that scope the statements
  after them until the next heading or sub-topic. They are NOT specification
  points (no code, not assessable prose in their own right) and are NOT
  merged into any statement's wording; each point records the heading it
  sits under as `context`, purely as provenance/ordering evidence. They are
  recognised by typography: a bold-italic row at the code-column x (~62pt)
  that matches no code — statement continuation lines sit at the description
  column (~98pt), so the two cannot be confused.

Known normalisations (recorded here because faithful is not identical):
- Super/subscripts are reconstructed as Unicode from the PDF's raised/
  lowered 6pt spans; characters with no Unicode form fall back to plain
  text. (Biology barely uses them; the mechanism is kept for parity.)
- The content pages contain NO embedded images (asserted below), so unlike
  4CH1 there are no image-adjacent statements: meta.imageAdjacent is [].
- Line breaks inside a statement are kept as '\n'; bullets keep their '•'.

Usage:
  python3 scripts/spec-extract/extract_4bi1.py \
      [--pdf ~/Desktop/international-gcse-biology-4bi1-specification-issue3.pdf]
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
    "~/Desktop/international-gcse-biology-4bi1-specification-issue3.pdf"
)

SUPER = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶",
         "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "–": "⁻", "(": "⁽", ")": "⁾"}
SUB = {"0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆",
       "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "–": "₋", "(": "₍", ")": "₎"}

# Five content sections; the official suffix letter is B (4CH1's is C).
CODE_RE = re.compile(r"^([1-5])\.(\d{1,2})(B?)\b\s*(.*)$")
SUBSECTION_RE = re.compile(r"^\(([a-z])\)\s+(.+?)\s*$")
# A context heading sits at the code column; continuation text never does.
CONTEXT_MAX_X = 80.0
CONTEXT_MAX_LEN = 48


def render_line(line):
    """One pymupdf line → text with super/subscripts as Unicode.

    ⚠ Raised/lowered 6pt spans live INSIDE the pymupdf line, in reading
    order — transform them here, never after regrouping by y-coordinate,
    which exiles a raised digit into its own visual row and reorders the
    wording (4CH1's 1.35C '33 molar volume' bug)."""
    spans = line["spans"]
    main = max((round(s["size"]) for s in spans), default=0)
    baseline = min(
        (s["origin"][1] for s in spans if round(s["size"]) == main), default=0.0
    )
    text = ""
    for s in spans:
        t = s["text"]
        if round(s["size"]) < main - 2 and t.strip():
            table = SUPER if s["origin"][1] < baseline - 0.5 else SUB
            t = "".join(table.get(ch, ch) for ch in t)
        text += t
    return text


def line_records(doc, first, last):
    """Text lines of pages [first, last], merged by visual row, in order.

    pymupdf sometimes splits one visual row into several lines (a section
    number and its name, a bullet glyph and its text) — those are merged by
    bbox vertical centre; a line's own spans are kept in pymupdf order."""
    records = []
    for pageno in range(first, last + 1):
        page = doc[pageno]
        page_lines = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                main = max(round(s["size"]) for s in line["spans"])
                # Baseline of the dominant-size spans: a raised 6pt superscript
                # must not represent the row it merely decorates.
                baseline = min(
                    s["origin"][1] for s in line["spans"] if round(s["size"]) == main
                )
                page_lines.append((baseline, line))
        page_lines.sort(key=lambda pair: pair[0])
        # Cluster by baseline proximity — a rounded-bucket merge mis-rows a
        # bullet glyph against text whose superscripts stretch its bbox.
        clusters = []
        for baseline, line in page_lines:
            if clusters and baseline - clusters[-1][-1][0] <= 3.5:
                clusters[-1].append((baseline, line))
            else:
                clusters.append([(baseline, line)])
        for cluster in clusters:
            lines = sorted((l for _, l in cluster), key=lambda l: l["bbox"][0])
            text = "".join(render_line(l) for l in lines)
            text = unicodedata.normalize("NFC", text).rstrip()
            spans = [s for l in lines for s in l["spans"]]
            fonts = sorted({s["font"] for s in spans if s["text"].strip()})
            sizes = sorted({round(s["size"]) for s in spans})
            x = round(min(s["origin"][0] for s in spans), 1)
            records.append(
                {"page": pageno + 1, "x": x, "fonts": fonts, "sizes": sizes, "text": text}
            )
    return records


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


def italic(fonts):
    return any("Italic" in f for f in fonts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default=DEFAULT_PDF)
    args = ap.parse_args()

    with open(args.pdf, "rb") as f:
        pdf_bytes = f.read()
    sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    doc = pymupdf.open(args.pdf)
    cover = doc[0].get_text()
    for needle in ("4BI1", "Issue 3", "International GCSE"):
        if needle not in cover:
            sys.exit(f"REFUSED: cover page does not say {needle!r} — wrong document?")

    # Content page range: from the "2 Biology content" part-opener to the
    # page before the assessment part.
    first = last = None
    for i in range(len(doc)):
        text = doc[i].get_text()
        if first is None and "2 Biology content" in text and i > 5:
            first = i
        elif first is not None and ("Assessment information" in text and i > first + 5):
            last = i - 1
            break
    if first is None or last is None:
        sys.exit("REFUSED: could not locate the Biology content pages")

    # Unlike 4CH1 (one displayed formula after 4.49C), the Biology content
    # pages carry no images at all — assert it so a future reissue that adds
    # one cannot silently lose content.
    paged_images = {
        i + 1: len([b for b in doc[i].get_text("dict")["blocks"] if b["type"] == 1])
        for i in range(first, last + 1)
    }
    if any(paged_images.values()):
        sys.exit(f"REFUSED: image blocks on content pages {paged_images} — "
                 "text extraction would lose content; investigate first")

    records = line_records(doc, first, last)

    # ── the committed near-source evidence ──────────────────────────────────
    lines_path = os.path.join(HERE, "4bi1-issue3-content-lines.txt")
    with open(lines_path, "w") as f:
        f.write(
            "# Pearson Edexcel International GCSE in Biology (4BI1) — Issue 3\n"
            f"# Content pages {first + 1}-{last + 1}, extracted {os.path.basename(args.pdf)}\n"
            f"# pdf sha256 {sha256}\n"
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
            # point set in italics and BEGINNING "practical:". Italic alone is
            # not enough — in-text italics (species names like Mucor, in
            # vitro) would over-flag ordinary statements.
            cur_point["practical"] = cur_point["text"].startswith("practical:")
            del cur_point["chunks"]
            points.append(cur_point)
            cur_point = None

    for rec in records:
        if is_furniture(rec):
            continue
        text, fonts = rec["text"].strip(), rec["fonts"]

        if 16 in rec["sizes"] and bold(fonts):
            m = re.match(r"^([1-5])\s+(.+?)\s*$", text)
            if m:
                close_point()
                started, in_preview = True, False
                cur_section = {"number": int(m.group(1)), "name": m.group(2)}
                sections.append(cur_section)
                cur_topic = None
                cur_context = None
                continue
        if not started:
            continue  # part-opener page furniture before "1 The nature ..."

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
                "bOnly": code.group(3) == "B",
                "bold": bold(fonts),
                "practical": False,
                "context": cur_context,
                "topicOrder": cur_topic["order"],
                "order": len(points) + 1,
                "chunks": [code.group(4)] if code.group(4) else [],
            }
            continue

        # Context heading: a whole-row italic heading at the code column,
        # inside a sub-topic table. Continuation text of a (possibly italic)
        # statement always starts at the description column, so x separates
        # the two cases structurally, not by guesswork.
        if (
            cur_topic is not None
            and italic(fonts)
            and rec["x"] <= CONTEXT_MAX_X
            and len(text) <= CONTEXT_MAX_LEN
        ):
            close_point()
            cur_context = text
            context_rows.append(
                {"topicOrder": cur_topic["order"], "name": text, "fonts": fonts}
            )
            continue

        if cur_point is not None:
            if text.startswith("•"):
                cur_point["chunks"].append(text)
            elif cur_point["chunks"]:
                cur_point["chunks"][-1] += " " + text
            else:
                cur_point["chunks"].append(text)

    close_point()

    # ── assertions: the extraction refuses to look plausible while wrong ────
    problems = []
    if len(sections) != 5:
        problems.append(f"expected 5 sections, found {len(sections)}")
    for p in points:
        if p["bold"] != p["bOnly"]:
            problems.append(f"{p['code']}: bold={p['bold']} but B-suffix={p['bOnly']}")
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
    # Context headings: every one fully italic, code-free, digit-free, and
    # actually scoping at least one point — a childless heading means the
    # parser mistook a continuation line for a heading (or vice versa).
    for c in context_rows:
        if not all("Italic" in f for f in c["fonts"]):
            problems.append(f"context {c['name']!r}: not a fully italic row {c['fonts']}")
        if any(ch.isdigit() for ch in c["name"]) or c["name"].startswith("practical:"):
            problems.append(f"context {c['name']!r}: does not look like a heading")
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
        "document": "Pearson Edexcel International GCSE in Biology (4BI1) — Specification",
        "issue": "Issue 3",
        "publisher": "© Pearson Education Limited 2024",
        "firstTeaching": "September 2017",
        "firstAssessment": "June 2019",
        "source": "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Biology/2017/specification-and-sample-assessments/international-gcse-biology-2017-specification1.pdf",
        "pdfSha256": sha256,
        "contentPages": [first + 1, last + 1],
        "paper2OnlyMeaning": (
            "A 'B' code suffix (rendered bold in the document) marks content that is "
            "only in the International GCSE in Biology, not in Science (Double "
            "Award); Paper 1 assesses only non-B content, Paper 2 assesses all "
            "content — so the B suffix in the official code IS the Paper 2-only "
            "marker (spec pp.1, 7-8). Asserted bold ⟺ B for every statement."
        ),
        "contextMeaning": (
            "Whole-row bold-italic headings inside sub-topic tables (e.g. "
            "'Flowering plants', 'Humans') scope the statements after them until "
            "the next heading or sub-topic. They are provenance, not points: no "
            "code, no row of their own downstream; each point carries its heading "
            "as `context` and the official wording is untouched."
        ),
        "imageAdjacent": [],
        "counts": {
            "points": len(points),
            "topics": len(topics),
            "bOnly": sum(1 for p in points if p["bOnly"]),
            "practical": sum(1 for p in points if p["practical"]),
            "contexts": len(context_rows),
            "bySection": {
                str(s["number"]): sum(1 for p in points if p["section"] == s["number"])
                for s in sections
            },
        },
    }
    for p in points:
        del p["bold"]  # asserted ⟺ bOnly above; bOnly is the durable fact

    out = {"meta": meta, "sections": sections, "topics": topics, "points": points}
    json_path = os.path.join(HERE, "4bi1-issue3.json")
    with open(json_path, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(f"content pages {first + 1}-{last + 1} · pdf sha256 {sha256[:16]}…")
    print(f"sections {len(sections)} · sub-topics {len(topics)} · points {len(points)}"
          f" ({meta['counts']['bOnly']} B-only, {meta['counts']['practical']} practical,"
          f" {meta['counts']['contexts']} context headings)")
    print("by section:", meta["counts"]["bySection"])
    print(f"wrote {lines_path}\nwrote {json_path}")


if __name__ == "__main__":
    main()
