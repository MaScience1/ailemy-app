#!/usr/bin/env python3
"""
PPTX → web lesson deck (§8).

  python3 scripts/lesson-ingest/ingest.py \
    --pptx "/path/to/deck.pptx" --slug lesson-slug --version 1

Output bundle: content/decks/<slug>/v<version>/
  frames/sNN-fK.png   one image per BUILD FRAME (not per slide)
  manifest.json       student-safe: slides, frames, text, spec codes — NO notes
  notes.json          speaker notes — ADMIN ONLY, never uploaded to a
                      student-servable path
  groundtruth.json    probe.py's independent counts, for the deck tests
  source.sha256       identity of the exact .pptx this bundle came from

════════════════════════════════════════════════════════════════════════════
⚠ FRAMES ARE THE UNIT, AND THEY ARE DERIVED, NEVER AUTHORED (§19, §21)
════════════════════════════════════════════════════════════════════════════
A build step is one direct-child <p:par> of the slide's main animation
sequence — that par IS one presenter click, and every spTgt under it (the
clickEffect AND its withEffect companions) reveals on that click. Frame k of a
slide is the slide with the shapes of steps k+1..N removed from the shape
tree; the final frame is the untouched slide. A slide with no sequence yields
exactly one frame. There is no branch that invents motion for a static slide,
so a flattened deck reports 1 frame per slide — honestly — rather than faking
builds (§21) or failing.

⚠ EVERY effect in these decks is <p:set> (appear). Removal-of-later-shapes is
EXACT for appear effects. If a future deck uses motion paths or exit effects,
frame synthesis is no longer faithful — ingest REFUSES (exit 3) rather than
rendering something subtly wrong. Honesty over coverage (§19).

⚠ RENDERING IS LibreOffice, AND THAT IS A FIDELITY CLAIM PER DECK, NOT IN
GENERAL. soffice renders THIS deck family faithfully (verified by eye on the
L1 pilot: serif display, numbered chips, colour system all correct). The admin
preview step (§9) exists because that claim must be re-earned per deck.
"""
import argparse, hashlib, json, re, shutil, subprocess, sys, tempfile, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
ET.register_namespace("p", P[1:-1]); ET.register_namespace("a", A[1:-1])
ET.register_namespace("r", R[1:-1])

ALLOWED_EFFECTS = {"set"}  # appear only — see header
EFFECT_TAGS = ("set", "animEffect", "anim", "animMotion", "animRot", "animScale", "animClr")

def die(msg, code=1):
    print(f"REFUSED — {msg}", file=sys.stderr); sys.exit(code)

def presentation_order(z):
    """Slide part names in PRESENTATION order, from sldIdLst.

    ⚠ THE FILENAME NUMBER IS NOT THE PAGE NUMBER. Deleting a slide in
    PowerPoint leaves a GAP in the slideN.xml numbering (a 29-slide deck can
    end at slide30.xml), and reordering slides does not rename files at all.
    The PDF that soffice renders is paged by POSITION in sldIdLst — so every
    filename-sorted mapping is wrong the moment a deck has ever had a slide
    deleted. Three of the five pilot decks have exactly that, and the L1 deck
    being contiguous is the only reason the pilot did not catch it. sldIdLst
    → presentation rels → part name is the one true order (§13).
    """
    pres = z.read("ppt/presentation.xml").decode("utf8", "replace")
    rels = z.read("ppt/_rels/presentation.xml.rels").decode("utf8", "replace")
    rel_to_target = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    order = []
    m = re.search(r"<p:sldIdLst>(.*?)</p:sldIdLst>", pres, re.S)
    if not m:
        die("presentation.xml has no sldIdLst", 2)
    for rid in re.findall(r'r:id="([^"]+)"', m.group(1)):
        target = rel_to_target.get(rid)
        if not target or "slides/" not in target:
            die(f"sldIdLst references {rid} → {target}, which is not a slide", 2)
        order.append("ppt/" + target.lstrip("/").removeprefix("ppt/").lstrip("/")
                     if target.startswith("/") else "ppt/" + target)
    return order

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

# ── extraction ──────────────────────────────────────────────────────────────

def text_runs(el):
    return [t.text for t in el.iter(f"{A}t") if t.text and t.text.strip()]

