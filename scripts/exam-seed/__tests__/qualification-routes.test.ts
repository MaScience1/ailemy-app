/**
 * The qualification tier must not have moved the Edexcel IAL pathway.
 *
 * ============================================================================
 * ⚠ THIS IS THE §3 NON-NEGOTIABLE, WRITTEN AS A GUARD RATHER THAN A PROMISE
 * ============================================================================
 * Adding `gcse/` and `a-level/` as STATIC folders beside the `[pathway]`
 * dynamic segment is safe only because Next resolves literal children before
 * dynamic ones. If that assumption is ever wrong — or if somebody later adds
 * a static folder named `international-a-level`, or renames `[pathway]` — the
 * live Edexcel URLs start resolving to a different page, and every one of
 * them still returns 200 while showing the wrong thing. Nothing in typecheck,
 * lint or the build notices a route that resolves to the wrong file.
 *
 * So this suite resolves real URLs against the real app-router tree WITH
 * PRECEDENCE MODELLED, and asserts which file each one lands in.
 *
 * ⚠ THE ROUTE LIST IS DISCOVERED, NOT TYPED. It walks src/app the same way
 * route-integrity.test.ts does. A hand-written list would keep passing after
 * somebody deleted the route it names.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  LEVELS,
  LEVEL_PATHWAYS,
  SCOPE_PATHWAY,
  isLevel,
  isQualificationScope,
  levelOf,
} from "../../../src/lib/qualifications/model.ts";
import {
  capabilitiesFor,
  supportStatusFor,
  boardSupport,
  orderBoards,
  EMPTY_COVERAGE,
} from "../../../src/lib/qualifications/support.ts";
import { PATHWAY_SLUGS, isPathway } from "../../../src/lib/catalogue/pathways.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const APP = "src/app";

function routes(dir: string, prefix: string[] = []): string[][] {
  const out: string[][] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry.startsWith("_")) continue;
    const next = entry.startsWith("(") && entry.endsWith(")") ? prefix : [...prefix, entry];
    if (readdirSync(full).some((f) => /^page\.(tsx|ts|jsx|js)$/.test(f))) out.push(next);
    out.push(...routes(full, next));
  }
  return out;
}

const ROUTES = routes(APP);
t(`router tree parsed — ${ROUTES.length} routes`, ROUTES.length > 40, ROUTES.length);

/**
 * Resolve a URL the way the router does: among patterns of the same length,
 * the one that is literal at the earliest differing segment wins. A catch-all
 * only wins when nothing else matches.
 */
function resolve(path: string[]): string | null {
  const candidates = ROUTES.filter(
    (p) => p.length === path.length && p.every((seg, i) => seg.startsWith("[") || seg === path[i]),
  );
  if (candidates.length === 0) {
    const catchAll = ROUTES.find(
      (p) => p.some((s) => s.startsWith("[...")) &&
        p.length - 1 <= path.length &&
        p.slice(0, -1).every((seg, i) => seg.startsWith("[") || seg === path[i]),
    );
    return catchAll ? "/" + catchAll.join("/") : null;
  }
  candidates.sort((a, b) => {
    for (let i = 0; i < a.length; i++) {
      const aDyn = a[i].startsWith("["), bDyn = b[i].startsWith("[");
      if (aDyn !== bDyn) return aDyn ? 1 : -1;
    }
    return 0;
  });
  return "/" + candidates[0].join("/");
}

const url = (s: string) => s.split("/").filter(Boolean);

