/**
 * Maths and English enter SUBJECTS. This file is the guard, and it is a NEW
 * file rather than additions to import-catalogue.test.ts.
 *
 * ============================================================================
 * ⚠ WHY A SEPARATE FILE. The existing suites assert Science-shaped facts —
 * "exactly N unit-less codes", "the eighteen IAL codes still declare a unit".
 * Adding subjects moves those numbers, and the cheap repair is to relax the
 * assertion until it stops complaining. That is how a guard dies. The counts
 * that genuinely moved are restated in their own file with the cause recorded;
 * everything SPECIFIC to Maths and English lives here, where a future Science
 * change cannot quietly weaken it and vice versa.
 *
 * ⚠ THE CONFIG IS IMPORTED, NEVER RETYPED. SUBJECTS, buildFilenameRe and
 * paperSlug are the things under test.
 *
 * ⚠ NO DATABASE, NO NETWORK, NO WRITES. Catalogue resolution against the live
 * table was proven separately by dry runs of the real importer (22/22 IAL unit
 * codes, 10/10 UK codes). These are the pure-config guards; a test cannot reach
 * production and should not pretend to.
 */
import { SUBJECTS, buildFilenameRe, paperSlug } from "../../bulk-import-papers.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const all = Object.entries(SUBJECTS).flatMap(([key, cfg]) =>
  Object.entries(cfg.paperCodes).map(([code, info]) => ({ key, code, ...info })),
);
const byCode = new Map(all.map((r) => [r.code, r]));
const anyAccepts = (n: string) =>
  Object.values(SUBJECTS).some((c) => buildFilenameRe(c).test(n));

const IAL_NEW = ["WMA11","WMA12","WME01","WST01","WDM11","WMA13","WMA14","WME02","WME03",
                 "WST02","WST03","WFM01","WFM02","WFM03","WEN01","WEN02","WEN03","WEN04",
                 "WET01","WET02","WET03","WET04"];
const UK_NEW  = ["8MA0","9MA0","8FM0","9FM0","8EN0","9EN0","8ET0","9ET0","8EL0","9EL0"];

// ============================================================================
console.log("\n=== 1. the codes are declared, on the right side of the branch ===");
// ============================================================================
{
  t("⚠ all 22 IAL codes are declared", IAL_NEW.every((c) => byCode.has(c)),
    IAL_NEW.filter((c) => !byCode.has(c)).join(", "));
  t("⚠ all 10 UK GCE codes are declared", UK_NEW.every((c) => byCode.has(c)),
    UK_NEW.filter((c) => !byCode.has(c)).join(", "));
  /**
   * ⚠ THE BRANCH IS THE WHOLE DESIGN. A declared unitNumber routes to the unit
   * lookup at :829; its absence routes to course-by-slug at :895 with a NULL
   * unit_id. Putting a UK code on the unit path would send it looking for a
   * units row that does not exist and abort the run.
   */
  t("⚠ every IAL code declares a unitNumber",
    IAL_NEW.every((c) => byCode.get(c)?.unitNumber !== undefined),
    IAL_NEW.filter((c) => byCode.get(c)?.unitNumber === undefined).join(", "));
  t("⚠ every UK GCE code is UNIT-LESS",
    UK_NEW.every((c) => byCode.get(c)?.unitNumber === undefined),
    UK_NEW.filter((c) => byCode.get(c)?.unitNumber !== undefined).join(", "));
}

// ============================================================================
console.log("\n=== 2. units.code ambiguity is GLOBAL, not per subject ===");
// ============================================================================
{
  /**
   * ⚠ loadCatalogue does `.in("code", unitCodes)` at :829, UNSCOPED BY COURSE.
   * A code declared twice anywhere makes the lookup ambiguous and sends papers
   * to whichever row the query happens to return. So this counts across the
   * WHOLE of SUBJECTS, not within a config.
   */
  const seen = new Map<string, string[]>();
  for (const r of all) {
    if (!seen.has(r.code)) seen.set(r.code, []);
    seen.get(r.code)!.push(r.key);
  }
  const dupes = [...seen].filter(([, ks]) => ks.length > 1);
  t("⚠ no paper code is declared in two configs", dupes.length === 0,
    dupes.map(([c, ks]) => `${c}: ${ks.join("+")}`).join(", "));
  t("⚠ …and the check is not vacuous (codes exist to collide)", all.length > 60, all.length);
}

