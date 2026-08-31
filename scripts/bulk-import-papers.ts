/**
 * ============================================================================
 * bulk-import-papers.ts — one-off importer for Edexcel IAL Chemistry papers
 * ----------------------------------------------------------------------------
 * NOT part of the app build. Nothing in src/ imports this, and `scripts/` is
 * excluded from tsconfig so a mistake in here can never fail `next build`.
 * It is run directly by Node (v22.6+ strips the types; this repo is on v26):
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/bulk-import-papers.ts --root=/path/to/pdfs
 *
 * DRY RUN IS THE DEFAULT. It reads the disk, resolves the catalogue against the
 * live database, prints every row it would insert, and writes nothing at all —
 * no storage objects, no table rows. Adding --commit is the only thing that
 * makes it write.
 *
 * ---------------------------------------------------------------------------
 * SOURCE LAYOUT
 *   <root>/<subject>/<session>/<year>/<Unit N>/WCH12_01_0122_QU.pdf
 *
 * The filename is authoritative. Directory names are read for exactly one
 * purpose — spotting the SAM folder so it can be skipped — because the folder
 * tree is hand-made and drifts, while the filename comes from Edexcel.
 *
 *   WCH12 _ 01 _ 0122 _ QU .pdf
 *   └─┬─┘   └┬┘   └─┬┘   └┬┘
 *     │      │      │     └── QU = question paper, MS = mark scheme,
 *     │      │      │         ER = examiner report (optional; QU+MS are not)
 *     │      │      └──────── MMYY: month + 2-digit year of the exam series
 *     │      └─────────────── entry code (the "/01" in "WCH12/01")
 *     └────────────────────── paper code; the trailing digit IS the unit number
 *
 * NOTE ON THE SPEC I WAS GIVEN: the brief described this as WCH<unit><entry>,
 * which would read WCH12 as unit 1 / entry 2. It is not — the whole of WCH12 is
 * the paper code and the NEXT field is the entry. The brief's own mapping table
 * (WCH11/12/13 = units 1/2/3) says the same thing, and the ten rows already in
 * past_papers store paper_code as "WCH12/01". The explicit table below is what
 * this script implements; the digits are never used to derive a unit.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT WRITES
 *   Storage: two or three objects per paper — question paper, mark scheme, and
 *            the examiner report where one exists — at the same key shape the
 *            admin form mints, each validated by the app's own isValidPaperPath
 *            before any upload happens.
 *   Table:   one past_papers row per QU+MS pair.
 *
 * Uploads happen before the insert, so a failed insert would strand those
 * objects. The script deletes them itself in that case (see importOne) rather
 * than leaving work for the orphan sweep documented in migration 0016.
 * ============================================================================
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { basename, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);

/**
 * The stamp is applied by scripts/watermark2.py — the SAME implementation
 * watermark-existing-papers.ts drives, shelled out per file rather than ported,
 * so the CropBox anchoring and /Rotate handling exist in exactly one place.
 *
 * Locked spec: "Ailemy.com", top-right, anchored to the CropBox (MediaBox only
 * where a page has no CropBox), text ending 35.00pt inside the right edge,
 * baseline 18.00pt below the top edge, 10.5pt Helvetica, grey 0.72, identical
 * on every page including the cover, no logo, rotated pages mapped through the
 * page rotation matrix so the mark reads horizontally in the visual top-right.
 */
const WATERMARK_PY = resolve("scripts/watermark2.py");

type StampInspection = {
  pages: number;
  correct_pages: number;
  misplaced_pages: number;
  above_cropbox_pages: number;
  already_correct: boolean;
};

async function inspectStamp(file: string): Promise<StampInspection> {
  const { stdout } = await execFileAsync("python3", [WATERMARK_PY, file, "--inspect"], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout) as StampInspection;
}

/**
 * Stamp `src` to `dst` and refuse to return unless every page carries the mark
 * at the current anchor. Nothing reaches the bucket unverified.
 */