// ============================================================================
console.log("\n=== 1. ⚠ EDEXCEL IAL — every live URL resolves where it always did (§3) ===");
// ============================================================================
{
  // The identity triple this pathway resolves through, from the seed data:
  // chemistry / international-a-level / edexcel-ial-as-chemistry.
  const PRESERVED: [string, string][] = [
    ["/learn", "/learn"],
    ["/learn/chemistry", "/learn/[subject]"],
    ["/learn/chemistry/international-a-level", "/learn/[subject]/[pathway]"],
    ["/learn/chemistry/international-a-level/edexcel-ial-as-chemistry", "/learn/[subject]/[pathway]/[course]"],
    ["/learn/chemistry/international-a-level/edexcel-ial-as-chemistry/lessons", "/learn/[subject]/[pathway]/[course]/lessons"],
    ["/learn/chemistry/international-a-level/edexcel-ial-as-chemistry/exam-questions", "/learn/[subject]/[pathway]/[course]/exam-questions"],
    ["/learn/chemistry/international-a-level/edexcel-ial-as-chemistry/definitions-formulae-and-the-mole", "/learn/[subject]/[pathway]/[course]/[lesson]"],
    // The other three qualifications keep their routes too — the level tier
    // must not have stolen any of them.
    ["/learn/chemistry/uk-gcse", "/learn/[subject]/[pathway]"],
    ["/learn/chemistry/igcse", "/learn/[subject]/[pathway]"],
    ["/learn/chemistry/uk-a-level", "/learn/[subject]/[pathway]"],
    ["/learn/biology/international-a-level", "/learn/[subject]/[pathway]"],
  ];
  for (const [path, expected] of PRESERVED) {
    const got = resolve(url(path));
    t(`${path}  →  ${expected}`, got === expected, `resolved to ${got}`);
  }
}

// ============================================================================
console.log("\n=== 2. the new selector tier resolves to its own files ===");
// ============================================================================
{
  const NEW: [string, string][] = [
    ["/learn/chemistry/gcse", "/learn/[subject]/gcse"],
    ["/learn/chemistry/a-level", "/learn/[subject]/a-level"],
    ["/learn/chemistry/gcse/uk", "/learn/[subject]/gcse/[qualification]"],
    ["/learn/chemistry/gcse/international", "/learn/[subject]/gcse/[qualification]"],
    ["/learn/chemistry/a-level/uk", "/learn/[subject]/a-level/[qualification]"],
    ["/learn/chemistry/a-level/international", "/learn/[subject]/a-level/[qualification]"],
    // Generic across subjects (§33) — nothing is chemistry-only.
    ["/learn/biology/gcse", "/learn/[subject]/gcse"],
    ["/learn/physics/a-level/international", "/learn/[subject]/a-level/[qualification]"],
  ];
  for (const [path, expected] of NEW) {
    const got = resolve(url(path));
    t(`${path}  →  ${expected}`, got === expected, `resolved to ${got}`);
  }

  // ⚠ THE COLLISION THAT WOULD BREAK EDEXCEL. A static folder whose name is a
  // pathway slug would shadow the dynamic route for that whole qualification.
  const shadowing = PATHWAY_SLUGS.filter((slug) =>
    ROUTES.some((r) => r.length === 3 && r[0] === "learn" && r[2] === slug),
  );
  t("⚠ no static folder under /learn/[subject] is named after a pathway slug",
    shadowing.length === 0, shadowing.join(", "));

  // A level slug must never also be a pathway slug, or the two tiers collide.
  const overlap = LEVELS.filter((l) => (PATHWAY_SLUGS as readonly string[]).includes(l));
  t("⚠ no level slug collides with a pathway slug", overlap.length === 0, overlap.join(", "));
}

// ============================================================================
console.log("\n=== 3. the level ↔ pathway mapping is total and consistent ===");
// ============================================================================
{
  const mapped = LEVELS.flatMap((l) => [...LEVEL_PATHWAYS[l]]);
  t("every mapped pathway is a real pathway slug", mapped.every(isPathway), mapped.join(","));
  t("no pathway is mapped to two levels", new Set(mapped).size === mapped.length);
  for (const l of LEVELS) {
    for (const p of LEVEL_PATHWAYS[l]) {
      t(`levelOf(${p}) === ${l}`, levelOf(p) === l, levelOf(p) ?? "null");
    }
  }
  // ⚠ ib AND ap ARE OUTSIDE THE TWO-LEVEL MODEL ON PURPOSE — they are not
  // GCSE or A-Level qualifications, and claiming otherwise would be the
  // fabrication §41 forbids, in the taxonomy rather than in the copy.
  t("⚠ ib and ap belong to NO level, deliberately",
    levelOf("ib") === null && levelOf("ap") === null);

  for (const l of LEVELS) {
    for (const scope of ["uk", "international"] as const) {
      const p = SCOPE_PATHWAY[l][scope];
      t(`${l}/${scope} → ${p}, and it round-trips`, levelOf(p) === l, `${p} → ${levelOf(p)}`);
    }
  }
  t("isLevel / isQualificationScope refuse near-misses",
    !isLevel("a_level") && !isLevel("gcse-uk") && !isQualificationScope("UK") && !isQualificationScope(""));
}