// ============================================================================
console.log("\n=== 3. unitNumber is the NAME digit, not sort_order (R21) ===");
// ============================================================================
{
  /**
   * ⚠ THE FOUR A2 ENGLISH ROWS ARE THE WHOLE POINT. loadCatalogue parses
   * /^\s*Unit\s+(\d+)/ off units.name at :933 and compares. A2 English carries
   * names "Unit 3"/"Unit 4" while its sort_order is 1/2. Declaring sort_order
   * here aborts the entire run — demonstrated by sabotage on WEN03, which
   * produced: `WEN03: expected unit 1, database name is "Unit 3: English
   * Language"` and exit 1.
   */
  const EXPECT: Record<string, [number, string]> = {
    WMA11: [1, "edexcel-ial-as-mathematics"], WMA12: [2, "edexcel-ial-as-mathematics"],
    WME01: [3, "edexcel-ial-as-mathematics"], WST01: [4, "edexcel-ial-as-mathematics"],
    WDM11: [5, "edexcel-ial-as-mathematics"],
    WMA13: [1, "edexcel-ial-a2-mathematics"], WMA14: [2, "edexcel-ial-a2-mathematics"],
    WME02: [3, "edexcel-ial-a2-mathematics"], WME03: [4, "edexcel-ial-a2-mathematics"],
    WST02: [5, "edexcel-ial-a2-mathematics"], WST03: [6, "edexcel-ial-a2-mathematics"],
    WFM01: [1, "edexcel-ial-as-further-mathematics"],
    WFM02: [1, "edexcel-ial-a2-further-mathematics"], WFM03: [2, "edexcel-ial-a2-further-mathematics"],
    WEN01: [1, "edexcel-ial-as-english-language"], WEN02: [2, "edexcel-ial-as-english-language"],
    WEN03: [3, "edexcel-ial-a2-english-language"], WEN04: [4, "edexcel-ial-a2-english-language"],
    WET01: [1, "edexcel-ial-as-english-literature"], WET02: [2, "edexcel-ial-as-english-literature"],
    WET03: [3, "edexcel-ial-a2-english-literature"], WET04: [4, "edexcel-ial-a2-english-literature"],
  };
  const wrong = Object.entries(EXPECT).filter(([c, [n, slug]]) =>
    byCode.get(c)?.unitNumber !== n || byCode.get(c)?.courseSlug !== slug);
  t("⚠ all 22 map to the expected unitNumber AND course", wrong.length === 0,
    wrong.map(([c]) => `${c}: ${byCode.get(c)?.unitNumber}/${byCode.get(c)?.courseSlug}`).join(", "));
  t("⚠ A2 English is 3 and 4 — NOT its sort_order of 1 and 2",
    [["WEN03",3],["WEN04",4],["WET03",3],["WET04",4]].every(([c, n]) => byCode.get(c as string)?.unitNumber === n),
    ["WEN03","WEN04","WET03","WET04"].map((c) => `${c}=${byCode.get(c)?.unitNumber}`).join(" "));
  /** AS English is 1 and 2, where name and sort_order happen to agree. */
  t("⚠ …while AS English is 1 and 2, where the two agree",
    byCode.get("WEN01")?.unitNumber === 1 && byCode.get("WET02")?.unitNumber === 2);
}