async function stampForUpload(src: string, dst: string): Promise<StampInspection> {
  await execFileAsync("python3", [WATERMARK_PY, src, dst, "--force"], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return inspectStamp(dst);
}

// The path scheme and its validator are IMPORTED, never re-implemented. The
// brief asked for keys "matching isValidPaperPath exactly" and a second copy of
// that regex is exactly how the two drift apart.
import {
  PAPERS_BUCKET,
  buildPaperPath,
  isValidPaperPath,
} from "../src/lib/storage/paper-uploads.ts";

// ============================================================================
// CONFIGURATION — read this before running with --commit
// ============================================================================

type PaperCodeInfo = {
  /**
   * ⚠ OPTIONAL, AND ITS ABSENCE IS THE WHOLE BRANCH.
   * ==========================================================================
   * IAL is the only qualification here where the paper code IS the unit:
   * WCH11..WCH16 are units 1..6, one code per unit, one entry ("01") each.
   *
   * Nothing else works that way. Read off the corpus:
   *     8CH0  entries 01 02            GCE AS      — two papers, one code
   *     9CH0  entries 01 02 03         GCE A level — three papers, one code
   *     1CH0  entries 1F 1H 2F 2H      GCSE        — two papers x two tiers
   *     4CH1  entries 1C 1CR 2C 2CR    IGCSE       — two papers x two variants
   *
   * A single unitNumber cannot describe a code that spans two to four distinct
   * papers, so all fourteen new codes omit it. Absent means: resolve the course
   * directly by slug, write NULL unit_id, and slug the paper by its entry.
   */
  unitNumber?: number;
  courseSlug: string;
  level: string;
};

type UnitMetadata = {
  durationMinutes: number;
  totalMarks: number;
  /**
   * TRUE only when the value is corroborated by rows already in past_papers —
   * never when it is merely my recollection of the specification. Committing
   * any unverified row requires --allow-unverified-metadata, because this
   * script writes hundreds of rows at a time and a wrong mark total is
   * invisible once it is in.
   */
  verified: boolean;
};

type SubjectConfig = {
  /** Shown in the run header. */
  label: string;
  /**
   * Paper code -> which unit it is, and which course that unit must belong to.
   *
   * A CHECK, not a lookup: the real course_id/unit_id always come from the
   * database (see loadCatalogue). If the database ever disagrees with this
   * table the run aborts rather than guessing which of the two is right.
   */
  paperCodes: Record<string, PaperCodeInfo>;
  unitMetadata: Record<number, UnitMetadata>;
};

export const SUBJECTS: Record<string, SubjectConfig> = {
  chemistry: {
    label: "Edexcel IAL Chemistry",
    paperCodes: {
      WCH11: { unitNumber: 1, courseSlug: "edexcel-ial-as-chemistry", level: "AS" },
      WCH12: { unitNumber: 2, courseSlug: "edexcel-ial-as-chemistry", level: "AS" },
      WCH13: { unitNumber: 3, courseSlug: "edexcel-ial-as-chemistry", level: "AS" },
      WCH14: { unitNumber: 4, courseSlug: "edexcel-ial-a2-chemistry", level: "A2" },
      WCH15: { unitNumber: 5, courseSlug: "edexcel-ial-a2-chemistry", level: "A2" },
      WCH16: { unitNumber: 6, courseSlug: "edexcel-ial-a2-chemistry", level: "A2" },
    },
    /**
     * Corroboration, from the 71 Chemistry rows now in past_papers:
     *   unit 1 -> 90/80   many rows agree
     *   unit 2 -> 90/80   many rows agree
     *   unit 4 -> 105/90  many rows agree
     *   unit 5 -> 105/90  confirmed by the author 2026-08-06
     *   units 3, 6        no rows, and no WCH13/WCH16 papers on disk — still
     *                     unexercised, hence still unverified.
     */
    unitMetadata: {
      1: { durationMinutes: 90, totalMarks: 80, verified: true },
      2: { durationMinutes: 90, totalMarks: 80, verified: true },
      3: { durationMinutes: 80, totalMarks: 50, verified: false },
      4: { durationMinutes: 105, totalMarks: 90, verified: true },
      5: { durationMinutes: 105, totalMarks: 90, verified: true },
      6: { durationMinutes: 80, totalMarks: 50, verified: false },
    },
  },

  physics: {
    label: "Edexcel IAL Physics",
    paperCodes: {
      WPH11: { unitNumber: 1, courseSlug: "edexcel-ial-as-physics", level: "AS" },
      WPH12: { unitNumber: 2, courseSlug: "edexcel-ial-as-physics", level: "AS" },
      WPH13: { unitNumber: 3, courseSlug: "edexcel-ial-as-physics", level: "AS" },
      WPH14: { unitNumber: 4, courseSlug: "edexcel-ial-a2-physics", level: "A2" },
      WPH15: { unitNumber: 5, courseSlug: "edexcel-ial-a2-physics", level: "A2" },
      WPH16: { unitNumber: 6, courseSlug: "edexcel-ial-a2-physics", level: "A2" },
    },
    /**
     * VERIFIED for units 1, 2, 4 and 5 — read off the question papers and
     * confirmed by the author 2026-08-07. Every Edexcel cover states both
     * fields; across all 76 Physics question papers in the archive each is
     * unanimous within its unit, with no year-to-year variation:
     *
     *   unit 1  WPH11  21 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 2  WPH12  20 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 4  WPH14  18 papers  "Time: 1 hour 45 minutes"  "…is 90"
     *   unit 5  WPH15  17 papers  "Time: 1 hour 45 minutes"  "…is 90"
     *
     * One paper needed care: WPH15_01_0625_QU.pdf carries a two-page
     * Clarification Notice about question 19(b) before the cover, so its
     * values are on page 3. They match the other sixteen.
     *
     * UNITS 3 AND 6 STAY UNVERIFIED. There are no WPH13 or WPH16 papers on
     * disk, so there is nothing to read them off — exactly the position
     * WCH13/WCH16 are in. The numbers below are carried over from the other
     * practical units and are guesses. --commit refuses any row that uses
     * them, which is the point.
     */
    /* superseded — see the block above.
     *
     * The cover sweep read these off every Physics question paper on disk and
     * found each field unanimous within its unit:
     *   unit 1  WPH11  21 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 2  WPH12  20 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 4  WPH14  18 papers  "Time: 1 hour 45 minutes"  "…is 90"
     *   unit 5  WPH15  17 papers  "Time: 1 hour 45 minutes"  "…is 90"
     * Units 3 and 6 have NO papers on disk at all, so their numbers below are
     * pure guesses carried over from the other practical units.
     *
     * The sweep is evidence, not confirmation. These stay `verified: false`
     * until the author says so, exactly as Biology's did — that gate is what
     * caught Biology unit 3's duration being wrong.
     */
    unitMetadata: {
      1: { durationMinutes: 90, totalMarks: 80, verified: true },
      2: { durationMinutes: 90, totalMarks: 80, verified: true },
      3: { durationMinutes: 80, totalMarks: 50, verified: false },
      4: { durationMinutes: 105, totalMarks: 90, verified: true },
      5: { durationMinutes: 105, totalMarks: 90, verified: true },
      6: { durationMinutes: 80, totalMarks: 50, verified: false },
    },
  },

  biology: {
    label: "Edexcel IAL Biology",
    paperCodes: {
      WBI11: { unitNumber: 1, courseSlug: "edexcel-ial-as-biology", level: "AS" },
      WBI12: { unitNumber: 2, courseSlug: "edexcel-ial-as-biology", level: "AS" },
      WBI13: { unitNumber: 3, courseSlug: "edexcel-ial-as-biology", level: "AS" },
      WBI14: { unitNumber: 4, courseSlug: "edexcel-ial-a2-biology", level: "A2" },
      WBI15: { unitNumber: 5, courseSlug: "edexcel-ial-a2-biology", level: "A2" },
      WBI16: { unitNumber: 6, courseSlug: "edexcel-ial-a2-biology", level: "A2" },
    },
    /**
     * VERIFIED against the question papers themselves, then confirmed by the
     * author 2026-08-07. Not corroborated by past_papers — there are still no
     * Biology rows — so the evidence is the covers, which is stronger anyway.
     *
     * Every Edexcel cover states both fields. Read off page 1 of ALL 90 Biology
     * question papers in the archive, both values are unanimous within each
     * unit with no year-to-year variation:
     *
     *   unit 1  WBI11  20 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 2  WBI12  19 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 3  WBI13   9 papers  "Time 1 hour 20 minutes"   "…is 50"
     *   unit 4  WBI14  17 papers  "Time: 1 hour 45 minutes"  "…is 90"
     *   unit 5  WBI15  16 papers  "Time: 1 hour 45 minutes"  "…is 90"
     *   unit 6  WBI16   9 papers  "Time 1 hour 20 minutes"   "…is 50"
     *
     * NOTE ON UNITS 3 AND 6: 1 hour 20 minutes is 80 MINUTES, and the paper is
     * out of 50 MARKS. The two numbers are easy to transpose because the other
     * units pair 80 with marks rather than minutes — 80/50 here means duration
     * 80, marks 50, and the author confirmed that reading explicitly.
     *
     * The earlier draft of this table guessed these by analogy with Chemistry.
     * Five of six guesses happened to be right; unit 3's duration was not, and
     * would have gone in as 80 marks. That is why the gate exists.
     */
    unitMetadata: {
      1: { durationMinutes: 90, totalMarks: 80, verified: true },
      2: { durationMinutes: 90, totalMarks: 80, verified: true },
      3: { durationMinutes: 80, totalMarks: 50, verified: true },
      4: { durationMinutes: 105, totalMarks: 90, verified: true },
      5: { durationMinutes: 105, totalMarks: 90, verified: true },
      6: { durationMinutes: 80, totalMarks: 50, verified: true },
    },
  },
  // ==========================================================================
  // BATCH 1 — GCE, GCSE and International GCSE. Every code here is UNIT-LESS.
  // ==========================================================================
  // ⚠ ONE CONFIG PER (QUALIFICATION, SUBJECT), NOT PER COURSE. A GCE config
  //   holds both its AS and its A-level code, because one --root walk over
  //   folder 2's Chemistry tree contains both and each code names its own
  //   courseSlug. Ten configs, fourteen codes, fourteen courses.
  //
  // ⚠ unitNumber IS OMITTED THROUGHOUT, and that is read off the corpus rather
  //   than assumed: 8CH0 sits entries 01/02, 9CH0 sits 01/02/03, 1CH0 sits
  //   1F/1H/2F/2H and 4CH1 sits 1C/1CR/2C/2CR. One code spans two to four
  //   distinct papers, so no single unit number describes it.
  //
  // ⚠ unitMetadata IS EMPTY, DELIBERATELY. duration_minutes and total_marks
  //   import as NULL. A GCSE Foundation and Higher paper of the same code do
  //   not share a mark total, so any per-code figure would be wrong for half
  //   the rows it wrote. Absent is honest; invented is not.

  "gce-chemistry": {
    label: "Edexcel GCE Chemistry (2015)",
    paperCodes: {
      "8CH0": { courseSlug: "edexcel-gce-as-chemistry", level: "AS" },
      "9CH0": { courseSlug: "edexcel-gce-a2-chemistry", level: "A2" },
    },
    unitMetadata: {},
  },

  "gce-physics": {
    label: "Edexcel GCE Physics (2015)",
    paperCodes: {
      "8PH0": { courseSlug: "edexcel-gce-as-physics", level: "AS" },
      "9PH0": { courseSlug: "edexcel-gce-a2-physics", level: "A2" },
    },
    unitMetadata: {},
  },

  // ⚠ SPEC A IS 8BN0/9BN0 AND SPEC B IS 8BI0/9BI0 — confirmed from the mark
  //   schemes themselves ("GCE in Biology Spec A (8BN0)", "Spec B (8BI0)"),
  //   not from the code letters, which read the other way round.
  "gce-biology-a": {
    label: "Edexcel GCE Biology A (2015)",
    paperCodes: {
      "8BN0": { courseSlug: "edexcel-gce-as-biology-a", level: "AS" },
      "9BN0": { courseSlug: "edexcel-gce-a2-biology-a", level: "A2" },
    },
    unitMetadata: {},
  },

  "gce-biology-b": {
    label: "Edexcel GCE Biology B (2015)",
    paperCodes: {
      "8BI0": { courseSlug: "edexcel-gce-as-biology-b", level: "AS" },
      "9BI0": { courseSlug: "edexcel-gce-a2-biology-b", level: "A2" },
    },
    unitMetadata: {},
  },

  "gcse-chemistry": {
    label: "Edexcel GCSE (9-1) Chemistry",
    paperCodes: { "1CH0": { courseSlug: "edexcel-gcse-chemistry", level: "GCSE" } },
    unitMetadata: {},
  },

  "gcse-biology": {
    label: "Edexcel GCSE (9-1) Biology",
    paperCodes: { "1BI0": { courseSlug: "edexcel-gcse-biology", level: "GCSE" } },
    unitMetadata: {},
  },

  "gcse-physics": {
    label: "Edexcel GCSE (9-1) Physics",
    paperCodes: { "1PH0": { courseSlug: "edexcel-gcse-physics", level: "GCSE" } },
    unitMetadata: {},
  },

  "igcse-chemistry": {
    label: "Edexcel International GCSE (9-1) Chemistry",
    paperCodes: { "4CH1": { courseSlug: "edexcel-igcse-chemistry", level: "IGCSE" } },
    unitMetadata: {},
  },

  "igcse-biology": {
    label: "Edexcel International GCSE (9-1) Biology",
    paperCodes: { "4BI1": { courseSlug: "edexcel-igcse-biology", level: "IGCSE" } },
    unitMetadata: {},
  },

  "igcse-physics": {
    label: "Edexcel International GCSE (9-1) Physics",
    paperCodes: { "4PH1": { courseSlug: "edexcel-igcse-physics", level: "IGCSE" } },
    unitMetadata: {},
  },

  /**
   * ⚠ IAL MATHS AND ENGLISH. unitNumber IS THE DIGIT IN units.name, NOT
   * sort_order — R21, and it is not a style preference.
   *
   * loadCatalogue validates the number against the units row's NAME
   * (bulk-import-papers.ts:933 parses /^\s*Unit\s+(\d+)/ off row.name). The two
   * agree for eighteen of the twenty-two rows and DISAGREE for four: A2 English
   * carries names "Unit 3"/"Unit 4" while its sort_order is 1/2. Reading
   * sort_order there would abort the whole run exactly as the 0077 defect did,
   * because a mismatch pushes a problem and loadCatalogue calls fail().
   *
   * ⚠ unitMetadata IS EMPTY AND THAT IS NOT AN OVERSIGHT. duration_minutes and
   * total_marks are per-unit facts nobody has verified for these subjects yet.
   * An unverified pair would be a guess printed as data, so planRows will skip
   * these papers with "no duration/marks configured" until the real numbers are
   * supplied. Catalogue resolution is unaffected.
   */
  "ial-mathematics": {
    label: "Edexcel IAL Mathematics",
    paperCodes: {
      WMA11: { unitNumber: 1, courseSlug: "edexcel-ial-as-mathematics", level: "AS" },
      WMA12: { unitNumber: 2, courseSlug: "edexcel-ial-as-mathematics", level: "AS" },
      WME01: { unitNumber: 3, courseSlug: "edexcel-ial-as-mathematics", level: "AS" },
      WST01: { unitNumber: 4, courseSlug: "edexcel-ial-as-mathematics", level: "AS" },
      WDM11: { unitNumber: 5, courseSlug: "edexcel-ial-as-mathematics", level: "AS" },
      WMA13: { unitNumber: 1, courseSlug: "edexcel-ial-a2-mathematics", level: "A2" },
      WMA14: { unitNumber: 2, courseSlug: "edexcel-ial-a2-mathematics", level: "A2" },
      WME02: { unitNumber: 3, courseSlug: "edexcel-ial-a2-mathematics", level: "A2" },
      WME03: { unitNumber: 4, courseSlug: "edexcel-ial-a2-mathematics", level: "A2" },
      WST02: { unitNumber: 5, courseSlug: "edexcel-ial-a2-mathematics", level: "A2" },
      WST03: { unitNumber: 6, courseSlug: "edexcel-ial-a2-mathematics", level: "A2" },
    },
    /**
     * ⚠ READ OFF THE PAPERS, NOT THE SPECIFICATION — R31, confirmed by the
     * founder 31 Aug. Every value below was extracted verbatim from the cover
     * page of a staged question paper and reported for confirmation before
     * anything was written here. The type's rule is that `verified: true` must
     * never mean recollection; the corroboration here is the printed cover of
     * the paper itself, which is the source past_papers rows would themselves
     * have been derived from.
     *
     * ⚠ THE TRAILING ARTEFACT IS STRIPPED. The grabbed line read
     * "Time: 1 hour 30 minutes) WMA11/01A" — the bracket and paper code are
     * adjacent text the line-grab swallowed, not part of the duration. The
     * integer minutes are stored, never the line as grabbed.
     */
    unitMetadata: {
      1: { durationMinutes: 90, totalMarks: 75, verified: true },
      2: { durationMinutes: 90, totalMarks: 75, verified: true },
      3: { durationMinutes: 90, totalMarks: 75, verified: true },
      4: { durationMinutes: 90, totalMarks: 75, verified: true },
      5: { durationMinutes: 90, totalMarks: 75, verified: true },
      6: { durationMinutes: 90, totalMarks: 75, verified: true },
    },
  },

  "ial-further-mathematics": {
    label: "Edexcel IAL Further Mathematics",
    paperCodes: {
      WFM01: { unitNumber: 1, courseSlug: "edexcel-ial-as-further-mathematics", level: "AS" },
      WFM02: { unitNumber: 1, courseSlug: "edexcel-ial-a2-further-mathematics", level: "A2" },
      WFM03: { unitNumber: 2, courseSlug: "edexcel-ial-a2-further-mathematics", level: "A2" },
    },
    /** Same source and rule as ial-mathematics above. WFM01/02/03 all 90/75. */
    unitMetadata: {
      1: { durationMinutes: 90, totalMarks: 75, verified: true },
      2: { durationMinutes: 90, totalMarks: 75, verified: true },
    },
  },

  "ial-english-language": {
    label: "Edexcel IAL English Language",
    paperCodes: {
      WEN01: { unitNumber: 1, courseSlug: "edexcel-ial-as-english-language", level: "AS" },
      WEN02: { unitNumber: 2, courseSlug: "edexcel-ial-as-english-language", level: "AS" },
      /** ⚠ 3 and 4, from the NAME. sort_order here is 1 and 2 — see R21 above. */
      WEN03: { unitNumber: 3, courseSlug: "edexcel-ial-a2-english-language", level: "A2" },
      WEN04: { unitNumber: 4, courseSlug: "edexcel-ial-a2-english-language", level: "A2" },
    },
    /**
     * ⚠ ENGLISH LANGUAGE IS THE ONE CONFIG WHERE THE DURATION VARIES BY UNIT:
     * AS units 1-2 print "Time: 1 hour 45 minutes", A2 units 3-4 print
     * "Time: 2 hours". Marks are 50 throughout. Read off the covers per R31.
     */
    unitMetadata: {
      1: { durationMinutes: 105, totalMarks: 50, verified: true },
      2: { durationMinutes: 105, totalMarks: 50, verified: true },
      3: { durationMinutes: 120, totalMarks: 50, verified: true },
      4: { durationMinutes: 120, totalMarks: 50, verified: true },
    },
  },

  "ial-english-literature": {
    label: "Edexcel IAL English Literature",
    paperCodes: {
      WET01: { unitNumber: 1, courseSlug: "edexcel-ial-as-english-literature", level: "AS" },
      WET02: { unitNumber: 2, courseSlug: "edexcel-ial-as-english-literature", level: "AS" },
      /** ⚠ 3 and 4, from the NAME. sort_order here is 1 and 2 — see R21 above. */
      WET03: { unitNumber: 3, courseSlug: "edexcel-ial-a2-english-literature", level: "A2" },
      WET04: { unitNumber: 4, courseSlug: "edexcel-ial-a2-english-literature", level: "A2" },
    },
    /** All four units print "Time: 2 hours" and 50 marks. Read off the covers. */
    unitMetadata: {
      1: { durationMinutes: 120, totalMarks: 50, verified: true },
      2: { durationMinutes: 120, totalMarks: 50, verified: true },
      3: { durationMinutes: 120, totalMarks: 50, verified: true },
      4: { durationMinutes: 120, totalMarks: 50, verified: true },
    },
  },

  /**
   * ⚠ UK GCE MATHS AND ENGLISH — ALL TEN ARE UNIT-LESS. No unitNumber, so each
   * takes the branch at :895: the course is resolved by slug, the level is
   * asserted against the row, and unit_id is written NULL. This is the same
   * path the sixteen existing unit-less codes use, and R22 confirms these need
   * no unit rows at all — creating them would be dead rows.
   *
   * ⚠ 8EL0/9EL0 IS ENGLISH LANGUAGE & LITERATURE, a UK-only combined award with
   * no IAL counterpart. It is why the catalogue is 10 UK courses against 8 IAL.
   *
   * ⚠ unitMetadata IS EMPTY AND STAYS EMPTY (R22) — and for a unit-less code it
   * is never consulted anyway, since :1219 only reads it when unitNumber is
   * defined.
   */
  "gce-mathematics": {
    label: "Edexcel GCE Mathematics (UK)",
    paperCodes: {
      "8MA0": { courseSlug: "edexcel-gce-as-mathematics", level: "AS" },
      "9MA0": { courseSlug: "edexcel-gce-a2-mathematics", level: "A2" },
    },
    unitMetadata: {},
  },

  "gce-further-mathematics": {
    label: "Edexcel GCE Further Mathematics (UK)",
    paperCodes: {
      "8FM0": { courseSlug: "edexcel-gce-as-further-mathematics", level: "AS" },
      "9FM0": { courseSlug: "edexcel-gce-a2-further-mathematics", level: "A2" },
    },
    unitMetadata: {},
  },

  "gce-english-language": {
    label: "Edexcel GCE English Language (UK)",
    paperCodes: {
      "8EN0": { courseSlug: "edexcel-gce-as-english-language", level: "AS" },
      "9EN0": { courseSlug: "edexcel-gce-a2-english-language", level: "A2" },
    },
    unitMetadata: {},
  },

  "gce-english-literature": {
    label: "Edexcel GCE English Literature (UK)",
    paperCodes: {
      "8ET0": { courseSlug: "edexcel-gce-as-english-literature", level: "AS" },
      "9ET0": { courseSlug: "edexcel-gce-a2-english-literature", level: "A2" },
    },
    unitMetadata: {},
  },

  "gce-english-language-and-literature": {
    label: "Edexcel GCE English Language & Literature (UK)",
    paperCodes: {
      "8EL0": { courseSlug: "edexcel-gce-as-english-language-and-literature", level: "AS" },
      "9EL0": { courseSlug: "edexcel-gce-a2-english-language-and-literature", level: "A2" },
    },
    unitMetadata: {},
  },

  "gcse-combined-science": {
    label: "Edexcel GCSE (9-1) Combined Science",
    paperCodes: { "1SC0": { courseSlug: "edexcel-gcse-combined-science", level: "GCSE" } },
    unitMetadata: {},
  },

  "igcse-single-science": {
    label: "Edexcel International GCSE (9-1) Single Science",
    paperCodes: { "4SS0": { courseSlug: "edexcel-igcse-single-science", level: "IGCSE" } },
    unitMetadata: {},
  },
};

/**
 * MM from the filename -> canonical session name.
 *
 * The canonical set is the one the app validates against in
 * src/lib/catalogue/exam-sessions.ts. A month outside this map is skipped with
 * a reason rather than guessed at, so widening it is a deliberate edit here.
 */
const SESSION_BY_MONTH: Record<string, string> = {
  "01": "January",
  "02": "January",
  "05": "May-June",
  "06": "May-June",
  "10": "October-November",
  "11": "October-November",
};

/** Years after this are skipped unless named by --include-year. */
const MAX_YEAR = 2025;

/**
 * Directory names skipped wholesale, matched per path segment.
 *
 * The real trees number their folders for sort order — "1 - SAM",
 * "2 - January" — and Finder has left its own marks: Biology's is
 * "1 - SAM copy". So the comparison strips a leading "<n> - " AND a trailing
 * " copy"/" copy 2" before matching, and ignores case and surrounding space
 * (several of these folders have a trailing space). Without that this list
 * silently matches nothing and the rule only appears to work.
 */
const SKIP_DIRECTORIES = ["SAM"];

function normaliseSegment(segment: string): string {
  return segment
    .replace(/^\s*\d+\s*[-–—.]\s*/, "")
    .replace(/\s+copy(\s+\d+)?\s*$/i, "")
    .trim()
    .toLowerCase();
}

/** The content_status enum from migration 0001. Checked up front so a typo in
 *  --status is one clear error rather than the same Postgres failure per row. */
const CONTENT_STATUS = ["draft", "live", "in_progress", "coming_soon", "archived"];

/** En dash, U+2013 — matches the paper_name of every row already in the table. */
const NAME_DASH = "–";

// ============================================================================
// CLI
// ============================================================================

type Options = {
  root: string;
  subject: string;
  config: SubjectConfig;
  commit: boolean;
  includeYears: Set<number>;
  rateMs: number;
  status: string;
  allowUnverified: boolean;
  reportPath: string;
  limit: number | null;
};

const USAGE = `
bulk-import-papers — import Edexcel IAL past-paper PDFs into Supabase

  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \\
    scripts/bulk-import-papers.ts --root=<folder> [options]

  --root=<path>                 Folder to walk. Required.
  --subject=<${Object.keys(SUBJECTS).join("|")}>  Which subject's papers live under --root.
                                Default chemistry. Decides the paper codes
                                accepted, the course/unit mapping, and the
                                duration/marks table.
  --commit                      Actually upload and insert. Without this the
                                script is a dry run and writes nothing.
  --include-year=2026[,2027]    Allow a year above ${MAX_YEAR}. Repeatable.
  --rate-ms=<n>                 Pause between papers, in ms. Default 300.
  --status=<live|draft|...>     status for new rows. Default live.
  --allow-unverified-metadata   Permit rows whose unit duration/marks are not
                                corroborated by existing data.
  --limit=<n>                   Import at most n papers (useful for a first
                                real run of one or two).
  --report=<path>               JSON report destination.
                                Default ./bulk-import-report.json
  --help
`;

function parseArgs(argv: string[]): Options {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }

  const flags = new Map<string, string[]>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) fail(`Unrecognised argument: ${arg}`);
    const eq = arg.indexOf("=");
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const value = eq === -1 ? "" : arg.slice(eq + 1);
    const existing = flags.get(key);
    if (existing) existing.push(value);
    else flags.set(key, [value]);
  }

  const known = new Set([
    "root",
    "subject",
    "commit",
    "dry-run",
    "include-year",
    "rate-ms",
    "status",
    "allow-unverified-metadata",
    "limit",
    "report",
  ]);
  for (const key of flags.keys()) {
    if (!known.has(key)) fail(`Unrecognised flag: --${key}\n${USAGE}`);
  }

  const root = flags.get("root")?.[0];
  if (!root) fail(`--root is required.\n${USAGE}`);

  /**
   * ⚠ --subject IS REQUIRED. IT USED TO DEFAULT TO CHEMISTRY.
   * ==========================================================================
   * That default was safe when the map held three IAL subjects and every
   * command in use passed --subject anyway. It stops being safe now: the
   * catalogue spans fourteen courses across three qualifications, and a
   * forgotten flag would point a GCSE root at the IAL Chemistry config, match
   * nothing, and report "0 papers" as though the folder were empty. A silent
   * wrong answer, not an error.
   *
   * There is no defensible default across fourteen courses, so there is no
   * default. The failure is now a one-line message before anything is read.
   */
  const subjectFlag = flags.get("subject")?.[0];
  if (!subjectFlag) {
    fail(
      `--subject is required. One of: ${Object.keys(SUBJECTS).join(", ")}\n` +
        `  It no longer defaults to chemistry: with fourteen courses in the catalogue,\n` +
        `  a forgotten flag would silently import nothing and report success.\n${USAGE}`,
    );
  }
  const subject = subjectFlag.toLowerCase();
  const config = SUBJECTS[subject];
  if (!config) {
    fail(`--subject must be one of: ${Object.keys(SUBJECTS).join(", ")} (got "${subject}")`);
  }

  const includeYears = new Set<number>();
  for (const raw of flags.get("include-year") ?? []) {
    for (const part of raw.split(",")) {
      const year = Number(part.trim());
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        fail(`--include-year expects a 4-digit year, got: ${part}`);
      }
      includeYears.add(year);
    }
  }

  const rateRaw = flags.get("rate-ms")?.[0];
  const rateMs = rateRaw === undefined || rateRaw === "" ? 300 : Number(rateRaw);
  if (!Number.isFinite(rateMs) || rateMs < 0) fail("--rate-ms expects a number");

  const limitRaw = flags.get("limit")?.[0];
  const limit =
    limitRaw === undefined || limitRaw === "" ? null : Number(limitRaw);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    fail("--limit expects a positive integer");
  }

  const status = flags.get("status")?.[0] || "live";
  if (!CONTENT_STATUS.includes(status)) {
    fail(`--status must be one of: ${CONTENT_STATUS.join(", ")} (got "${status}")`);
  }

  return {
    root: resolve(root),
    subject,
    config,
    commit: flags.has("commit"),
    includeYears,
    rateMs,
    status,
    allowUnverified: flags.has("allow-unverified-metadata"),
    reportPath: resolve(flags.get("report")?.[0] || "bulk-import-report.json"),
    limit,
  };
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

