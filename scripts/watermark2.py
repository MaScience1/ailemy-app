#!/usr/bin/env python3
"""
watermark2.py — stamp "Ailemy.com" on every page of a past-paper PDF.

WHY THE OLD STAMP NEVER RENDERED
--------------------------------
Edexcel question papers are laid out with a print bleed: the MediaBox is larger
than the CropBox on all four sides. Measured across 25 real question papers
(687 pages), 424 of them carry:

    MediaBox = [0, 0, 651.97, 898.58]
    CropBox  = [28.35, 28.35, 623.62, 870.24]

— a 28.35pt (10mm) bleed. A stamp positioned relative to the MediaBox top, at
say 18pt down, lands at y = 898.58 - 18 = 880.58. The CropBox top is 870.24, so
the stamp sits 10pt ABOVE the visible page and every conforming viewer clips it.
That is exactly the reported y≈876-881 vs CropBox top 870.24.

The fix is to anchor to the CropBox, falling back to the MediaBox only when a
page genuinely has no CropBox. This is a PER-PAGE decision: the remaining 263
pages have CropBox == MediaBox, and mark schemes and examiner reports include
841.89 x 595.28 landscape pages with /Rotate 90.

PLACEMENT
    text      "Ailemy.com"
    position  top-right of the CropBox
    right     text ENDS 35pt inside the CropBox right edge
    baseline  18pt below the CropBox top edge
    size      10.5pt Helvetica
    colour    grey 0.72
    every page, including the cover — no separate cover treatment, no logo

ROTATION
    /Rotate rotates the page clockwise for display, so the visual top-right is
    not the coordinate top-right. Each of 0/90/180/270 gets its own anchor point
    and text matrix so the stamp always reads horizontally in the top-right of
    the page AS SEEN.

USAGE
    python3 scripts/watermark2.py IN.pdf OUT.pdf [--png-dir DIR] [--force]

    --png-dir  also render page 1, page 2 and the last page to PNG for review
    --force    stamp even if the file already carries the marker
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
    TextStringObject,
)

# ---------------------------------------------------------------------------
# Spec
# ---------------------------------------------------------------------------

TEXT = "Ailemy.com"
FONT_SIZE = 10.5
GREY = 0.72
RIGHT_INSET = 35.0  # text ends this far inside the box's right edge
TOP_INSET = 18.0  # baseline this far below the box's top edge

# Resource name for our font. Deliberately unlikely to collide with a name the
# document already uses — overwriting an existing /F1 would corrupt the page.
FONT_RES = "/AilemyWM"

# Bumped whenever placement changes, so a re-run re-stamps files carrying an
# older, wrongly-placed stamp instead of skipping them.
MARKER_KEY = "/AilemyWatermark"
MARKER_VALUE = "cropbox-v2"

# Helvetica advance widths (1/1000 em) for printable ASCII. Needed to
# right-align without a font library.
_HELVETICA = {
    " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667,
    "'": 191, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333,
    ".": 278, "/": 278, "0": 556, "1": 556, "2": 556, "3": 556, "4": 556,
    "5": 556, "6": 556, "7": 556, "8": 556, "9": 556, ":": 278, ";": 278,
    "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015, "A": 667, "B": 667,
    "C": 722, "D": 722, "E": 667, "F": 611, "G": 778, "H": 722, "I": 278,
    "J": 500, "K": 667, "L": 556, "M": 833, "N": 722, "O": 778, "P": 667,
    "Q": 778, "R": 722, "S": 667, "T": 611, "U": 722, "V": 667, "W": 944,
    "X": 667, "Y": 667, "Z": 611, "[": 278, "\\": 278, "]": 278, "^": 469,
    "_": 556, "`": 333, "a": 556, "b": 556, "c": 500, "d": 556, "e": 556,
    "f": 278, "g": 556, "h": 556, "i": 222, "j": 222, "k": 500, "l": 222,
    "m": 833, "n": 556, "o": 556, "p": 556, "q": 556, "r": 333, "s": 500,
    "t": 278, "u": 556, "v": 500, "w": 722, "x": 500, "y": 500, "z": 500,
}


def text_width(text: str, size: float) -> float:
    return sum(_HELVETICA.get(c, 556) for c in text) * size / 1000.0


# ---------------------------------------------------------------------------
# Placement
# ---------------------------------------------------------------------------


def anchor_for(box, rotate: int, width: float):
    """
    Baseline start point and text matrix so the stamp reads horizontally in the
    visual top-right, whatever /Rotate says.

    `box` is the CropBox (or MediaBox when there is none). Returns
    (a, b, c, d, e, f) for `a b c d e f Tm`.

    Derivation, with u = x-left, v = y-bottom, W and H the box dimensions.
    /Rotate turns the page CLOCKWISE for display, so display coordinates are:
        0    (u, v)          size W x H
        90   (v, W - u)      size H x W
        180  (W - u, H - v)  size W x H
        270  (H - v, u)      size H x W
    In each case we want the text to END at (displayWidth - RIGHT_INSET) and sit
    on a baseline TOP_INSET below the display top, then invert back.
    """
    left, bottom = float(box.left), float(box.bottom)
    right, top = float(box.right), float(box.top)
    rotate = rotate % 360

    if rotate == 0:
        return (1, 0, 0, 1, right - RIGHT_INSET - width, top - TOP_INSET)
    if rotate == 90:
        # Text runs along +y in page space; rotate the glyphs 90° CCW.
        return (0, 1, -1, 0, left + TOP_INSET, top - RIGHT_INSET - width)
    if rotate == 180:
        return (-1, 0, 0, -1, left + RIGHT_INSET + width, bottom + TOP_INSET)
    if rotate == 270:
        return (0, -1, 1, 0, right - TOP_INSET, bottom + RIGHT_INSET + width)
    raise ValueError(f"unsupported /Rotate value: {rotate}")


def page_box(page):
    """
    The CropBox when the page has one, else the MediaBox.

    pypdf's .cropbox already falls back to the MediaBox, but it does so
    silently; asking explicitly lets the caller report which was used.
    """
    try:
        cb = page.cropbox
        mb = page.mediabox
        used_crop = (
            abs(float(cb.left) - float(mb.left)) > 1e-6
            or abs(float(cb.bottom) - float(mb.bottom)) > 1e-6
            or abs(float(cb.right) - float(mb.right)) > 1e-6
            or abs(float(cb.top) - float(mb.top)) > 1e-6
        )
        return cb, used_crop
    except Exception:
        return page.mediabox, False


# ---------------------------------------------------------------------------
# Stamping
# ---------------------------------------------------------------------------


def _escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def qq_imbalance(data: bytes) -> int:
    """
    Count unclosed `q` operators in a content stream.

    Naively regexing for q/Q miscounts, because those bytes also occur inside
    string literals and inline-image data. This walks the stream skipping
    (...) strings, <...> hex strings, % comments and BI...ID...EI inline
    images, so only real operators are counted.

    Needed because these papers are genuinely unbalanced — page 1 of a typical
    question paper pushes 37 and pops 32. A stamp appended after a single `Q`
    still runs inside four leftover graphics states, inheriting whatever clip
    and text state they set.
    """
    depth = 0
    i = 0
    n = len(data)
    while i < n:
        ch = data[i : i + 1]
        if ch == b"(":  # literal string
            i += 1
            nest = 1
            while i < n and nest:
                c = data[i : i + 1]
                if c == b"\\":
                    i += 2
                    continue
                if c == b"(":
                    nest += 1
                elif c == b")":
                    nest -= 1
                i += 1
            continue
        if ch == b"<" and data[i : i + 2] != b"<<":  # hex string
            j = data.find(b">", i)
            i = n if j < 0 else j + 1
            continue
        if ch == b"%":  # comment
            j = data.find(b"\n", i)
            i = n if j < 0 else j + 1
            continue
        if data[i : i + 2] == b"BI" and (i == 0 or data[i - 1 : i].isspace()):
            j = data.find(b"EI", i)  # skip inline image payload wholesale
            i = n if j < 0 else j + 2
            continue
        if ch in (b"q", b"Q"):
            before = data[i - 1 : i]
            after = data[i + 1 : i + 2]
            lone = (not before or not before.isalnum()) and (
                not after or not after.isalnum()
            )
            if lone:
                depth += 1 if ch == b"q" else -1
        i += 1
    return depth


def stamp_page(writer: PdfWriter, page) -> dict:
    width = text_width(TEXT, FONT_SIZE)
    box, used_crop = page_box(page)
    rotate = int(page.get("/Rotate", 0) or 0)
    a, b, c, d, e, f = anchor_for(box, rotate, width)

    # Every parameter the stamp depends on is set explicitly rather than
    # inherited. These papers set `1 Tr` (stroke-only text) and never reset it,
    # which silently painted the stamp with an unset stroke colour — present in
    # the file and extractable as text, but invisible on the page. Setting the
    # stroke colour too keeps it right even under an inherited stroke mode.
    ops = (
        f"q\n"
        f"{GREY} g\n"
        f"{GREY} G\n"
        f"BT\n"
        f"0 Tr\n"
        f"0 Tc\n"
        f"0 Tw\n"
        f"100 Tz\n"
        f"0 Ts\n"
        f"{FONT_RES} {FONT_SIZE} Tf\n"
        f"{a} {b} {c} {d} {e:.4f} {f:.4f} Tm\n"
        f"({_escape(TEXT)}) Tj\n"
        f"ET\n"
        f"Q\n"
    )

    # The existing content is wrapped in q/Q before ours is appended. Without
    # that, a page whose stream leaves the CTM modified (unbalanced q/Q is
    # common in generated PDFs) would drag the stamp off-position with it.
    stamp = DecodedStreamObject()
    stamp.set_data(ops.encode("latin-1"))

    pre = DecodedStreamObject()
    pre.set_data(b"q\n")

    parts = [writer._add_object(pre)]
    unclosed = 0
    if "/Contents" in page:
        raw = page.raw_get("/Contents")
        resolved = raw.get_object()
        # /Contents is EITHER one stream OR an array of streams that concatenate
        # into a single stream. Nesting the existing array inside a new one
        # produces "Weird page contents" and a blank page — the elements have to
        # be spliced in, not appended as one item.
        if isinstance(resolved, ArrayObject):
            parts.extend(resolved)
        else:
            parts.append(raw)
        try:
            unclosed = max(0, qq_imbalance(page.get_contents().get_data()))
        except Exception:
            unclosed = 0

    # One Q for our own `q`, plus one for each level the page left open.
    post = DecodedStreamObject()
    post.set_data(b"Q\n" * (unclosed + 1))
    parts.append(writer._add_object(post))
    parts.append(writer._add_object(stamp))
    page[NameObject("/Contents")] = ArrayObject(parts)

    # Font resource. Inlined as a direct dictionary — a standard-14 Type1 needs
    # no descriptor or embedded file.
    resources = page.get("/Resources")
    if resources is None:
        resources = DictionaryObject()
        page[NameObject("/Resources")] = resources
    fonts = resources.get("/Font")
    if fonts is None:
        fonts = DictionaryObject()
        resources[NameObject("/Font")] = fonts
    font = DictionaryObject()
    font.update(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
            NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
        }
    )
    fonts[NameObject(FONT_RES)] = font

    return {
        "rotate": rotate,
        "unclosed_q": unclosed,
        "used_cropbox": used_crop,
        "box": [float(box.left), float(box.bottom), float(box.right), float(box.top)],
        "baseline_xy": [round(e, 2), round(f, 2)],
        "text_width": round(width, 2),
    }


# How far a found stamp may sit from the computed anchor and still count as
# correctly placed. Generous enough to absorb glyph side bearings and rounding,
# tight enough that the legacy stamp — 28pt higher, outside the CropBox — can
# never be mistaken for a good one.
POSITION_TOLERANCE = 3.0


def find_stamps(reader: PdfReader) -> list[dict]:
    """
    Locate every occurrence of the stamp text and classify it BY POSITION.

    Textual detection is not good enough: a file carrying only the old
    MediaBox-anchored stamp contains exactly the same string, so "does it say
    Ailemy.com" would wrongly report it as done. What matters is whether a
    stamp sits at the CropBox-anchored anchor this script now produces.

        correct        within tolerance of the current anchor
        above_cropbox  at or above the CropBox top — outside the visible page,
                       the originally reported bug: in the file, invisible
        misplaced      inside the CropBox but not at the current anchor, so it
                       IS visible and a second stamp would double it

    Measured against the files actually in the bucket, `misplaced` is the case
    that occurs — not `above_cropbox`. See the note in the batch script.

    Position comes from the text matrix supplied to pypdf's extraction visitor,
    so it works whatever operators the stamp was written with.
    """
    width = text_width(TEXT, FONT_SIZE)
    found: list[dict] = []

    for index, page in enumerate(reader.pages):
        box, _ = page_box(page)
        rotate = int(page.get("/Rotate", 0) or 0)
        _, _, _, _, want_x, want_y = anchor_for(box, rotate, width)
        top = float(box.top)
        hits: list[tuple[float, float]] = []

        def visitor(text, cm, tm, font_dict, font_size, _hits=hits):
            if TEXT in (text or ""):
                _hits.append((float(tm[4]), float(tm[5])))

        try:
            page.extract_text(visitor_text=visitor)
        except Exception:
            continue

        for x, y in hits:
            if abs(x - want_x) <= POSITION_TOLERANCE and abs(y - want_y) <= POSITION_TOLERANCE:
                kind = "correct"
            elif y >= top - 1.0:
                kind = "above_cropbox"
            else:
                kind = "misplaced"
            found.append(
                {"page": index + 1, "x": round(x, 2), "y": round(y, 2),
                 "want_x": round(want_x, 2), "want_y": round(want_y, 2),
                 "cropbox_top": round(top, 2), "kind": kind}
            )
    return found


def inspect_pdf(src: Path) -> dict:
    reader = PdfReader(str(src))
    pages = len(reader.pages)
    bleed = same = 0
    rotations: dict[int, int] = {}
    for page in reader.pages:
        _, used_crop = page_box(page)
        if used_crop:
            bleed += 1
        else:
            same += 1
        r = int(page.get("/Rotate", 0) or 0) % 360
        rotations[r] = rotations.get(r, 0) + 1

    stamps = find_stamps(reader)
    correct_pages = {s["page"] for s in stamps if s["kind"] == "correct"}
    above_pages = {s["page"] for s in stamps if s["kind"] == "above_cropbox"}
    misplaced_pages = {s["page"] for s in stamps if s["kind"] == "misplaced"}

    return {
        "pages": pages,
        "bleed_pages": bleed,
        "same_box_pages": same,
        "rotations": {str(k): v for k, v in sorted(rotations.items())},
        "correct_pages": len(correct_pages),
        "above_cropbox_pages": len(above_pages),
        "misplaced_pages": len(misplaced_pages),
        # "Done" means EVERY page already carries a correctly placed stamp.
        # A file stamped on only some pages must be re-stamped.
        "already_correct": len(correct_pages) == pages and pages > 0,
        "has_legacy": bool(above_pages or misplaced_pages),
        # True when re-stamping would put a SECOND VISIBLE mark on the page.
        "would_double": bool(misplaced_pages),
        "samples": stamps[:3],
    }


def is_stamped(reader: PdfReader) -> bool:
    info = reader.metadata
    if not info:
        return False
    try:
        return str(info.get(MARKER_KEY, "")) == MARKER_VALUE
    except Exception:
        return False


def stamp_pdf(src: Path, dst: Path, force: bool = False) -> dict:
    reader = PdfReader(str(src))
    if is_stamped(reader) and not force:
        return {"skipped": True, "reason": "already stamped", "pages": len(reader.pages)}

    writer = PdfWriter()
    writer.append(reader)

    details = [stamp_page(writer, page) for page in writer.pages]

    meta = dict(reader.metadata or {})
    meta[NameObject(MARKER_KEY)] = TextStringObject(MARKER_VALUE)
    writer.add_metadata(meta)

    dst.parent.mkdir(parents=True, exist_ok=True)
    with open(dst, "wb") as fh:
        writer.write(fh)

    return {"skipped": False, "pages": len(details), "details": details}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def render_pngs(pdf: Path, out_dir: Path, page_numbers: list[int]) -> list[Path]:
    """
    Render pages for visual review — via macOS Quartz, NOT poppler.

    Both poppler front-ends lie about this file on this machine, in different
    ways, because the stamp uses the standard-14 Helvetica rather than an
    embedded font:

      pdftoppm    draws vector art but silently omits every glyph, so a
                  correctly stamped page looks unstamped.
      pdftocairo  draws the glyphs as .notdef tofu boxes, because
                  `fc-match Helvetica` here resolves to Hiragino Sans.

    Quartz has real Helvetica and renders what Preview, Safari and Acrobat
    show. pdf.js — what the app's own PaperViewer uses — carries standard-14
    metrics and renders it correctly too.

    Both poppler tools also default to the MediaBox while viewers show the
    CropBox; rendering the MediaBox is what hid the original bug.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(pdf))
    made = []
    for n in page_numbers:
        if n < 1 or n > len(reader.pages):
            continue
        one = PdfWriter()
        one.add_page(reader.pages[n - 1])
        tmp = out_dir / f".{pdf.stem}-p{n}.pdf"
        with open(tmp, "wb") as fh:
            one.write(fh)
        subprocess.run(
            ["qlmanage", "-t", "-s", "1400", "-o", str(out_dir), str(tmp)],
            check=False,
            capture_output=True,
        )
        produced = out_dir / f"{tmp.name}.png"
        final = out_dir / f"{pdf.stem}-p{n}.png"
        if produced.exists():
            produced.replace(final)
            made.append(final)
        tmp.unlink(missing_ok=True)
    return made


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("src")
    ap.add_argument("dst", nargs="?")
    ap.add_argument("--png-dir")
    ap.add_argument("--force", action="store_true")
    ap.add_argument(
        "--inspect",
        action="store_true",
        help="Print a JSON report about SRC and write nothing. Used by the "
        "batch script to decide whether a stored file needs re-stamping.",
    )
    args = ap.parse_args()

    src = Path(args.src)

    if args.inspect:
        import json

        print(json.dumps(inspect_pdf(src)))
        return 0

    if not args.dst:
        ap.error("dst is required unless --inspect is given")
    dst = Path(args.dst)
    result = stamp_pdf(src, dst, force=args.force)

    if result["skipped"]:
        print(f"skipped: {result['reason']}")
        return 0

    details = result["details"]
    print(f"stamped {result['pages']} page(s) -> {dst}")
    crop_used = sum(1 for d in details if d["used_cropbox"])
    print(f"  anchored to CropBox: {crop_used}   to MediaBox: {len(details) - crop_used}")
    rots = sorted({d["rotate"] for d in details})
    print(f"  /Rotate values present: {rots}")
    for label, idx in (("page 1", 0), ("page 2", 1), ("last", len(details) - 1)):
        if idx < 0 or idx >= len(details):
            continue
        d = details[idx]
        print(
            f"  {label:<7} box={d['box']} rotate={d['rotate']} "
            f"baseline={d['baseline_xy']} (text {d['text_width']}pt wide)"
        )

    if args.png_dir:
        pages = sorted({1, 2, result["pages"]})
        made = render_pngs(dst, Path(args.png_dir), pages)
        for p in made:
            print(f"  png: {p}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