// ============================================================================
console.log("\n=== 4. course and level assignment ===");
// ============================================================================
{
  t("⚠ every UK code names a UK GCE course slug",
    UK_NEW.every((c) => byCode.get(c)!.courseSlug.startsWith("edexcel-gce-")),
    UK_NEW.filter((c) => !byCode.get(c)!.courseSlug.startsWith("edexcel-gce-")).join(", "));
  t("⚠ every IAL code names an IAL course slug",
    IAL_NEW.every((c) => byCode.get(c)!.courseSlug.startsWith("edexcel-ial-")),
    IAL_NEW.filter((c) => !byCode.get(c)!.courseSlug.startsWith("edexcel-ial-")).join(", "));
  /** An 8-prefixed code is AS, a 9-prefixed code is A2. loadCatalogue asserts
   *  the level against the course row, so a swap aborts the run. */
  const levelWrong = [...IAL_NEW, ...UK_NEW].filter((c) => {
    const r = byCode.get(c)!;
    const expected = /^(8|W..1[123]|WME01|WST01|WDM11|WFM01|WEN0[12]|WET0[12])/.test(c) ? "AS" : "A2";
    return r.level !== expected && !/^9/.test(c);
  }).filter((c) => byCode.get(c)!.level !== (/^9/.test(c) ? "A2" : byCode.get(c)!.level));
  t("⚠ every 9-prefixed UK code is A2 and every 8-prefixed is AS",
    UK_NEW.every((c) => byCode.get(c)!.level === (c.startsWith("9") ? "A2" : "AS")),
    UK_NEW.map((c) => `${c}=${byCode.get(c)!.level}`).join(" "));
  t("⚠ AS courses hold AS codes and A2 courses hold A2 codes",
    IAL_NEW.every((c) => {
      const r = byCode.get(c)!;
      return r.courseSlug.includes("-as-") ? r.level === "AS" : r.level === "A2";
    }), levelWrong.join(", "));
}

// ============================================================================
console.log("\n=== 5. filenames: UK numeric entries, Further Maths alphanumeric ===");
// ============================================================================
{
  const uk = ["8MA0_01_0625_QU.pdf","9MA0_02_0625_MS.pdf","8EN0_01_0625_ER.pdf",
              "9ET0_01_1125_QU.pdf","8EL0_02_0125_MS.pdf"];
  t("⚠ UK numeric entries parse", uk.every(anyAccepts),
    uk.filter((n) => !anyAccepts(n)).join(", "));
  /**
   * ⚠ FURTHER MATHS OPTION ENTRIES ARE THE REASON THE ENTRY GROUP IS {1,3}
   * ALPHANUMERIC. 9FM0 sits 2A-2K, 3A-3D and 4A-4D. A digits-only group would
   * reject every one, and the code alternation would reject them a second time,
   * which is how the GCSE failure once looked like a single problem.
   */
  const fm = ["2A","2B","2C","2D","2E","2F","2G","2H","2J","2K","3A","3B","3C","3D","4A","4B","4C","4D"]
    .map((e) => `9FM0_${e}_0625_QU.pdf`);
  t(`⚠ all ${fm.length} Further Maths option entries parse`, fm.every(anyAccepts),
    fm.filter((n) => !anyAccepts(n)).join(", "));
  /** The negative half, so this is not "the regex says yes to everything". */
  const no = ["9FM0_2A_SAM_QU.pdf","9FM0_2A_0625_MSC.pdf","9FM0_2A_2025-06-25_QU.pdf",
              "9FM0_2ABC_0625_QU.pdf","9ZZ9_2A_0625_QU.pdf"];
  t("⚠ …and SAM/MSC/ISO/over-long/undeclared shapes are still rejected",
    !no.some(anyAccepts), no.filter(anyAccepts).join(", "));
}

