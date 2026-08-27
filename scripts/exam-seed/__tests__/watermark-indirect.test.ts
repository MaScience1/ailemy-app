/**
 * watermark2.py must stamp a PDF whose page /Resources is an IndirectObject,
 * and must land the text in exactly the same place as it does on a file whose
 * /Resources is inline.
 *
 * ============================================================================
 * ⚠ THE BUG. `resources[NameObject("/Font")] = fonts` raised
 *   TypeError: 'IndirectObject' object does not support item assignment
 * on any PDF whose producer wrote /Resources as a reference. pypdf's
 * DictionaryObject.__getitem__ resolves indirect references; dict.get() does
 * not. Both spellings are valid PDF — 488 of the 2,811 in-scope files use the
 * reference form, so the importer would have failed on 17% of the corpus.
 *
 * ⚠ THE ASSERTION IS POSITIONAL, NOT "DID IT CRASH". A fix that stamps without
 * throwing but puts the text somewhere else is not a fix: all 233 existing
 * papers are stamped at RIGHT_INSET 35.0 and a second scheme would be visible
 * on the page. So this compares COORDINATES against a paper whose /Resources is
 * inline and whose page box is identical — the file the old code could already
 * stamp correctly.
 *
 * ⚠ IT SHELLS OUT TO watermark2.py, never reimplements the geometry. The stamp
 * maths lives in exactly one place; a TypeScript copy of it would agree with
 * itself for ever. Same boundary bulk-import-papers.ts and
 * watermark-existing-papers.ts already use.
 *
 * ⚠ WRITES ONLY TO A TEMP DIRECTORY. No source file is modified, nothing is
 * uploaded, no database is touched.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const CORPUS = "/Users/muhammed/Desktop/Ailemy/Exams";

/** The file in the bug report — page /Resources is an IndirectObject. */
const INDIRECT = join(CORPUS, "2 - GCE AS and A level from 2015/Chemistry /9CH0_02_0619_QU.pdf");
/**
 * A paper with the SAME page box (595.32 x 841.92) whose /Resources is inline.
 * The old code stamped this one correctly, so it is the reference for "same
 * coordinates" rather than a number typed from the spec.
 */
const DIRECT = join(CORPUS, "7 - International edexcel from 2018 /2 - Biology /4 - October/2025/Unit 1/WBI11_01_1025_ER.pdf");
/**
 * A file whose /Resources resolves fine but whose /Font is ITSELF indirect.
 *
 * ⚠ THIS EXISTS BECAUSE THE FIRST VERSION OF THIS SUITE DID NOT COVER IT.
 * Reverting deref() on the /Font lookup left the suite GREEN: the reported
 * file's /Resources is indirect but its /Font is inline, so that half of the
 * fix was never exercised. 27 files across folders 2 and 4 carry an indirect
 * /Font; this is one of them. It is SAM material and will never be imported —
 * which is exactly why it is safe to use as a fixture.
 */
const INDIRECT_FONT = join(CORPUS, "2 - GCE AS and A level from 2015/Physics/AS and A2/9PH01_EAM_MS.pdf");

if (!existsSync(INDIRECT) || !existsSync(DIRECT) || !existsSync(INDIRECT_FONT)) {
  console.log(
    "\n  SKIPPED — the paper corpus is not on this machine. This suite stamps\n" +
      "  real Edexcel PDFs and proves nothing without them.\n",
  );
  process.exit(2);
}

const WM = "scripts/watermark2.py";
const tmp = mkdtempSync(join(tmpdir(), "ailemy-wm-"));

type Inspection = {
  pages: number;
  correct_pages: number;
  misplaced_pages: number;
  above_cropbox_pages: number;
  already_correct: boolean;
};

