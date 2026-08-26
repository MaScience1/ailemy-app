/**
 * The two slug schemes: the IAL one must not have moved, and the two must not
 * be able to collide.
 *
 * ============================================================================
 * ⚠ MINTED THROUGH paperSlug(), NEVER REBUILT. The format string exists in one
 * place and this file imports it. Re-typing `unit-${n}-${session}-${year}` here
 * would produce a test that agrees with itself whatever the importer does.
 *
 * ⚠ WHAT THE FIVE FIXTURE ROWS ARE, HONESTLY. They are real (paper_code, year,
 * session) triples read out of the live past_papers table on 2026-08-27 — the
 * owner ran the query and pasted the rows. The SLUG for each is DERIVED here
 * from the IAL scheme rather than read from the database: the query returned
 * paper_code/year/session, not slug, and I have no database access to fetch it.
 *
 * So this asserts "the function still mints what the scheme says for real
 * inputs", which is the regression that matters, and it does NOT independently
 * confirm the 233 stored slugs match. If the owner ever pastes real slug values
 * they should replace the derived column and this note should go.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { SUBJECTS, buildFilenameRe, paperSlug } from "../../bulk-import-papers.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

// ============================================================================
console.log("\n=== 1. IAL slug regression — five real sittings, character-exact ===");
// ============================================================================
{
  /**
   * ⚠ THE UNIT NUMBER IS READ FROM SUBJECTS, NOT TYPED. WCH11 is unit 1 because
   * the config says so; if someone renumbers a unit this fixture follows and the
   * expected string below stops matching, which is the point.
   */
  const unitOf = (code: string): number => {
    for (const cfg of Object.values(SUBJECTS)) {
      const info = cfg.paperCodes[code];
      if (info?.unitNumber !== undefined) return info.unitNumber;
    }
    throw new Error(`no unit number declared for ${code}`);
  };

  /** Real rows from past_papers, owner-supplied 2026-08-27. */
  const FIXTURE = [
    { code: "WBI11", year: 2019, session: "January",          expect: "unit-1-january-2019" },
    { code: "WBI12", year: 2025, session: "October-November", expect: "unit-2-october-november-2025" },
    { code: "WBI13", year: 2023, session: "May-June",         expect: "unit-3-may-june-2023" },
    { code: "WBI15", year: 2020, session: "October-November", expect: "unit-5-october-november-2020" },
    { code: "WCH11", year: 2022, session: "May-June",         expect: "unit-1-may-june-2022" },
  ];

  for (const f of FIXTURE) {
    const got = paperSlug({
      unitNumber: unitOf(f.code),
      code: f.code,
      entry: "01",
      session: f.session,
      year: f.year,
    });
    t(`⚠ ${f.code} ${f.session} ${f.year} -> "${f.expect}"`, got === f.expect, got);
  }

  /**
   * ⚠ THE ENTRY MUST NOT REACH AN IAL SLUG. Every one of the 233 stored slugs
   * omits it, so if the IAL branch ever started including the entry the URLs
   * would all change. Minting the same sitting with a different entry must
   * produce the identical string.
   */
  const a = paperSlug({ unitNumber: 1, code: "WCH11", entry: "01", session: "May-June", year: 2022 });
  const b = paperSlug({ unitNumber: 1, code: "WCH11", entry: "02", session: "May-June", year: 2022 });
  t("⚠ the IAL slug ignores the entry (two entries, one slug — as the 233 are)",
    a === b && a === "unit-1-may-june-2022", `${a} vs ${b}`);

  /** And it ignores the code, for the same reason. */
  t("⚠ the IAL slug ignores the paper code too",
    paperSlug({ unitNumber: 4, code: "WBI14", entry: "01", session: "January", year: 2021 }) ===
    paperSlug({ unitNumber: 4, code: "WPH14", entry: "01", session: "January", year: 2021 }),
    "codes produced different IAL slugs");
}