// ============================================================================
console.log("\n=== 4. ⚠ §41 — a status can never be better than the content behind it ===");
// ============================================================================
{
  t("⚠ no courses, no lessons → coming_soon",
    supportStatusFor(EMPTY_COVERAGE) === "coming_soon", supportStatusFor(EMPTY_COVERAGE));

  // The exact shape of every non-Edexcel curriculum today: a course shell
  // with nothing in it. It must NOT read as "Expanding".
  const shell = { ...EMPTY_COVERAGE, courses: 2 };
  t("⚠ course shells with zero lessons are STILL coming_soon — a shell is not an offering",
    supportStatusFor(shell) === "coming_soon", supportStatusFor(shell));

  const written = { ...EMPTY_COVERAGE, courses: 1, lessons: 88, liveLessons: 0 };
  t("lessons written but none published → expanding", supportStatusFor(written) === "expanding");

  const published = { ...EMPTY_COVERAGE, courses: 1, lessons: 83, liveLessons: 1 };
  t("a published lesson → supported", supportStatusFor(published) === "supported");

  const full = { ...published, pastPapers: 39 };
  t("published lessons + past papers → full_support", supportStatusFor(full) === "full_support");

  t("⚠ papers alone NEVER reach full_support without a published lesson",
    supportStatusFor({ ...EMPTY_COVERAGE, courses: 1, pastPapers: 39 }) === "coming_soon");

  // Capability chips are per-capability truths (§27).
  t("⚠ an empty curriculum offers NO capability chips at all",
    capabilitiesFor(EMPTY_COVERAGE).length === 0, capabilitiesFor(EMPTY_COVERAGE).join(","));
  t("chips appear only for capabilities with content behind them",
    capabilitiesFor(published).join(",") === "lessons,progress",
    capabilitiesFor(published).join(","));
  t("⚠ tuition is SEPARATE from platform coverage (§29) — present only when configured",
    !capabilitiesFor(published).includes("tuition") &&
    capabilitiesFor({ ...published, hasTuition: true }).includes("tuition"));
  t("practice appears only where a lesson has a published deck",
    !capabilitiesFor(published).includes("practice") &&
    capabilitiesFor({ ...published, lessonsWithDecks: 1 }).includes("practice"));
}

// ============================================================================
console.log("\n=== 5. the flagship badge has to be earned ===");
// ============================================================================
{
  const empty = boardSupport({
    curriculumSlug: "edexcel-ial", curriculumName: "Edexcel International A-Level",
    counts: EMPTY_COVERAGE,
  });
  t("⚠ the flagship curriculum with NO content is not badged flagship",
    empty !== null && empty.isFlagship === false, JSON.stringify(empty?.isFlagship));

  const real = boardSupport({
    curriculumSlug: "edexcel-ial", curriculumName: "Edexcel International A-Level",
    counts: { ...EMPTY_COVERAGE, courses: 2, lessons: 171, liveLessons: 1, pastPapers: 71 },
  });
  t("…and with real content it is", real?.isFlagship === true);
  t("…and it derives full_support", real?.status === "full_support", real?.status);

  const other = boardSupport({
    curriculumSlug: "aqa-gcse", curriculumName: "AQA GCSE",
    counts: { ...EMPTY_COVERAGE, courses: 1 },
  });
  t("a non-flagship board is never badged flagship", other?.isFlagship === false);
  t("⚠ AQA today derives coming_soon — the brief's illustrative 'Expanding' would be a claim about content nobody has written",
    other?.status === "coming_soon", other?.status);

  t("⚠ a curriculum with no exam board (ib, ap) is NOT rendered as a board",
    boardSupport({ curriculumSlug: "ib", curriculumName: "IB", counts: EMPTY_COVERAGE }) === null);

  // Ordering: flagship first, then by how usable it is.
  const rows = [other!, real!].filter(Boolean);
  t("the flagship sorts first", orderBoards(rows)[0]?.curriculumSlug === "edexcel-ial");
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