// ============================================================================
console.log("\n=== 6. session resolution per R14, and the paper slug ===");
// ============================================================================
{
  /**
   * ⚠ BOTH 10 AND 11 MEAN OCTOBER-NOVEMBER. The corpus uses both, inside the
   * same year — 2020 is 96 files at MM=10 and 228 at MM=11. R14: the token is
   * cosmetic, the parsed session is what counts.
   */
  t("⚠ an IAL paper slugs by unit, not by entry or code",
    paperSlug({ unitNumber: 3, code: "WME01", entry: "01", session: "May-June", year: 2025 })
      === "unit-3-may-june-2025",
    paperSlug({ unitNumber: 3, code: "WME01", entry: "01", session: "May-June", year: 2025 }));
  t("⚠ a UK unit-less paper slugs by code and entry, lowercased",
    paperSlug({ unitNumber: undefined, code: "9FM0", entry: "2A", session: "October-November", year: 2025 })
      === "9fm0-2a-october-november-2025",
    paperSlug({ unitNumber: undefined, code: "9FM0", entry: "2A", session: "October-November", year: 2025 }));
  /** Two entries of one IAL unit collapse to ONE slug — as the 233 IAL papers do. */
  t("⚠ two entries of one IAL unit mint the SAME slug",
    paperSlug({ unitNumber: 1, code: "WMA11", entry: "01", session: "January", year: 2026 })
      === paperSlug({ unitNumber: 1, code: "WMA11", entry: "02", session: "January", year: 2026 }));
  /** …but two UK entries do NOT, because the entry is in the slug. */
  t("⚠ …while two UK entries mint DIFFERENT slugs",
    paperSlug({ unitNumber: undefined, code: "9FM0", entry: "2A", session: "May-June", year: 2025 })
      !== paperSlug({ unitNumber: undefined, code: "9FM0", entry: "3A", session: "May-June", year: 2025 }));
}

// ============================================================================
console.log("\n=== 7. QU/MS/ER of one sitting group onto ONE paper identity ===");
// ============================================================================
{
  /**
   * ⚠ THE PAIR KEY IS code_entry_MMYY (:778) — deliberately WITHOUT the type,
   * so the three components of a sitting land on one identity. Including the
   * type would make every component its own paper.
   */
  const key = (n: string) => n.replace(/_(QU|MS|ER)\.pdf$/, "");
  const trip = ["9FM0_2A_0625_QU.pdf","9FM0_2A_0625_MS.pdf","9FM0_2A_0625_ER.pdf"];
  t("⚠ QU, MS and ER of one sitting share a pair key",
    new Set(trip.map(key)).size === 1, [...new Set(trip.map(key))].join(", "));
  t("⚠ a different entry is a different identity",
    key("9FM0_2A_0625_QU.pdf") !== key("9FM0_3A_0625_QU.pdf"));
  t("⚠ a different session is a different identity",
    key("9FM0_2A_0625_QU.pdf") !== key("9FM0_2A_1125_QU.pdf"));
  t("⚠ all three components parse", trip.every(anyAccepts),
    trip.filter((n) => !anyAccepts(n)).join(", "));
}