// ============================================================================
console.log("\n=== 2. cross-scheme collision — over the whole in-scope corpus ===");
// ============================================================================
{
  const CORPUS = "/Users/muhammed/Desktop/Ailemy/Exams";
  const UNITLESS_FOLDERS = [
    "2 - GCE AS and A level from 2015",
    "4 - GCSE (9-1) ",
    "8 - International GCSE (9-1)",
  ];
  const IAL_FOLDER = "7 - International edexcel from 2018 ";

  if (!existsSync(CORPUS)) {
    console.log("\n  SKIPPED — the paper corpus is not on this machine.\n");
    process.exit(2);
  }

  const names = (root: string): string[] => {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        if (e.startsWith(".") || e === "__MACOSX") continue;
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (e.toLowerCase().endsWith(".pdf")) out.push(e);
      }
    };
    if (existsSync(root)) walk(root);
    return out;
  };

  const SESSION_BY_MONTH: Record<string, string> = {
    "01": "January", "02": "January",
    "05": "May-June", "06": "May-June",
    "10": "October-November", "11": "October-November",
  };

  /** Parse a released filename into the fields paperSlug needs, or null. */
  const parse = (name: string) => {
    for (const cfg of Object.values(SUBJECTS)) {
      const m = buildFilenameRe(cfg).exec(name);
      if (!m) continue;
      const code = m[1].toUpperCase();
      const info = cfg.paperCodes[code];
      const session = SESSION_BY_MONTH[m[3]];
      if (!info || !session) return null;
      return {
        unitNumber: info.unitNumber,
        code,
        entry: m[2],
        session,
        year: 2000 + Number(m[4]),
      };
    }
    return null;
  };

  /**
   * ⚠ SLUGS ARE PER PAPER, FILES ARE PER DOCUMENT. One paper is a QU, an MS and
   * usually an ER — three files, one past_papers row, one slug. So the papers
   * are keyed on (code, entry, session, year) FIRST and the slug minted per
   * paper. My first draft compared slug count against FILE count and reported
   * 958 "collisions" that were just QU/MS/ER triples collapsing correctly.
   */
  const mint = (folders: string[]) => {
    const papers = new Map<string, ReturnType<typeof parse>>();
    let files = 0;
    for (const f of folders) {
      for (const n of new Set(names(join(CORPUS, f)))) {
        const p = parse(n);
        if (!p) continue;
        files++;
        papers.set(`${p.code}|${p.entry}|${p.session}|${p.year}`, p);
      }
    }
    const slugs = new Set<string>();
    const byCourseSlug = new Set<string>();
    for (const p of papers.values()) {
      if (!p) continue;
      const slug = paperSlug(p);
      slugs.add(slug);
      byCourseSlug.add(`${courseOf(p.code)}::${slug}`);
    }
    return { slugs, papers, files, byCourseSlug };
  };

  /** The course a code imports into — from SUBJECTS, never typed here. */
  function courseOf(code: string): string {
    for (const cfg of Object.values(SUBJECTS)) {
      const info = cfg.paperCodes[code];
      if (info) return info.courseSlug;
    }
    return "(unknown)";
  }

  const unitless = mint(UNITLESS_FOLDERS);
  const ial = mint([IAL_FOLDER]);

  t("⚠ unit-less slugs were actually minted (else the disjointness is vacuous)",
    unitless.slugs.size > 400, `${unitless.slugs.size} slugs / ${unitless.papers.size} papers / ${unitless.files} files`);
  /**
   * ⚠ 94 IS CORRECT AND MY FIRST THRESHOLD OF 200 WAS NOT. The IAL scheme omits
   * BOTH the code and the entry, so unit-1-january-2019 is shared by Chemistry,
   * Biology and Physics. IAL slugs are unique PER COURSE, which is exactly what
   * past_papers enforces — UNIQUE (course_id, slug) from 0007 — not globally.
   * Asserting global uniqueness would have been asserting the wrong invariant.
   */
  t("⚠ IAL slugs were actually minted (same reason)",
    ial.slugs.size > 50, `${ial.slugs.size} slugs / ${ial.papers.size} papers / ${ial.files} files`);
  t("⚠ IAL slugs are NOT globally unique, and that is by design",
    ial.slugs.size < ial.papers.size,
    `${ial.slugs.size} slugs for ${ial.papers.size} papers — expected fewer slugs than papers`);
  t("⚠ …but they ARE unique per course, which is what UNIQUE (course_id, slug) enforces",
    ial.byCourseSlug.size === ial.papers.size,
    `${ial.byCourseSlug.size} course+slug pairs for ${ial.papers.size} papers`);

  const overlap = [...unitless.slugs].filter((s) => ial.slugs.has(s));
  t(`⚠ ZERO collisions across ${unitless.slugs.size} unit-less and ${ial.slugs.size} IAL slugs`,
    overlap.length === 0, overlap.slice(0, 5).join(", "));

  /**
   * ⚠ AND THE STRUCTURAL REASON, ASSERTED SEPARATELY. Disjointness on today's
   * corpus could be luck. Every IAL slug begins "unit-" and no unit-less slug
   * can, because it begins with a lowercased Edexcel paper code and no code is
   * the string "unit".
   */
  t("⚠ every IAL slug begins \"unit-\"",
    [...ial.slugs].every((s) => s.startsWith("unit-")),
    [...ial.slugs].filter((s) => !s.startsWith("unit-")).slice(0, 3).join(", "));
  t("⚠ no unit-less slug begins \"unit-\"",
    [...unitless.slugs].every((s) => !s.startsWith("unit-")),
    [...unitless.slugs].filter((s) => s.startsWith("unit-")).slice(0, 3).join(", "));

  /**
   * ⚠ AND UNIT-LESS SLUGS ARE ONE-PER-PAPER, which is the property that made the
   * entry mandatory. 9CH0 sits entries 01/02/03 in one session; drop the entry
   * and those three papers collapse onto one slug and planRows refuses all of
   * them. Compared against PAPERS, not files.
   */
  t("⚠ every unit-less paper gets its own slug (no self-collision)",
    unitless.slugs.size === unitless.papers.size,
    `${unitless.slugs.size} slugs for ${unitless.papers.size} papers`);
  t("⚠ …and unique per course too",
    unitless.byCourseSlug.size === unitless.papers.size,
    `${unitless.byCourseSlug.size} course+slug pairs for ${unitless.papers.size} papers`);

  /**
   * ⚠ THE ENTRY IS WHAT DOES IT — proved by removing it. Minting the same
   * unit-less papers under the IAL-style entry-free shape must produce FEWER
   * slugs than papers, i.e. real collisions. If it does not, the entry is not
   * load-bearing and the scheme could have been simpler.
   */
  const withoutEntry = new Set(
    [...unitless.papers.values()].filter(Boolean).map((p) => `${p!.code}-${slugifyLocal(p!.session)}-${p!.year}`.toLowerCase()),
  );
  t("⚠ dropping the entry WOULD collide (so the entry is load-bearing)",
    withoutEntry.size < unitless.papers.size,
    `${withoutEntry.size} slugs for ${unitless.papers.size} papers — expected fewer`);
}

function slugifyLocal(session: string): string {
  return session.toLowerCase().replace(/\s+/g, "-");
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