// ============================================================================
// ENVIRONMENT
// ============================================================================

/**
 * Read .env.local by hand rather than with --env-file.
 *
 * That file is not shell-sourceable and has been hand-edited more than once, so
 * values are trimmed and surrounding quotes stripped. An already-exported
 * variable wins, so a one-off run against a different project needs no edit to
 * the file.
 */
async function loadEnv(): Promise<{ url: string; serviceKey: string }> {
  const fromFile = new Map<string, string>();
  try {
    const raw = await readFile(resolve(".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      fromFile.set(key, value);
    }
  } catch {
    // Absent .env.local is fine when the variables are already exported.
  }

  const read = (key: string) => process.env[key]?.trim() || fromFile.get(key);
  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = read("SUPABASE_SERVICE_ROLE_KEY");

  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL not found in env or .env.local");
  if (!serviceKey) {
    fail("SUPABASE_SERVICE_ROLE_KEY not found in env or .env.local");
  }
  return { url, serviceKey };
}

// ============================================================================
// DISCOVERY
// ============================================================================

export type ParsedFile = {
  absPath: string;
  relPath: string;
  fileName: string;
  code: string;
  entry: string;
  month: string;
  year: number;
  kind: FileKind;
  /** True for a browser/Finder duplicate such as "…_QU (1).pdf". */
  duplicateSuffix: boolean;
  /** Identity of the exam sitting: everything before the QU/MS/ER suffix. */
  pairKey: string;
};

/**
 * QU and MS are both required for a row to import. ER — the examiner report —
 * is optional: it exists for roughly two thirds of the sittings, and the
 * past_papers row has a third slot for it that the paper card already renders.
 * A sitting with no ER imports exactly as it did before.
 */
type FileKind = "QU" | "MS" | "ER";

type Skip = { path: string; reason: string };

/**
 * Filename rule for one subject: <CODE>_<entry>_<MMYY>_<QU|MS|ER>.pdf
 *
 * The trailing " (1)" group is the suffix a browser adds when the same file is
 * downloaded twice, and Finder keeps it on copy. It has to be tolerated: in the
 * Biology tree 29 of the question-paper/mark-scheme slots exist ONLY under a
 * suffixed name, so refusing them silently drops 15 whole papers. It is safe to
 * tolerate because the suffix is captured and, where a sitting somehow offers
 * both forms, planRows prefers the clean one rather than calling it ambiguous.
 */
export function buildFilenameRe(config: SubjectConfig): RegExp {
  const codes = Object.keys(config.paperCodes).join("|");
  /**
   * ⚠ THE ENTRY GROUP IS ALPHANUMERIC, NOT TWO DIGITS. IAL entries are all
   * "01", which is why (\d{2}) held for four folders. GCSE and International
   * GCSE encode the TIER in the entry — 1F/1H, 2BF, 1BR, 2C — so a digits-only
   * group rejects every one of them, and it does so on top of the code
   * alternation rejecting them, which is why the failure looked like one
   * problem rather than two.
   *
   * ⚠ {1,3} IS A CEILING, NOT A GUESS. The longest entry in the corpus is three
   * characters (1SC0's 2BF/2CH/2PH). Leaving it unbounded would let the date
   * group's digits be swallowed by the entry group on a malformed name.
   *
   * ⚠ EVERYTHING ELSE IS UNCHANGED, AND THAT IS WHAT KEEPS THE REJECTIONS. The
   * date group stays (\d{2})(\d{2}), so SAM / EAM / ADDSAM / ADDSAM2 in the date
   * slot still fail, and the 8-digit ISO forms still fail. The type alternation
   * stays (QU|MS|ER), so que/rms/pef and MSC still fail. filename-guard.test.ts
   * asserts those as counts against the real corpus.
   */
  return new RegExp(
    `^(${codes})_([0-9A-Z]{1,3})_(\\d{2})(\\d{2})_(QU|MS|ER)(?: \\((\\d+)\\))?\\.pdf$`,
    "i",
  );
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    // Finder and iCloud litter these through synced folders.
    if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function parseFile(
  absPath: string,
  root: string,
  options: Options,
  filenameRe: RegExp,
  skips: Skip[],
): ParsedFile | null {
  const relPath = relative(root, absPath);
  const fileName = basename(absPath);
  const note = (reason: string) => {
    skips.push({ path: relPath, reason });
    return null;
  };

  const segments = relPath.split(sep).slice(0, -1);
  const skipped = segments.find((s) =>
    SKIP_DIRECTORIES.some((d) => normaliseSegment(d) === normaliseSegment(s)),
  );
  if (skipped) return note(`in a skipped directory (${skipped})`);

  if (!fileName.toLowerCase().endsWith(".pdf")) return note("not a PDF");

  const match = filenameRe.exec(fileName);
  if (!match) {
    const codes = Object.keys(options.config.paperCodes);
    return note(
      `filename does not match <${codes[0]}…${codes[codes.length - 1]}>_<entry>_<MMYY>_<QU|MS|ER>.pdf`,
    );
  }

  const code = match[1].toUpperCase();
  const entry = match[2];
  const month = match[3];
  const year = 2000 + Number(match[4]);
  const kind = match[5].toUpperCase() as FileKind;
  const duplicateSuffix = match[6] !== undefined;

  if (!SESSION_BY_MONTH[month]) {
    return note(`month "${month}" is not a known exam session`);
  }
  if (year > MAX_YEAR && !options.includeYears.has(year)) {
    return note(`year ${year} is after ${MAX_YEAR} (pass --include-year=${year})`);
  }

  return {
    absPath,
    relPath,
    fileName,
    code,
    entry,
    month,
    year,
    kind,
    duplicateSuffix,
    pairKey: `${code}_${entry}_${month}${match[4]}`,
  };
}

// ============================================================================
// CATALOGUE RESOLUTION
// ============================================================================

/**
 * ⚠ unitId IS NULLABLE. past_papers.unit_id has been nullable since 0007
 * ("unit_id uuid REFERENCES units(id) ON DELETE SET NULL"), so a unit-less
 * paper writes NULL rather than pointing at a units row invented to satisfy a
 * lookup. No units rows are created for GCE, GCSE or IGCSE.
 */
type Resolved = { unitId: string | null; courseId: string };

/**
 * Turn every paper code the run actually needs into real ids, and abort if any
 * of it is missing or contradicts the subject's paperCodes table.
 *
 * units.code holds exactly the paper code — "WCH11".."WCH16" for Chemistry,
 * "WBI11".."WBI16" for Biology — so the unit resolves directly and carries its
 * own course_id, with no guessing from names. The declared mapping is then
 * asserted against what came back: course slug, level, and the unit number
 * parsed out of units.name must all agree, or the run stops.
 */
async function loadCatalogue(
  db: SupabaseClient,
  needed: Set<string>,
  config: SubjectConfig,
): Promise<Map<string, Resolved>> {
  /**
   * ⚠ TWO RESOLUTION PATHS, CHOSEN BY WHETHER THE CODE DECLARES A UNIT.
   * ==========================================================================
   * UNIT PATH (IAL, unchanged): units.code holds the paper code, the unit
   *   carries its own course_id, and the declared unit number is asserted
   *   against units.name. All 233 existing rows came through here.
   *
   * COURSE PATH (GCE / GCSE / IGCSE): there is no unit and none is invented.
   *   The course is read straight from courses.slug and unitId is NULL.
   *   The unit-number assertion does not run — there is no unit to assert.
   *
   * The split is on config, not on data: a code either declares unitNumber or
   * it does not. That keeps the IAL path byte-identical rather than making it a
   * special case of a looser one.
   */
  const unitCodes = [...needed].filter((c) => config.paperCodes[c]?.unitNumber !== undefined);
  const courseOnlyCodes = [...needed].filter((c) => config.paperCodes[c]?.unitNumber === undefined);

  const { data, error } = unitCodes.length
    ? await db
        .from("units")
        .select("id, code, name, course:courses(id, slug, level)")
        .in("code", unitCodes)
    : { data: [], error: null };

  if (error) {
    fail(`Could not read units from the database: ${error.message}`);
  }

  /**
   * ⚠ COURSES ARE READ BY SLUG, AND ONLY THE SLUGS THIS RUN NEEDS. The declared
   * level is then asserted against the row exactly as the unit path does, so a
   * course whose level disagrees with the config stops the run rather than
   * importing papers under the wrong qualification.
   */
  const wantedCourseSlugs = [...new Set(courseOnlyCodes.map((c) => config.paperCodes[c]!.courseSlug))];
  const courseBySlug = new Map<string, { id: string; slug: string; level: string }>();
  if (wantedCourseSlugs.length) {
    const { data: courseRows, error: courseError } = await db
      .from("courses")
      .select("id, slug, level")
      .in("slug", wantedCourseSlugs);
    if (courseError) {
      fail(`Could not read courses from the database: ${courseError.message}`);
    }
    for (const row of (courseRows ?? []) as { id: string; slug: string; level: string }[]) {
      courseBySlug.set(row.slug, row);
    }
  }

  type Row = {
    id: string;
    code: string | null;
    name: string;
    course: { id: string; slug: string; level: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const byCode = new Map<string, Row>();
  for (const row of rows) {
    if (!row.code) continue;
    const key = row.code.toUpperCase();
    if (byCode.has(key)) {
      fail(
        `Ambiguous catalogue: two units both have code ${key}. ` +
          `Resolve the duplicate before importing.`,
      );
    }
    byCode.set(key, row);
  }

  const resolved = new Map<string, Resolved>();
  const problems: string[] = [];

  for (const code of needed) {
    const expected = config.paperCodes[code];
    if (!expected) {
      problems.push(`${code}: not a paper code this subject declares`);
      continue;
    }

    /**
     * ⚠ THE COURSE PATH. No units lookup, no unit-number assertion, NULL
     * unitId. The level check is kept because it is the one assertion that
     * still means something without a unit: it catches a GCSE code pointed at
     * an AS course.
     */
    if (expected.unitNumber === undefined) {
      const course = courseBySlug.get(expected.courseSlug);
      if (!course) {
        problems.push(`${code}: no course row with slug ${expected.courseSlug}`);
        continue;
      }
      if (course.level !== expected.level) {
        problems.push(
          `${code}: expected level ${expected.level}, database says ${course.level}`,
        );
        continue;
      }
      resolved.set(code, { unitId: null, courseId: course.id });
      continue;
    }

    const row = byCode.get(code);
    if (!row) {
      problems.push(`${code}: no unit row with that code`);
      continue;
    }
    if (!row.course) {
      problems.push(`${code}: unit ${row.id} has no course`);
      continue;
    }
    if (row.course.slug !== expected.courseSlug) {
      problems.push(
        `${code}: expected course ${expected.courseSlug}, database says ${row.course.slug}`,
      );
      continue;
    }
    if (row.course.level !== expected.level) {
      problems.push(
        `${code}: expected level ${expected.level}, database says ${row.course.level}`,
      );
      continue;
    }
    // units.name begins "Unit N:" — the same source the paper list card reads.
    const unitNumber = Number(/^\s*Unit\s+(\d+)/i.exec(row.name)?.[1]);
    if (unitNumber !== expected.unitNumber) {
      problems.push(
        `${code}: expected unit ${expected.unitNumber}, database name is ${JSON.stringify(row.name)}`,
      );
      continue;
    }
    resolved.set(code, { unitId: row.id, courseId: row.course.id });
  }

  if (problems.length) {
    fail(
      "Catalogue does not match the expected mapping:\n" +
        problems.map((p) => `    • ${p}`).join("\n"),
    );
  }
  return resolved;
}

// ============================================================================
// PLANNING
// ============================================================================

type PlannedRow = {
  id: string;
  courseId: string;
  /** NULL for GCE / GCSE / IGCSE — no units row is created for them. */
  unitId: string | null;
  code: string;
  /** undefined for a unit-less code; see PaperCodeInfo.unitNumber. */
  unitNumber: number | undefined;
  entry: string;
  slug: string;
  session: string;
  year: number;
  paperCode: string;
  paperName: string;
  /** NULL where unitMetadata has no entry — recorded as absent, never guessed. */
  durationMinutes: number | null;
  totalMarks: number | null;
  metadataVerified: boolean;
  questionPaper: ParsedFile;
  markScheme: ParsedFile;
  /** Optional — most but not all sittings have one. */
  examinerReport: ParsedFile | null;
  paperPath: string;
  markschemePath: string;
  examinerReportPath: string | null;
};

function slugify(session: string): string {
  return session.toLowerCase().replace(/\s+/g, "-");
}

/**
 * The past_papers slug for one sitting. THE ONLY PLACE EITHER SCHEME IS WRITTEN.
 *
 * ============================================================================
 * ⚠ EXPORTED SO THE REGRESSION TEST MINTS THROUGH THIS FUNCTION RATHER THAN
 * REBUILDING THE TEMPLATE. It was inline in planRows; a test would then have had
 * to re-type `unit-${n}-${session}-${year}`, and a copy of a format string
 * agrees with itself for ever — the exact failure AGENTS.md names. Extracting it
 * changes no behaviour and makes the two schemes assertable.
 *
 * ⚠ THE IAL SCHEME IS LOAD-BEARING ON LIVE URLS. All 233 existing rows carry
 * unit-<n>-<session>-<year> and past_papers.slug is user-facing at
 * /past-papers/<slug>. Changing it renames live pages.
 *
 * ⚠ THE UNIT-LESS SCHEME MUST CARRY THE ENTRY. 9CH0 sits entries 01/02/03 in one
 * session and 1CH0 sits 1F/1H/2F/2H; without the entry all of them mint one
 * slug and planRows' clash handler refuses every one, because for IAL two
 * entries of one unit genuinely ARE ambiguous and for GCSE they are not.
 *
 * ⚠ THE TWO SCHEMES CANNOT COLLIDE BY CONSTRUCTION: the IAL form begins with the
 * literal "unit-", the unit-less form begins with a lowercased Edexcel paper
 * code, and no Edexcel code is the string "unit". import-slugs.test.ts asserts
 * that over the whole corpus rather than trusting the argument.
 */
export function paperSlug(
  args: { unitNumber: number | undefined; code: string; entry: string; session: string; year: number },
): string {
  const { unitNumber, code, entry, session, year } = args;
  return unitNumber === undefined
    ? `${code}-${entry}-${slugify(session)}-${year}`.toLowerCase()
    : `unit-${unitNumber}-${slugify(session)}-${year}`;
}

/**
 * Of several files claiming the same slot, take the one with a clean name.
 *
 * "…_QU.pdf" always beats "…_QU (1).pdf". Only when every candidate is a
 * duplicate — which is the common case in the Biology tree, where 29 slots have
 * no clean copy at all — does a suffixed file get used, and then the single
 * remaining one is unambiguous. Returns null when the choice is genuinely
 * undecidable, i.e. two or more equally-clean names.
 */
/** One tie broken by content identity, recorded so the run can report it. */
export type TieBreak = {
  pairKey: string;
  kind: FileKind;
  md5: string;
  chosen: string;
  discarded: string[];
  chosenDepth: number;
  discardedDepth: number;
};

/**
 * ⚠ CONTENT IDENTITY, NOT PATH PREFERENCE. This hashes the candidates and only
 * breaks the tie when every one is byte-identical.
 *
 * Folder 4 files the same paper twice: once under a dated tree
 * (3 - June/Chemistry/2018/Foundation/) and once under a flat mirror
 * (Chemistry/C1/). Measured across all 96 ambiguous 1CH0 keys, every pair had
 * the same size, the same page count and the same MD5, and the flat mirror's
 * byte total was exactly the sum of the two dated trees. Either candidate is
 * the same document, so the choice cannot change what gets imported.
 *
 * ⚠ AND WHEN THEY DIFFER, IT REFUSES. A path rule applied to candidates with
 * different content would silently pick one version of a document that exists
 * in two versions — the one failure mode this whole check exists to prevent.
 * Non-identical candidates return null and block exactly as before.
 */
function pickByContent(candidates: ParsedFile[]): { chosen: ParsedFile; tie: TieBreak } | null {
  const hashes = candidates.map((f) => ({
    file: f,
    md5: createHash("md5").update(readFileSync(f.absPath)).digest("hex"),
    depth: f.relPath.split(sep).length,
  }));
  const distinct = new Set(hashes.map((h) => h.md5));
  if (distinct.size !== 1) return null; // genuine content conflict — block.

  /**
   * ⚠ DEEPEST PATH WINS, and the tie-break among equal depths is the path
   * string, so the choice is deterministic run to run. The dated tree carries
   * session, year and tier in its directories; the flat mirror carries none of
   * that. Neither is used to derive any field — the filename is authoritative —
   * but a stable, meaningful choice is easier to audit than an arbitrary one.
   */
  const sorted = [...hashes].sort(
    (a, b) => b.depth - a.depth || a.file.relPath.localeCompare(b.file.relPath),
  );
  const chosen = sorted[0];
  return {
    chosen: chosen.file,
    tie: {
      pairKey: chosen.file.pairKey,
      kind: chosen.file.kind,
      md5: chosen.md5,
      chosen: chosen.file.relPath,
      discarded: sorted.slice(1).map((h) => h.file.relPath),
      chosenDepth: chosen.depth,
      discardedDepth: sorted[1]?.depth ?? -1,
    },
  };
}

export function pickOne(candidates: ParsedFile[], ties?: TieBreak[]): ParsedFile | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const clean = candidates.filter((f) => !f.duplicateSuffix);
  if (clean.length === 1) return clean[0];

  /**
   * ⚠ THE SUFFIX RULE STILL RUNS FIRST. "…_QU.pdf" beats "…_QU (1).pdf"
   * without reading either file; only a tie between equally-clean names reaches
   * the content check, so the common case costs no I/O.
   */
  const pool = clean.length > 1 ? clean : candidates;
  const byContent = pickByContent(pool);
  if (byContent === null) return null;
  ties?.push(byContent.tie);
  return byContent.chosen;
}

/**
 * Pair QU with MS, drop anything unpaired, and shape the rows.
 *
 * Pairing is global rather than per-directory: the pair key carries the paper
 * code, entry and MMYY, which identifies a sitting on its own, so a mark scheme
 * filed under the wrong year folder still finds its paper. A slot that stays
 * ambiguous after pickOne is refused rather than resolved by guessing.
 */
function planRows(
  files: ParsedFile[],
  catalogue: Map<string, Resolved>,
  config: SubjectConfig,
  skips: Skip[],
  now: () => number,
  /**
   * ⚠ TIES ARE REPORTED, NEVER SILENT. Every content-identical tie-break is
   * pushed here and printed by the run. A resolution nobody can see is a
   * resolution nobody can audit.
   */
  ties: TieBreak[] = [],
): PlannedRow[] {
  const groups = new Map<
    string,
    { QU: ParsedFile[]; MS: ParsedFile[]; ER: ParsedFile[] }
  >();
  for (const file of files) {
    let group = groups.get(file.pairKey);
    if (!group) groups.set(file.pairKey, (group = { QU: [], MS: [], ER: [] }));
    group[file.kind].push(file);
  }

  const rows: PlannedRow[] = [];
  /**
   * ⚠ KEYED ON (courseId, slug), NOT slug ALONE — R34.
   * ==========================================================================
   * past_papers enforces UNIQUE (course_id, slug): a slug is unique PER COURSE,
   * not globally. This map is the planner's mirror of that constraint, so it
   * must use the same key. Keyed on slug alone it treats two rows in DIFFERENT
   * courses as a clash and discards one.
   *
   * ⚠ IT COST 114 COMPONENTS BEFORE IT WAS FOUND. IAL Maths numbers its units
   * per course — AS 1-5, A2 1-6 — so `unit-1-may-june-2025` is legitimately
   * minted by both WMA11 (P1, AS) and WMA13 (P3, A2). The course-blind key
   * skipped P3, P4, M2, S1, S2 and FP2 as duplicates of unrelated AS units.
   *
   * ⚠ SCIENCE HID IT FOR MONTHS. Science IAL numbers units 1-6 CONTINUOUSLY
   * across AS and A2 (AS 1,2,3 / A2 4,5,6), so no Science slug can ever
   * collide across courses. 233 papers imported through this path without
   * exercising the bug once — green by absence, not by design.
   */
  const bySlug = new Map<string, PlannedRow>();
  const slugKey = (courseId: string, slug: string) => `${courseId}::${slug}`;

  for (const [pairKey, group] of [...groups].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const all = [...group.QU, ...group.MS, ...group.ER];

    // QU and MS are both required. An examiner report without them is not a
    // paper, so it is reported alongside whatever else was orphaned.
    if (group.QU.length === 0) {
      for (const f of [...group.MS, ...group.ER]) {
        skips.push({ path: f.relPath, reason: `no question paper for ${pairKey}` });
      }
      continue;
    }
    if (group.MS.length === 0) {
      for (const f of [...group.QU, ...group.ER]) {
        skips.push({ path: f.relPath, reason: `no mark scheme for ${pairKey}` });
      }
      continue;
    }
    const questionPaper = pickOne(group.QU, ties);
    const markScheme = pickOne(group.MS, ties);
    if (!questionPaper || !markScheme) {
      for (const f of all) {
        skips.push({
          path: f.relPath,
          reason: `ambiguous — ${group.QU.length} QU and ${group.MS.length} MS share the key ${pairKey}, none clearly canonical`,
        });
      }
      continue;
    }

    // The examiner report is optional, so an ambiguous one costs only itself:
    // the paper still imports, just without an ER rather than not at all.
    const examinerReport = pickOne(group.ER, ties);
    if (!examinerReport && group.ER.length > 0) {
      for (const f of group.ER) {
        skips.push({
          path: f.relPath,
          reason: `ambiguous — ${group.ER.length} examiner reports share the key ${pairKey}; importing the paper without one`,
        });
      }
    }
    const resolved = catalogue.get(questionPaper.code);
    if (!resolved) continue; // loadCatalogue already aborted on anything missing.

    /**
     * ⚠ GUARDED, BECAUSE THE UNGUARDED FORM WAS A TypeError WAITING FOR A
     * MISSPELLING. This read `const { unitNumber } = config.paperCodes[code]`
     * with no check — an unknown code destructures undefined and crashes the
     * whole run mid-import, after some uploads have already happened. :1008
     * already guards the same lookup; this now matches it.
     *
     * loadCatalogue aborts earlier on anything unknown, so in practice this is
     * unreachable today — which is exactly why it was easy to leave unguarded,
     * and exactly why it must not stay that way once fourteen courses share the
     * path. Skip and report; never throw, never insert.
     */
    const codeInfo = config.paperCodes[questionPaper.code];
    if (!codeInfo) {
      for (const f of all) {
        skips.push({ path: f.relPath, reason: `unknown paper code ${questionPaper.code} — not declared by ${config.label}` });
      }
      continue;
    }
    const { unitNumber } = codeInfo;
    const session = SESSION_BY_MONTH[questionPaper.month];

    /**
     * ⚠ DURATION AND MARKS ARE NULL FOR A UNIT-LESS CODE, NOT INVENTED.
     * ========================================================================
     * unitMetadata is keyed by unit number and there is no unit, so there is no
     * entry to read and none is added. past_papers.duration_minutes and
     * total_marks are both nullable (0007) with a CHECK that only bites on a
     * non-null non-positive value (0015), so NULL is a legal, honest "not
     * recorded". A GCSE Foundation and Higher paper do not even share a mark
     * total, so a per-code figure would be wrong for half the rows it wrote.
     */
    const meta = unitNumber === undefined ? null : config.unitMetadata[unitNumber];
    if (unitNumber !== undefined && !meta) {
      for (const f of all) {
        skips.push({ path: f.relPath, reason: `no duration/marks configured for unit ${unitNumber}` });
      }
      continue;
    }

    /**
     * ⚠ TWO SLUG SCHEMES, AND THE IAL ONE IS UNTOUCHED.
     * ========================================================================
     * IAL keeps unit-<n>-<session>-<year>. All 233 existing rows carry that
     * shape and past_papers.slug is user-facing at /past-papers/<slug>, so
     * changing it would break live URLs for a rename.
     *
     * A unit-less code needs the ENTRY in the slug or its papers collide: 9CH0
     * sits entries 01, 02 and 03 in one session, and 1CH0 sits 1F, 1H, 2F and
     * 2H. Under the IAL scheme all three 9CH0 papers would mint the same slug
     * and the clash handler below would refuse all of them — Foundation and
     * Higher are two different papers, not an ambiguity.
     */
    const slug = paperSlug({
      unitNumber,
      code: questionPaper.code,
      entry: questionPaper.entry,
      session,
      year: questionPaper.year,
    });

    // On the IAL path the slug deliberately omits the entry code, so two entries
    // of the same unit and sitting collapse onto one slug. Refuse both rather
    // than let the second silently lose to a unique-constraint skip. On the
    // course path the entry IS in the slug, so a clash here is a real duplicate.
    const clash = bySlug.get(slugKey(resolved.courseId, slug));
    if (clash) {
      for (const f of all) {
        skips.push({
          path: f.relPath,
          reason: `slug ${slug} already claimed in this run by ${clash.questionPaper.fileName}`,
        });
      }
      continue;
    }

    const id = crypto.randomUUID();
    const paperPath = buildPaperPath(id, "paper", now());
    const markschemePath = buildPaperPath(id, "markscheme", now());
    const examinerReportPath = examinerReport
      ? buildPaperPath(id, "examiner-report", now())
      : null;

    // The app refuses to store a path it could not have minted. Assert here so
    // a bad key is a planning-time abort, not a half-uploaded paper.
    for (const path of [paperPath, markschemePath, examinerReportPath]) {
      if (path !== null && !isValidPaperPath(path)) {
        fail(`Built an invalid storage path: ${path} — refusing to continue.`);
      }
    }

    const row: PlannedRow = {
      id,
      courseId: resolved.courseId,
      unitId: resolved.unitId,
      code: questionPaper.code,
      unitNumber,
      entry: questionPaper.entry,
      slug,
      session,
      year: questionPaper.year,
      paperCode: `${questionPaper.code}/${questionPaper.entry}`,
      /**
       * Matches the ten rows already in the table, en dash included. A unit-less
       * paper is named by its entry instead, because "Unit undefined" is worse
       * than saying which paper it actually is.
       */
      paperName: unitNumber === undefined
        ? `${session} ${questionPaper.year} ${NAME_DASH} Paper ${questionPaper.entry.toUpperCase()} Question Paper`
        : `${session} ${questionPaper.year} ${NAME_DASH} Unit ${unitNumber} Question Paper`,
      durationMinutes: meta ? meta.durationMinutes : null,
      totalMarks: meta ? meta.totalMarks : null,
      /**
       * ⚠ NULL METADATA IS "VERIFIED" IN THE ONLY SENSE THAT MATTERS HERE — it
       * asserts nothing, so it cannot assert something wrong. The
       * --allow-unverified-metadata gate exists to stop a WRONG number being
       * written to hundreds of rows; an absent number is not that risk, and
       * making it fail the gate would block every GCE/GCSE/IGCSE paper on a
       * flag whose purpose is unrelated.
       */
      metadataVerified: meta ? meta.verified : true,
      questionPaper,
      markScheme,
      examinerReport,
      paperPath,
      markschemePath,
      examinerReportPath,
    };
    rows.push(row);
    bySlug.set(slugKey(resolved.courseId, slug), row);
  }

  /**
   * ⚠ UNIT-LESS ROWS SORT BY CODE THEN ENTRY, because they have no unit number
   * to sort on and `undefined - undefined` is NaN, which makes a comparator
   * return NaN and leaves the order unspecified. The IAL ordering is unchanged.
   */
  return rows.sort(
    (a, b) =>
      (a.unitNumber ?? Number.MAX_SAFE_INTEGER) - (b.unitNumber ?? Number.MAX_SAFE_INTEGER) ||
      a.code.localeCompare(b.code) ||
      a.entry.localeCompare(b.entry) ||
      a.year - b.year ||
      a.session.localeCompare(b.session),
  );
}

/**
 * Drop rows whose (course_id, slug) is already taken.
 *
 * The unique constraint is the real guard and is still caught at insert time,
 * but checking first means an existing paper costs nothing — no PDF is read,
 * and no storage object is created only to be deleted again.
 */
async function dropExisting(
  db: SupabaseClient,
  rows: PlannedRow[],
  skips: Skip[],
): Promise<PlannedRow[]> {
  if (rows.length === 0) return rows;

  const { data, error } = await db
    .from("past_papers")
    .select("slug, course_id")
    .in("slug", [...new Set(rows.map((r) => r.slug))]);

  if (error) fail(`Could not read existing past_papers: ${error.message}`);

  const taken = new Set(
    ((data ?? []) as { slug: string; course_id: string }[]).map(
      (r) => `${r.course_id}::${r.slug}`,
    ),
  );

  return rows.filter((row) => {
    if (!taken.has(`${row.courseId}::${row.slug}`)) return true;
    skips.push({
      path: row.questionPaper.relPath,
      reason: `${row.slug} already exists in past_papers`,
    });
    return false;
  });
}


/**
 * Dry-run audit: the full per-row picture, plus the gates that must hold before
 * a single byte is written. Every one of these ABORTS the run rather than
 * skipping the row — an import that silently drops papers is worse than one
 * that stops and says why.
 */
async function auditRows(
  db: SupabaseClient,
  rows: PlannedRow[],
  config: SubjectConfig,
  subject: string,
): Promise<number> {
  // Existing (course_id, slug) pairs, to catch a duplicate before it is made.
  const { data: existing, error: exErr } = await db
    .from("past_papers")
    .select("slug, course_id, paper_code");
  if (exErr) fail(`could not read past_papers for the duplicate check: ${exErr.message}`);
  const taken = new Set(
    ((existing ?? []) as { slug: string; course_id: string }[]).map(
      (r) => `${r.course_id}::${r.slug}`,
    ),
  );

  const blocked: { row: PlannedRow; reasons: string[] }[] = [];

  console.log("\nPER-ROW DETAIL — every source file, and the row it would create\n");
  for (const [i, row] of rows.entries()) {
    const reasons: string[] = [];

    // Gate: %PDF- header on every source file.
    const files: [string, ParsedFile | null, string][] = [
      ["question paper", row.questionPaper, row.paperPath],
      ["mark scheme", row.markScheme, row.markschemePath],
      ["examiner report", row.examinerReport, row.examinerReportPath ?? ""],
    ];
    const pageCounts: Record<string, number | string> = {};
    for (const [kind, file] of files) {
      if (!file) continue;
      const fd = await readFile(file.absPath);
      if (fd.subarray(0, 5).toString() !== "%PDF-") {
        reasons.push(`${kind}: missing %PDF- header (${JSON.stringify(fd.subarray(0, 5).toString())})`);
      }
      try {
        pageCounts[kind] = (await inspectStamp(file.absPath)).pages;
      } catch (e) {
        pageCounts[kind] = "unreadable";
        reasons.push(`${kind}: unreadable — ${(e as Error).message.split("\n")[0]}`);
      }
    }

    // Gate: the paper code must be one this subject declares.
    if (!config.paperCodes[row.code]) {
      reasons.push(`paper code ${row.code} is not declared for --subject=${subject}`);
    }

    // Gate: duration and marks must be real, not placeholders. A value that is
    // present but unverified is treated as missing: it is a guess, and a wrong
    // mark total is invisible once several hundred rows carry it.
    /**
     * ⚠ THE GATE ONLY APPLIES WHERE A NUMBER IS BEING CLAIMED. It exists to stop
     * a WRONG duration or mark total reaching hundreds of rows. A unit-less
     * paper claims neither — both columns go in NULL — so there is nothing to
     * be wrong about, and failing it here would block every GCE/GCSE/IGCSE
     * paper on a flag about placeholder accuracy.
     */
    if (row.unitNumber !== undefined) {
      const meta = config.unitMetadata[row.unitNumber];
      if (!meta) reasons.push(`no duration/marks configured for unit ${row.unitNumber}`);
      else if (!meta.durationMinutes || !meta.totalMarks) {
        reasons.push(`unit ${row.unitNumber}: duration_minutes or total_marks is empty`);
      } else if (!meta.verified) {
        reasons.push(
          `unit ${row.unitNumber}: duration_minutes=${meta.durationMinutes} / total_marks=${meta.totalMarks} are UNVERIFIED placeholders`,
        );
      }
    }

    // Gate: no duplicate against an existing row.
    if (taken.has(`${row.courseId}::${row.slug}`)) {
      reasons.push(`duplicate — a past_papers row already exists for this course and slug ${row.slug}`);
    }

    console.log(
      `[${i + 1}/${rows.length}] ${row.slug}\n` +
      `    sources : ${row.questionPaper.relPath}  (${pageCounts["question paper"] ?? "-"}p)\n` +
      `              ${row.markScheme.relPath}  (${pageCounts["mark scheme"] ?? "-"}p)\n` +
      (row.examinerReport
        ? `              ${row.examinerReport.relPath}  (${pageCounts["examiner report"] ?? "-"}p)\n`
        : `              (no examiner report)\n`) +
      `    parsed  : ${row.paperCode}   ${row.session}   ${row.year}   ` +
      `${row.unitNumber === undefined ? "(no unit)" : `unit ${row.unitNumber}`}\n` +
      `    storage : ${row.paperPath}\n` +
      `              ${row.markschemePath}\n` +
      (row.examinerReportPath ? `              ${row.examinerReportPath}\n` : "") +
      `    row     : slug=${row.slug}  paper_code=${row.paperCode}  session=${row.session}  year=${row.year}\n` +
      `              paper_name=${JSON.stringify(row.paperName)}\n` +
      /**
       * ⚠ READ OFF THE ROW, NOT OFF A `meta` THAT NO LONGER EXISTS HERE. The
       * metadata lookup is now inside the unit-only branch above, and
       * row.metadataVerified already carries its answer. NULL/NULL prints as
       * "not recorded" rather than "UNVERIFIED", because they are different
       * claims: one says nothing, the other says something unchecked.
       */
      `              duration_minutes=${row.durationMinutes ?? "NULL"}  total_marks=${row.totalMarks ?? "NULL"}` +
      `  (${row.durationMinutes === null && row.totalMarks === null
            ? "not recorded"
            : row.metadataVerified ? "verified" : "UNVERIFIED"})\n` +
      `    -> ${reasons.length ? "BLOCKED — " + reasons.join("; ") : "ready"}`,
    );

    if (reasons.length) blocked.push({ row, reasons });
  }

  if (blocked.length) {
    const byReason = new Map<string, number>();
    for (const b of blocked)
      for (const r of b.reasons) {
        const k = r.replace(/unit \d+/, "unit N").replace(/slug \S+/, "slug …");
        byReason.set(k, (byReason.get(k) ?? 0) + 1);
      }
    console.error(`\n✖ ABORT — ${blocked.length} of ${rows.length} row(s) are blocked:\n`);
    for (const [reason, n] of [...byReason].sort((a, b) => b[1] - a[1])) {
      console.error(`    ${n} × ${reason}`);
    }
  }
  return blocked.length;
}

// ============================================================================
// IMPORT
// ============================================================================

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function uploadPdf(
  db: SupabaseClient,
  fullPath: string,
  bytes: Buffer,
): Promise<void> {
  // buildPaperPath already includes the bucket segment, and storage-js prepends
  // the bucket again in _getFinalPath. That double prefix is not a bug to fix
  // here — it is the existing convention: every stored path in past_papers is
  // "papers/<uuid>/..." and every object in the bucket lives under a top-level
  // "papers/" folder. Passing the path verbatim is what reproduces it.
  const { error } = await db.storage
    .from(PAPERS_BUCKET)
    .upload(fullPath, bytes, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`upload ${fullPath}: ${error.message}`);
}

async function importOne(
  db: SupabaseClient,
  row: PlannedRow,
  status: string,
): Promise<"inserted" | "conflict"> {
  // Stamp BEFORE upload. The bytes that reach the bucket are the stamped ones;
  // the local originals are never modified.
  const work = await mkdtemp(join(tmpdir(), "ailemy-import-"));
  // Each of these conditions ENDS THE RUN rather than skipping the file. A
  // stamp landing wrong is a fault in the geometry or the source, not bad luck
  // with one PDF, and continuing would spread it across the rest of the import
  // before anyone read the log. Nothing has been uploaded at this point, so the
  // abort leaves the bucket untouched.
  const stampLog: string[] = [];
  const stampTo = async (srcPath: string, tag: string) => {
    const out = join(work, `${tag}.pdf`);
    const insp = await stampForUpload(srcPath, out);
    const bytes = await readFile(out);
    const bad: string[] = [];
    if (insp.correct_pages !== insp.pages)
      bad.push(`correct ${insp.correct_pages} != pages ${insp.pages}`);
    if (insp.misplaced_pages) bad.push(`misplaced ${insp.misplaced_pages}`);
    if (insp.above_cropbox_pages) bad.push(`above CropBox ${insp.above_cropbox_pages}`);
    if (bytes.length < 1024) bad.push(`${bytes.length} bytes (< 1KB)`);
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      bad.push(`header ${JSON.stringify(bytes.subarray(0, 5).toString())}`);

    if (bad.length) {
      console.error(
        `\n✖ STAMP VERIFICATION FAILED — ${row.slug} · ${tag}\n` +
          `    source : ${srcPath}\n` +
          `    pages ${insp.pages}  correct ${insp.correct_pages}  misplaced ${insp.misplaced_pages}  above ${insp.above_cropbox_pages}  bytes ${bytes.length}\n` +
          `    ${bad.join("; ")}\n` +
          `    Nothing was uploaded for this row.`,
      );
      await rm(work, { recursive: true, force: true });
      fail("aborting the whole run.");
    }
    stampLog.push(`${tag} ${insp.pages}p correct=${insp.correct_pages} mis=${insp.misplaced_pages} above=${insp.above_cropbox_pages} ${bytes.length}B`);
    return bytes;
  };

  const [paperBytes, markschemeBytes, examinerReportBytes] = await Promise.all([
    stampTo(row.questionPaper.absPath, "paper"),
    stampTo(row.markScheme.absPath, "markscheme"),
    row.examinerReport ? stampTo(row.examinerReport.absPath, "examiner-report") : null,
  ]);

  const uploaded: string[] = [];
  try {
    await uploadPdf(db, row.paperPath, paperBytes);
    uploaded.push(row.paperPath);
    await uploadPdf(db, row.markschemePath, markschemeBytes);
    uploaded.push(row.markschemePath);
    if (row.examinerReportPath && examinerReportBytes) {
      await uploadPdf(db, row.examinerReportPath, examinerReportBytes);
      uploaded.push(row.examinerReportPath);
    }

    const { error } = await db.from("past_papers").insert({
      id: row.id,
      course_id: row.courseId,
      unit_id: row.unitId,
      slug: row.slug,
      year: row.year,
      session: row.session,
      paper_code: row.paperCode,
      paper_name: row.paperName,
      paper_pdf_path: row.paperPath,
      markscheme_pdf_path: row.markschemePath,
      examiner_report_pdf_path: row.examinerReportPath,
      duration_minutes: row.durationMinutes,
      total_marks: row.totalMarks,
      status,
    });

    if (error) {
      // 23505 = unique_violation on (course_id, slug). The brief asks for this
      // to skip rather than end the run, so a re-run after a partial import is
      // safe. dropExisting catches almost all of these first; this covers a row
      // created between that read and this write.
      if (error.code === "23505") {
        await removeObjects(db, uploaded);
        return "conflict";
      }
      throw new Error(`insert ${row.slug}: ${error.message} (${error.code})`);
    }
    console.log(`      ${stampLog.join("\n      ")}`);
    return "inserted";
  } catch (err) {
    // Never leave objects behind for a row that does not exist.
    await removeObjects(db, uploaded);
    throw err;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function removeObjects(db: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await db.storage.from(PAPERS_BUCKET).remove(paths);
  if (error) {
    console.warn(
      `  ! could not clean up ${paths.join(", ")}: ${error.message}\n` +
        `    Sweep it with the orphan query in supabase/migrations/0016_papers_bucket_rls.sql`,
    );
  }
}

// ============================================================================
// OUTPUT
// ============================================================================

function printTable(rows: PlannedRow[]) {
  const header = [
    "#",
    "slug",
    "paper_code",
    "session",
    "year",
    "dur",
    "marks",
    "question paper",
    "mark scheme",
    "examiner report",
  ];
  const body = rows.map((row, i) => [
    String(i + 1),
    row.slug,
    row.paperCode,
    row.session,
    String(row.year),
    `${row.durationMinutes}${row.metadataVerified ? "" : "?"}`,
    `${row.totalMarks}${row.metadataVerified ? "" : "?"}`,
    row.questionPaper.fileName,
    row.markScheme.fileName,
    row.examinerReport?.fileName ?? "—",
  ]);

  const widths = header.map((h, c) =>
    Math.max(h.length, ...body.map((r) => r[c].length)),
  );
  const line = (cells: string[]) =>
    "  " + cells.map((c, i) => c.padEnd(widths[i])).join("  ");

  console.log(line(header));
  console.log("  " + widths.map((w) => "─".repeat(w)).join("  "));
  for (const r of body) console.log(line(r));
}

function printSkips(skips: Skip[]) {
  if (skips.length === 0) {
    console.log("\nSkipped: none.");
    return;
  }
  const byReason = new Map<string, Skip[]>();
  for (const skip of skips) {
    // Collapse the variable tail so the summary groups by kind of problem.
    const bucket = skip.reason.replace(/\(.*\)|\b[\w-]+\.pdf\b|unit-[\w-]+/g, "…");
    const list = byReason.get(bucket) ?? [];
    list.push(skip);
    byReason.set(bucket, list);
  }

  console.log(`\nSkipped ${skips.length} file(s):`);
  for (const [reason, list] of [...byReason].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(`\n  ${list.length} × ${reason}`);
    for (const skip of list.slice(0, 10)) {
      console.log(`      ${skip.path}`);
      if (skip.reason !== reason) console.log(`        ↳ ${skip.reason}`);
    }
    if (list.length > 10) console.log(`      … and ${list.length - 10} more`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { url, serviceKey } = await loadEnv();

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\nSubject: ${options.config.label}  (--subject=${options.subject})`);
  console.log(`Root   : ${options.root}`);
  console.log(`Mode   : ${options.commit ? "COMMIT — writes to Supabase" : "DRY RUN — writes nothing"}`);
  console.log(`Status : ${options.status}`);
  if (options.includeYears.size) {
    console.log(`Years  : ${MAX_YEAR} and earlier, plus ${[...options.includeYears].join(", ")}`);
  } else {
    console.log(`Years  : ${MAX_YEAR} and earlier`);
  }

  // ---- discover -----------------------------------------------------------
  let allPaths: string[];
  try {
    allPaths = await walk(options.root);
  } catch (err) {
    return fail(`Could not read --root: ${(err as Error).message}`);
  }

  const skips: Skip[] = [];
  const parsed: ParsedFile[] = [];
  const filenameRe = buildFilenameRe(options.config);
  for (const path of allPaths.sort()) {
    const file = parseFile(path, options.root, options, filenameRe, skips);
    if (file) parsed.push(file);
  }
  console.log(`\nFound ${allPaths.length} file(s); ${parsed.length} match the paper naming scheme.`);
  if (parsed.length === 0) {
    printSkips(skips);
    await writeReport(options, [], skips, "no-matching-files");
    return;
  }

  // ---- resolve ------------------------------------------------------------
  const needed = new Set(parsed.map((f) => f.code));
  const catalogue = await loadCatalogue(db, needed, options.config);
  console.log(
    `Resolved ${catalogue.size} paper code(s) against the catalogue: ${[...needed].sort().join(", ")}`,
  );

  // ---- plan ---------------------------------------------------------------
  let counter = 0;
  // Distinct timestamps keep the two keys of a pair apart, and keep every key
  // in a run unique even when the loop runs inside one millisecond.
  const now = () => Date.now() + counter++;

  const ties: TieBreak[] = [];
  let rows = planRows(parsed, catalogue, options.config, skips, now, ties);

  /**
   * ⚠ EVERY TIE BROKEN BY CONTENT IS PRINTED. The founder's rule is "report the
   * choice, don't make it silently" — a resolution nobody sees is a resolution
   * nobody can audit, and this one discards a real file from a real run.
   *
   * Only byte-identical candidates reach here; anything else blocked upstream
   * and appears in the skips list as an ambiguity, unchanged.
   */
  if (ties.length) {
    console.log(`\n${ties.length} tie(s) broken by content identity — candidates were byte-identical:`);
    for (const t of ties) {
      console.log(`  ${t.pairKey} ${t.kind}  md5=${t.md5.slice(0, 12)}`);
      console.log(`      kept    (depth ${t.chosenDepth})  ${t.chosen}`);
      for (const d of t.discarded) console.log(`      dropped (depth ${t.discardedDepth})  ${d}`);
    }
  }

  rows = await dropExisting(db, rows, skips);
  if (options.limit !== null && rows.length > options.limit) {
    const dropped = rows.slice(options.limit);
    for (const row of dropped) {
      skips.push({ path: row.questionPaper.relPath, reason: `beyond --limit=${options.limit}` });
    }
    console.log(`\n--limit=${options.limit}: ${dropped.length} further row(s) held back.`);
    rows = rows.slice(0, options.limit);
  }

  if (rows.length === 0) {
    console.log("\nNothing to import.");
    printSkips(skips);
    await writeReport(options, [], skips, "nothing-to-import");
    return;
  }

  const withEr = rows.filter((r) => r.examinerReport).length;
  console.log(`\n${rows.length} row(s) to insert:\n`);
  printTable(rows);
  console.log(
    `\n${withEr} of ${rows.length} row(s) carry an examiner report; ${rows.length - withEr} have none.`,
  );

  // ---- unverified metadata gate ------------------------------------------
  const unverified = rows.filter((r) => !r.metadataVerified);
  if (unverified.length) {
    const units = [...new Set(unverified.map((r) => r.unitNumber))].sort();
    console.log(
      `\n⚠  ${unverified.length} row(s) carry UNVERIFIED duration/marks (marked "?" above).` +
        `\n   Unit(s) ${units.join(", ")} have no corroborating row in past_papers — the values come` +
        `\n   from SUBJECTS.${options.subject}.unitMetadata at the top of this script and nothing` +
        `\n   has checked them. Confirm them against the specification before committing.`,
    );
    if (options.commit && !options.allowUnverified) {
      printSkips(skips);
      fail(
        `Refusing to commit unverified metadata. Either correct ` +
          `SUBJECTS.${options.subject}.unitMetadata, or re-run with ` +
          `--allow-unverified-metadata once you have checked it.`,
      );
    }
  }

  // ---- dry run stops here -------------------------------------------------
  if (!options.commit) {
    const blockedCount = await auditRows(db, rows, options.config, options.subject);
    printSkips(skips);
    console.log(
      `\nSUMMARY  files found ${allPaths.length}` +
      `  |  parseable ${parsed.length}` +
      `  |  rows planned ${rows.length}` +
      `  |  ready to import ${rows.length - blockedCount}` +
      `  |  blocked ${blockedCount}`,
    );
    console.log("\nDRY RUN — nothing was stamped, uploaded or inserted.");
    await writeReport(options, rows, skips, "dry-run");
    if (blockedCount) process.exitCode = 1;
    return;
  }
  if (false) {
    printSkips(skips);
    console.log("\nDRY RUN — nothing was uploaded and nothing was inserted.");
    console.log("Re-run with --commit to write.\n");
    await writeReport(options, rows, skips, "dry-run");
    return;
  }

  // ---- commit -------------------------------------------------------------
  console.log(`\nImporting ${rows.length} paper(s)…\n`);
  let inserted = 0;
  let conflicts = 0;
  const failures: { slug: string; error: string }[] = [];

  for (const [i, row] of rows.entries()) {
    const label = `[${i + 1}/${rows.length}] ${row.slug}`;
    try {
      const result = await importOne(db, row, options.status);
      if (result === "inserted") {
        inserted++;
        console.log(`${label} ✓ inserted`);
      } else {
        conflicts++;
        console.log(`${label} — skipped, slug already exists`);
        skips.push({ path: row.questionPaper.relPath, reason: `${row.slug} already exists (unique violation at insert)` });
      }
    } catch (err) {
      const message = (err as Error).message;
      failures.push({ slug: row.slug, error: message });
      console.error(`${label} ✖ ${message}`);
    }
    if (options.rateMs) await sleep(options.rateMs);
  }

  console.log(
    `\nDone. ${inserted} inserted, ${conflicts} already existed, ${failures.length} failed.`,
  );
  printSkips(skips);
  await writeReport(options, rows, skips, "commit", failures);
  if (failures.length) process.exitCode = 1;
}

async function writeReport(
  options: Options,
  rows: PlannedRow[],
  skips: Skip[],
  mode: string,
  failures: { slug: string; error: string }[] = [],
) {
  const report = {
    mode,
    subject: options.subject,
    root: options.root,
    committed: options.commit,
    planned: rows.map((r) => ({
      slug: r.slug,
      paper_code: r.paperCode,
      session: r.session,
      year: r.year,
      unit: r.unitNumber,
      duration_minutes: r.durationMinutes,
      total_marks: r.totalMarks,
      metadata_verified: r.metadataVerified,
      paper_pdf_path: r.paperPath,
      markscheme_pdf_path: r.markschemePath,
      examiner_report_pdf_path: r.examinerReportPath,
      source_question_paper: r.questionPaper.relPath,
      source_mark_scheme: r.markScheme.relPath,
      source_examiner_report: r.examinerReport?.relPath ?? null,
    })),
    skipped: skips,
    failures,
  };
  await writeFile(options.reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nReport written to ${options.reportPath}`);
}

/**
 * ⚠ main() RUNS ONLY WHEN THIS FILE IS THE ENTRY POINT.
 * ============================================================================
 * It used to run on import. filename-guard.test.ts imports buildFilenameRe and
 * SUBJECTS so it tests the REAL regex rather than a copy of it — AGENTS.md is
 * explicit that a model of production behaviour has to be the production thing
 * or it agrees with itself for ever. Without this guard, importing the module
 * to read one function would START AN IMPORT RUN, which reads a disk tree,
 * talks to the database, and with --commit uploads to Storage.
 *
 * The comparison is against process.argv[1] resolved to a file URL, so it holds
 * whether the script is invoked by path, by relative path, or through a
 * symlink.
 */
const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((err) => {
    console.error("\n✖ Unhandled failure:", err);
    process.exit(1);
  });
}