def slide_title(root):
    """The run with the LARGEST font size — these decks put the headline in a
    big serif; the first run in document order is usually the top bar."""
    best, best_sz = None, -1
    for r in root.iter(f"{A}r"):
        t = r.find(f"{A}t")
        if t is None or not (t.text and t.text.strip()):
            continue
        pr = r.find(f"{A}rPr")
        sz = int(pr.get("sz", "0")) if pr is not None else 0
        if sz > best_sz:
            best, best_sz = t.text.strip(), sz
    return best or ""

def spec_codes(text):
    """Codes the deck itself claims, e.g. a 'SPEC 1.2' chip. Detection only —
    nothing is invented; a deck with no chips yields []. Both 'SPEC 1.2' in one
    run and 'SPEC' / '1.2' split across runs are matched."""
    joined = " ".join(text.split())
    return sorted(set(re.findall(r"SPEC\s*[·:\-]?\s*(\d+\.\d+)", joined, re.I)))

def build_steps(root):
    """([[spid, …], …], ghost_count) — one entry per click that can actually
    SHOW something. Direct-child <p:par> of mainSeq's childTnLst; all spTgts
    underneath belong to that click.

    ⚠ GHOST STEPS ARE DROPPED, LOUDLY, AND THAT IS THE HONEST READING. A deck
    author who animates a shape and later deletes it leaves an orphaned timing
    node behind — the L2 deck's slide 28 carries EIGHT of them, targeting ids
    that exist nowhere in the shape tree. PowerPoint itself cannot reveal a
    shape that is not there; a click bound to nothing is not a build step, it
    is debris. Dropping it does not flatten animation (§19's sin) — keeping it
    would FAKE animation (§21's sin), eight clicks that visibly do nothing.
    The count is recorded per slide in the manifest so the fidelity note
    survives into admin review."""
    present = {nv.get("id") for nv in root.iter(f"{P}cNvPr")}
    for seq in root.iter(f"{P}seq"):
        ctn = seq.find(f"{P}cTn")
        if ctn is None or ctn.get("nodeType") != "mainSeq":
            continue
        child = ctn.find(f"{P}childTnLst")
        if child is None:
            return [], 0
        steps, ghosts = [], 0
        for par in child.findall(f"{P}par"):
            ids = sorted({t.get("spid") for t in par.iter(f"{P}spTgt") if t.get("spid")})
            live = [i for i in ids if i in present]
            if live:
                # A partially-orphaned click still fires for its surviving
                # shapes — it stays a step; only its dead targets are ignored.
                steps.append(live)
            else:
                # ⚠ ghosts COUNTS DROPPED CLICK GROUPS, NOT DEAD TARGET IDS —
                # because the deck tests reconcile the two implementations as
                #   probe.steps[n] == (manifest frames - 1) + ghostSteps
                # per slide. The probe counts every direct-child par (raw,
                # target-blind, independent); ingest counts the ones that can
                # show something; ghostSteps is exactly the difference. A par
                # with no spTgt at all is equally undroppable-but-unshowable
                # and lands here too.
                ghosts += 1
        return steps, ghosts
    return [], 0

def effect_kinds(xml):
    return {k for k in EFFECT_TAGS if re.search(rf"<p:{k}[ >]", xml)}

def shape_labels(root):
    out = {}
    for sp in root.iter(f"{P}sp"):
        nv = sp.find(f".//{P}cNvPr")
        if nv is None:
            continue
        runs = text_runs(sp)
        out[nv.get("id")] = (runs[0][:48] if runs else nv.get("name", ""))
    return out

def notes_text(z, slide_part, rels_cache):
    """Speaker notes via the slide part's OWN rels (never by index — a deck
    with notes on only some slides misaligns an index join, and filename
    numbers have gaps)."""
    rel_name = slide_part.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels"
    if rel_name not in rels_cache:
        return ""
    m = re.search(r'Target="\.\./notesSlides/(notesSlide\d+\.xml)"', rels_cache[rel_name])
    if not m:
        return ""
    root = ET.fromstring(z.read(f"ppt/notesSlides/{m.group(1)}"))
    # The notes BODY placeholder only — the notes page also carries a slide
    # thumbnail placeholder and a page number, which are not the teacher's notes.
    for sp in root.iter(f"{P}sp"):
        ph = sp.find(f".//{P}ph")
        if ph is not None and ph.get("type") == "body":
            return "\n".join(text_runs(sp))
    return ""

# ── frame synthesis ─────────────────────────────────────────────────────────