const stamp = (src: string, out: string): string =>
  execFileSync("python3", [WM, src, out, "--force"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const inspect = (f: string): Inspection =>
  JSON.parse(execFileSync("python3", [WM, f, "--inspect"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

/**
 * page-1 baseline and box, read out of the stamper's own reported detail line.
 *
 * ⚠ THE BASELINE AND THE BOX ARE RETURNED SEPARATELY, and that is the point of
 * this helper. My first draft concatenated box|rotate|baseline into one string
 * and compared it — which failed on two files that stamp to the IDENTICAL
 * baseline, because their page boxes are the same size stored at different
 * float precision (595.32001 against 595.32). The coordinates matched; the
 * comparison did not. The box is now compared numerically with a tolerance and
 * the baseline character-exact, which is what "same coordinates" means.
 */
const detailOf = (stdout: string) => {
  const m = /page 1\s+box=\[([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\]\s+rotate=(\d+)\s+baseline=(\[[^\]]*\])/.exec(stdout);
  if (!m) return null;
  return {
    box: [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])],
    rotate: Number(m[5]),
    baseline: m[6],
  };
};

try {
  // ==========================================================================
  console.log("\n=== 1. the reported file stamps at all ===");
  // ==========================================================================
  const outIndirect = join(tmp, "indirect.pdf");
  let indirectOut = "";
  let threw = "";
  try { indirectOut = stamp(INDIRECT, outIndirect); }
  catch (e) { threw = e instanceof Error ? e.message : String(e); }

  t("⚠ stamping a file with an indirect /Resources does not throw",
    threw === "", threw.split("\n").slice(-3).join(" ").slice(0, 200));
  t("⚠ …and it wrote an output file", existsSync(outIndirect));
  t("⚠ …reporting every page stamped", /stamped 24 page\(s\)/.test(indirectOut),
    indirectOut.split("\n")[0]);

  // ==========================================================================
  console.log("\n=== 2. the output carries the marker, at the CURRENT generation ===");
  // ==========================================================================
  const insp = inspect(outIndirect);
  t("⚠ every page is classified CORRECT by position", insp.correct_pages === insp.pages,
    `${insp.correct_pages} of ${insp.pages}`);
  t("⚠ no page is misplaced", insp.misplaced_pages === 0, insp.misplaced_pages);
  t("⚠ no page sits above the CropBox (the original invisible-stamp bug)",
    insp.above_cropbox_pages === 0, insp.above_cropbox_pages);
  t("⚠ the marker is present and the file reads as already done",
    insp.already_correct === true, insp.already_correct);

  /**
   * ⚠ AND THE MARKER IS THE UNCHANGED ONE. Bumping /AilemyWatermark would make
   * watermark-existing-papers.ts re-stamp all 233 live papers on its next run.
   */
  const markerProbe = execFileSync(
    "python3",
    ["-c",
      "import sys;from pypdf import PdfReader;" +
      "m=PdfReader(sys.argv[1]).metadata or {};" +
      "print(str(m.get('/AilemyWatermark')))", outIndirect],
    { encoding: "utf8" },
  ).trim();
  t('⚠ the marker value is still "cropbox-v2"', markerProbe === "cropbox-v2", markerProbe);

  // ==========================================================================
  console.log("\n=== 3. same coordinates as a paper the OLD code stamped fine ===");
  // ==========================================================================
  const outDirect = join(tmp, "direct.pdf");
  const directOut = stamp(DIRECT, outDirect);

  const dIndirect = detailOf(indirectOut);
  const dDirect = detailOf(directOut);

  t("⚠ both files report a page-1 detail line",
    dIndirect !== null && dDirect !== null,
    `indirect=${dIndirect !== null} direct=${dDirect !== null}`);

  if (dIndirect && dDirect) {
    /**
     * ⚠ THE PRECONDITION, ASSERTED RATHER THAN ASSUMED. Comparing baselines only
     * means anything if the two pages are the same size. They are the same size
     * to within 0.01pt but NOT character-identical — one producer wrote
     * 595.32001 and the other 595.32 — so this is numeric with a tolerance.
     */
    const sameBox = dIndirect.box.every((v, i) => Math.abs(v - dDirect.box[i]) < 0.01);
    t("⚠ the two papers really do share a page box (else the next check is meaningless)",
      sameBox, `${JSON.stringify(dIndirect.box)} vs ${JSON.stringify(dDirect.box)}`);
    t("⚠ …and the same /Rotate", dIndirect.rotate === dDirect.rotate,
      `${dIndirect.rotate} vs ${dDirect.rotate}`);

    /**
     * ⚠ CHARACTER-EXACT ON THE BASELINE. Two files from different producers,
     * one with indirect /Resources and one inline, land the stamp on the same
     * point. The only reason that holds is that placement is computed from the
     * page box and nothing else — a fix that disturbed geometry moves this.
     */
    t("⚠ indirect and direct /Resources stamp to the SAME baseline, character-exact",
      dIndirect.baseline === dDirect.baseline,
      `indirect ${dIndirect.baseline}\n      direct   ${dDirect.baseline}`);
  }

  /** The spec, restated from the reported numbers rather than trusted. */
  const m = /baseline=\[([\d.]+), ([\d.]+)\]/.exec(indirectOut);
  const box = /box=\[[\d.]+, [\d.]+, ([\d.]+), ([\d.]+)\]/.exec(indirectOut);
  const width = /\(text ([\d.]+)pt wide\)/.exec(indirectOut);
  if (m && box && width) {
    const x = Number(m[1]), y = Number(m[2]);
    const right = Number(box[1]), top = Number(box[2]), w = Number(width[1]);
    t("⚠ x = right − 35.0 − textWidth (RIGHT_INSET unchanged)",
      Math.abs(x - (right - 35.0 - w)) < 0.01, `${x} vs ${right - 35.0 - w}`);
    t("⚠ y = top − 18.0 (TOP_INSET unchanged)",
      Math.abs(y - (top - 18.0)) < 0.01, `${y} vs ${top - 18.0}`);
  } else {
    t("⚠ the stamper reported box/baseline/width to check the spec against", false, indirectOut.slice(0, 200));
  }
  // ==========================================================================
  console.log("\n=== 4. an indirect /Font, which is a separate lookup ===");
  // ==========================================================================
  const outFont = join(tmp, "indirect-font.pdf");
  let fontThrew = "";
  try { stamp(INDIRECT_FONT, outFont); }
  catch (e) { fontThrew = e instanceof Error ? e.message : String(e); }
  t("⚠ stamping a file with an indirect /Font does not throw",
    fontThrew === "", fontThrew.split("\n").slice(-3).join(" ").slice(0, 200));
  if (fontThrew === "") {
    const fi = inspect(outFont);
    t("⚠ …and every page lands correctly by position",
      fi.correct_pages === fi.pages, `${fi.correct_pages} of ${fi.pages}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