// ============================================================================
console.log("\n=== 8. unitMetadata: UK empty, IAL confirmed values (R22 -> R31) ===");
// ============================================================================
{
  /**
   * ⚠ THIS SECTION WAS "STAYS EMPTY" AND R31 SUPERSEDED HALF OF IT. R22 held
   * that duration and marks are per-unit facts nobody had verified, so an
   * unverified pair would be a guess printed as data. R31 supplied them the
   * only acceptable way: read verbatim off the cover of a staged question paper
   * per code, reported for confirmation, and written only after the founder
   * confirmed all 22.
   *
   * ⚠ THE UK FIVE ARE STILL EMPTY, AND THAT IS NOT AN OMISSION. Their codes are
   * unit-less, and :1219 only reads unitMetadata when unitNumber is defined, so
   * a value there would be unreachable. Empty is the correct state forever.
   *
   * ⚠ THE VALUES ARE PINNED, NOT JUST THEIR PRESENCE. A guard that only checked
   * "is populated" would pass on a wrong mark total, and a wrong total is
   * invisible once it is in past_papers.
   */
  const UK = ["gce-mathematics","gce-further-mathematics","gce-english-language",
              "gce-english-literature","gce-english-language-and-literature"];
  t("⚠ the five UK configs carry an EMPTY unitMetadata (unit-less, never consulted)",
    UK.every((k) => Object.keys(SUBJECTS[k].unitMetadata).length === 0),
    UK.filter((k) => Object.keys(SUBJECTS[k].unitMetadata).length > 0).join(", "));

  const EXPECT: Record<string, Record<number, [number, number]>> = {
    "ial-mathematics":         { 1:[90,75], 2:[90,75], 3:[90,75], 4:[90,75], 5:[90,75], 6:[90,75] },
    "ial-further-mathematics": { 1:[90,75], 2:[90,75] },
    "ial-english-language":    { 1:[105,50], 2:[105,50], 3:[120,50], 4:[120,50] },
    "ial-english-literature":  { 1:[120,50], 2:[120,50], 3:[120,50], 4:[120,50] },
  };
  const wrong: string[] = [];
  for (const [cfg, units] of Object.entries(EXPECT)) {
    const m = SUBJECTS[cfg].unitMetadata;
    if (Object.keys(m).length !== Object.keys(units).length) wrong.push(`${cfg}: key count`);
    for (const [n, [dur, marks]] of Object.entries(units)) {
      const got = m[Number(n)];
      if (!got || got.durationMinutes !== dur || got.totalMarks !== marks)
        wrong.push(`${cfg}#${n}: ${got?.durationMinutes}m/${got?.totalMarks}`);
    }
  }
  t("⚠ all 22 IAL units carry the CONFIRMED duration and marks", wrong.length === 0, wrong.join(", "));

  /**
   * ⚠ English Language is the only config whose duration varies by unit —
   * AS 105, A2 120. If an extractor had defaulted one unit to another's value
   * this is where it would show.
   */
  const el = SUBJECTS["ial-english-language"].unitMetadata;
  t("⚠ IAL English Language really does differ AS 105 vs A2 120",
    el[1].durationMinutes === 105 && el[4].durationMinutes === 120,
    `${el[1].durationMinutes} / ${el[4].durationMinutes}`);

  /** verified must be true, or auditRows blocks every row as a placeholder. */
  const unver = Object.keys(EXPECT).flatMap((k) =>
    Object.entries(SUBJECTS[k].unitMetadata).filter(([, v]) => !v.verified).map(([n]) => `${k}#${n}`));
  t("⚠ every IAL metadata entry is marked verified", unver.length === 0, unver.join(", "));
}

// ============================================================================
console.log("\n=== 9. Science is untouched ===");
// ============================================================================
{
  /** The eighteen original IAL codes still declare their unit numbers. */
  const SCIENCE_IAL = ["WCH11","WCH12","WCH13","WCH14","WCH15","WCH16",
                       "WPH11","WPH12","WPH13","WPH14","WPH15","WPH16",
                       "WBI11","WBI12","WBI13","WBI14","WBI15","WBI16"];
  t("⚠ the 18 Science IAL codes still declare a unitNumber",
    SCIENCE_IAL.every((c) => byCode.get(c)?.unitNumber !== undefined),
    SCIENCE_IAL.filter((c) => byCode.get(c)?.unitNumber === undefined).join(", "));
  t("⚠ …and still map unit N to the Nth code",
    SCIENCE_IAL.every((c) => byCode.get(c)!.unitNumber === Number(c.slice(-1))),
    SCIENCE_IAL.map((c) => `${c}=${byCode.get(c)!.unitNumber}`).join(" "));
  t("⚠ the 16 pre-existing unit-less codes are still unit-less",
    ["8CH0","9CH0","8PH0","9PH0","8BN0","9BN0","8BI0","9BI0","1CH0","1BI0","1PH0",
     "4CH1","4BI1","4PH1","1SC0","4SS0"].every((c) => byCode.get(c)?.unitNumber === undefined));
  t("⚠ Science unitMetadata is still populated (this file did not blank it)",
    Object.keys(SUBJECTS["chemistry"].unitMetadata).length === 6 &&
    Object.keys(SUBJECTS["physics"].unitMetadata).length === 6,
    `${Object.keys(SUBJECTS["chemistry"].unitMetadata).length}/${Object.keys(SUBJECTS["physics"].unitMetadata).length}`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