def frame_pptx(src, slide_name, steps, upto, out_path):  # steps pre-filtered to live ids
    """Rewrite ONE slide with the shapes of steps upto..N removed, keeping the
    rest of the package byte-identical. upto = number of steps already
    revealed; the final frame never calls this."""
    hide = set()
    for s in steps[upto:]:
        hide.update(s)
    zin = zipfile.ZipFile(src)
    root = ET.fromstring(zin.read(slide_name))
    removed = 0
    parents = {c: p for p in root.iter() for c in p}
    # cxnSp included: a connector (an arrow in a balanced-equation diagram) is
    # as animatable as any other shape.
    for sp in list(root.iter(f"{P}sp")) + list(root.iter(f"{P}graphicFrame")) + list(root.iter(f"{P}pic")) + list(root.iter(f"{P}grpSp")) + list(root.iter(f"{P}cxnSp")):
        nv = sp.find(f".//{P}cNvPr")
        if nv is not None and nv.get("id") in hide and sp in parents:
            parents[sp].remove(sp); removed += 1
    if removed < len(hide):
        # ⚠ A target we could not find would silently render a LATER-step shape
        # into an EARLY frame — the exact "reveals the answer too soon" bug a
        # student would meet mid-lesson. Refuse instead.
        die(f"{slide_name}: {len(hide) - removed} build target(s) not found in shape tree", 3)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zt:
        for it in zin.infolist():
            data = zin.read(it.filename)
            if it.filename == slide_name:
                data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            zt.writestr(it, data)

def pdf_pages(pdf: Path) -> int:
    return len(re.findall(rb"/Type\s*/Page[^s]", pdf.read_bytes()))

def render_pdf(pptx, outdir, expected_pages):
    """Convert and VERIFY the page count, retrying once.

    ⚠ soffice IS SINGLE-INSTANCE PER USER PROFILE. A second invocation while
    one is running forwards to it, returns rc=0, and the output may be absent
    or PARTIAL — which is how a whole overnight batch produced four truncated
    bundles while every command reported success. The page-count check turns
    that silent partial into a named failure; the retry absorbs the transient
    profile-lock case; and ingests must still never run concurrently with each
    other or with anything else that launches LibreOffice.
    """
    pdf = Path(outdir) / (Path(pptx).stem + ".pdf")
    for attempt in (1, 2):
        pdf.unlink(missing_ok=True)
        r = subprocess.run(
            ["soffice", "--headless", "--norestore", "--convert-to", "pdf",
             "--outdir", str(outdir), str(pptx)],
            capture_output=True, text=True, timeout=600)
        if r.returncode == 0 and pdf.exists() and pdf_pages(pdf) == expected_pages:
            return pdf
        got = pdf_pages(pdf) if pdf.exists() else "no file"
        print(f"  ⚠ soffice attempt {attempt} for {Path(pptx).name}: "
              f"{got} pages, expected {expected_pages} — "
              f"{'retrying' if attempt == 1 else 'giving up'}", file=sys.stderr)
        import time; time.sleep(2)
    die(f"soffice produced a wrong-page-count PDF twice for {pptx} — "
        f"is another LibreOffice instance running?", 4)

def render_page(pdf, page, out_prefix, dpi):
    subprocess.run(
        ["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(dpi),
         "-png", str(pdf), str(out_prefix)],
        capture_output=True, timeout=300, check=True)
    hits = sorted(Path(out_prefix).parent.glob(Path(out_prefix).name + "*.png"))
    if not hits:
        die(f"pdftoppm produced nothing for page {page} of {pdf}", 4)
    return hits[0]

# ── main ────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pptx", required=True)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--version", type=int, default=1)
    ap.add_argument("--dpi", type=int, default=140)
    ap.add_argument("--out", default="content/decks")
    args = ap.parse_args()

    src = Path(args.pptx)
    if not src.exists():
        die(f"no such file: {src}", 2)
    if src.suffix.lower() != ".pptx":
        die(f"not a .pptx: {src.name}", 2)

    bundle = Path(args.out) / args.slug / f"v{args.version}"
    frames_dir = bundle / "frames"
    if bundle.exists():
        shutil.rmtree(bundle)  # regenerating THIS version only — never another
    frames_dir.mkdir(parents=True)

    z = zipfile.ZipFile(src)
    names = z.namelist()
    slide_names = presentation_order(z)
    if not slide_names:
        die("no slides found — not a presentation?", 2)
    missing = [n for n in slide_names if n not in names]
    if missing:
        die(f"sldIdLst names parts that do not exist: {missing}", 2)
    rels_cache = {n: z.read(n).decode("utf8", "replace")
                  for n in names if n.startswith("ppt/slides/_rels/")}

    # ⚠ EFFECT ALLOWLIST FIRST — refuse before rendering anything.
    for pos, sn in enumerate(slide_names, 1):
        xml = z.read(sn).decode("utf8", "replace")
        kinds = effect_kinds(xml)
        if kinds - ALLOWED_EFFECTS:
            die(f"slide {pos} ({sn}) uses effects {sorted(kinds - ALLOWED_EFFECTS)} — "
                f"frame synthesis is only faithful for 'appear'. Not rendering a lie.", 3)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        base_pdf = render_pdf(src, tmp, len(slide_names))

        slides_meta, notes_meta, total_frames = [], [], 0
        for n, sn in enumerate(slide_names, 1):
            # ⚠ n IS THE POSITION — the page in the rendered PDF and the number
            # the student sees. The filename's own number is never used again.
            xml = z.read(sn).decode("utf8", "replace")
            root = ET.fromstring(xml)
            steps, ghosts = build_steps(root)
            if ghosts:
                print(f"  ⚠ slide {n}: dropped {ghosts} ghost animation target(s) "
                      f"(orphaned timing nodes — the shapes no longer exist)")
            labels = shape_labels(root)
            runs = text_runs(root)
            frame_files = []

            # frames 0..len(steps)-1 come from surgically reduced packages …
            for k in range(len(steps)):
                variant = tmp / f"s{n}-f{k}.pptx"
                frame_pptx(src, sn, steps, k, variant)
                pdf = render_pdf(variant, tmp, len(slide_names))
                img = render_page(pdf, n, tmp / f"s{n}-f{k}", args.dpi)
                dest = frames_dir / f"s{n:02d}-f{k}.png"
                shutil.move(img, dest); frame_files.append(f"frames/{dest.name}")
            # … the FINAL frame from the untouched deck.
            img = render_page(base_pdf, n, tmp / f"s{n}-final", args.dpi)
            dest = frames_dir / f"s{n:02d}-f{len(steps)}.png"
            shutil.move(img, dest); frame_files.append(f"frames/{dest.name}")

            total_frames += len(frame_files)
            slides_meta.append({
                "n": n,
                "ghostSteps": ghosts,
                "title": slide_title(root),
                "specCodes": spec_codes(" ".join(runs)),
                "text": "\n".join(runs),
                "frames": frame_files,
                "buildLabels": [
                    " + ".join(filter(None, (labels.get(s, "") for s in step)))[:80]
                    for step in steps
                ],
            })
            notes_meta.append({"n": n, "notes": notes_text(z, sn, rels_cache)})
            print(f"  slide {n:>2}: {len(frame_files)} frame(s)")

    manifest = {
        "schema": 1,
        "lessonSlug": args.slug,
        "version": args.version,
        "deckLabel": src.name,
        "sourceSha256": sha256(src),
        "slideCount": len(slide_names),
        "frameCount": total_frames,
        "specCodes": sorted({c for s in slides_meta for c in s["specCodes"]}),
        "slides": slides_meta,
    }
    (bundle / "manifest.json").write_text(json.dumps(manifest, indent=1))
    # ⚠ notes.json IS THE ADMIN-ONLY ARTEFACT. The uploader must never place it
    # under a student-servable prefix; the deck tests assert manifest.json
    # carries no "notes" key anywhere.
    (bundle / "notes.json").write_text(json.dumps({"slides": notes_meta}, indent=1))
    (bundle / "source.sha256").write_text(manifest["sourceSha256"])
    # ⚠ THE PROTECTED SOURCE RIDES IN THE BUNDLE so the admin "stage" action
    # can upload it to the lesson-sources/ prefix (§6). The bundle directory is
    # gitignored, the admin preview route serves only *.png from it, and the
    # student asset route cannot reach the filesystem at all — the deck tests
    # assert all three.
    shutil.copyfile(src, bundle / "source.pptx")

    # Independent ground truth, via the second implementation.
    probe = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "probe.py"), str(src)],
        capture_output=True, text=True, check=True)
    (bundle / "groundtruth.json").write_text(probe.stdout)

    print(f"\n  ✓ {args.slug} v{args.version}: {len(slide_names)} slides → "
          f"{total_frames} frames, spec {manifest['specCodes']}")

if __name__ == "__main__":
    main()
