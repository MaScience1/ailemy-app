/**
 * The Resources Hub's three non-negotiable guards.
 *
 * ============================================================================
 * §40 — NO TUITION COMPONENT MAY MOUNT ON ANY /resources ROUTE
 * §47 — EXISTING EDEXCEL IAL ROUTES KEEP WORKING
 * §60 — NO PUBLIC SURFACE DERIVES FROM DATA ITS VIEWER CANNOT READ
 * ============================================================================
 * All three are checked against the real files, and all three are proven by
 * sabotage rather than asserted. §40 in particular is the kind of rule that is
 * broken by accident — somebody mounts a global CTA in a layout a year from
 * now and nobody remembers that Resources is meant to be a study environment.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const APP = "src/app";

/**
 * ⚠ COMMENTS ARE STRIPPED BEFORE SCANNING, AND THIS MATTERS MORE THAN IT LOOKS.
 * The first run of this suite failed on the /resources page — because the page
 * header explains, in prose, that there is no TuitionCta on it. A guard that
 * cannot tell code from a comment does not just report noise: it puts pressure
 * on the next person to DELETE the sentence documenting the rule in order to
 * make the check green. The check examines what the file DOES.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")   // block comments, including JSDoc
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 "); // line comments, not "https://"
}

function filesUnder(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) filesUnder(f, out);
    else if (/\.tsx?$/.test(f)) out.push(f);
  }
  return out;
}

// ============================================================================
console.log("\n=== 1. ⚠ §40 — Resources is a study environment, not a sales surface ===");
// ============================================================================
{
  const resourceFiles = filesUnder(join(APP, "resources"));
  t("the /resources tree exists and has pages", resourceFiles.length >= 3, resourceFiles.length);

  /**
   * ⚠ THE LIST IS EVERY TUITION SURFACE IN THE CODEBASE, not a guess. If a new
   * one is added it should be added here too — and until it is, the generic
   * /tuition-link check below still catches a banner that links to tuition.
   */
  const TUITION_COMPONENTS = ["TuitionCta", "StickyCta", "CohortCard", "HeroCalendar"];

  for (const f of resourceFiles) {
    const src = code(readFileSync(f, "utf8"));
    const found = TUITION_COMPONENTS.filter((c) => new RegExp(`\\b${c}\\b`).test(src));
    t(`§40 — ${f.replace(APP + "/", "")} mounts no tuition component`,
      found.length === 0, found.join(", "));
  }

  // A persistent CTA could also arrive as a plain link rather than a component.
  const promo = resourceFiles.filter((f) => {
    const src = code(readFileSync(f, "utf8"));
    return /href=["'`]\/tuition/.test(src) || /Book (live )?tuition|Join tuition|Need help\?/i.test(src);
  });
  t("⚠ §40 — no /resources page links to or advertises tuition at all",
    promo.length === 0, promo.join(", "));

  // ⚠ AND THE LAYOUT ABOVE IT MUST BE CLEAN TOO — a CTA mounted in a shared
  // layout would appear on every Resources page while every page file stayed
  // innocent, which is precisely how this rule gets broken by accident.
  for (const layout of ["src/app/layout.tsx", "src/app/resources/layout.tsx"]) {
    if (!existsSync(layout)) continue;
    const src = code(readFileSync(layout, "utf8"));
    const found = TUITION_COMPONENTS.filter((c) => new RegExp(`\\b${c}\\b`).test(src));
    t(`§40 — ${layout} mounts no tuition component above Resources`,
      found.length === 0, found.join(", "));
  }
}

// ============================================================================
console.log("\n=== 2. ⚠ §47 — no existing route moved ===");
// ============================================================================
{
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
  /**
 * ⚠ [locale] IS TRANSPARENT FOR THE DEFAULT LOCALE. i18n phase 1 moved the
 * homepage and /tuition under app/[locale]/; with localePrefix "as-needed"
 * English carries no prefix, so those files still serve /  and /tuition. A
 * resolver that counted [locale] as a segment would call every one of them
 * missing and make a working move look like a breakage.
 */
const ROUTES = routes(APP).map((r) => (r[0] === "[locale]" ? r.slice(1) : r));

  function resolve(path: string[]): string | null {
    const c = ROUTES.filter(
      (p) => p.length === path.length && p.every((seg, i) => seg.startsWith("[") || seg === path[i]),
    );
    if (c.length === 0) return null;
    c.sort((a, b) => {
      for (let i = 0; i < a.length; i++) {
        const ad = a[i].startsWith("["), bd = b[i].startsWith("[");
        if (ad !== bd) return ad ? 1 : -1;
      }
      return 0;
    });
    return "/" + c[0].join("/");
  }
  const url = (s: string) => s.split("/").filter(Boolean);

  const PRESERVED: [string, string][] = [
    ["/resources", "/resources"],
    ["/past-papers", "/past-papers"],
    ["/learn/chemistry", "/learn/[subject]"],
    ["/learn/chemistry/international-a-level", "/learn/[subject]/[pathway]"],
    ["/learn/chemistry/international-a-level/edexcel-ial-as-chemistry", "/learn/[subject]/[pathway]/[course]"],
    ["/learn/chemistry/international-a-level/edexcel-ial-as-chemistry/definitions-formulae-and-the-mole", "/learn/[subject]/[pathway]/[course]/[lesson]"],
    ["/learn/chemistry/international-a-level/edexcel-ial-as-chemistry/lessons", "/learn/[subject]/[pathway]/[course]/lessons"],
    ["/learn/chemistry/international-a-level/edexcel-ial-as-chemistry/exam-questions", "/learn/[subject]/[pathway]/[course]/exam-questions"],
    // The qualification tier from the previous build must also be untouched.
    ["/learn/chemistry/gcse", "/learn/[subject]/gcse"],
    ["/learn/chemistry/a-level/international", "/learn/[subject]/a-level/[qualification]"],
  ];
  for (const [path, expected] of PRESERVED) {
    const got = resolve(url(path));
    t(`§47 — ${path} → ${expected}`, got === expected, `resolved to ${got}`);
  }

  // The new tier resolves to its own files and shadows nothing.
  const NEW: [string, string][] = [
    ["/resources/chemistry", "/resources/[subject]"],
    ["/resources/chemistry/edexcel-ial-as-chemistry", "/resources/[subject]/[course]"],
  ];
  for (const [path, expected] of NEW) {
    t(`${path} → ${expected}`, resolve(url(path)) === expected, `resolved to ${resolve(url(path))}`);
  }
}

// ============================================================================
console.log("\n=== 3. ⚠ §60 — public surfaces derive only from readable data ===");
// ============================================================================
{
  /**
   * ⚠ paper_questions AND question_spec_points REFUSE anon WITH 42501. They
   * are admin-gated so exam content cannot be scraped. A public Resources page
   * that counts them does not merely fail — it fails for logged-out visitors
   * only, which is the hardest kind of bug to notice. The qualification build
   * shipped exactly that and returned an empty board list to every anonymous
   * student until it was found.
   */
  const GATED = ["paper_questions", "question_spec_points", "mark_scheme_items", "model_answers"];
  const publicReaders = [
    "src/lib/resources/taxonomy.ts",
    "src/lib/resources/search.ts",
  ];
  for (const f of publicReaders) {
    const src = readFileSync(f, "utf8");
    const queried = GATED.filter((tbl) => new RegExp(`from\\(["']${tbl}["']\\)`).test(src));
    t(`⚠ §60 — ${f.replace("src/lib/resources/", "")} queries no admin-gated table`,
      queried.length === 0, queried.join(", "));
  }

  // And it must not reach for the service-role client either — that would read
  // the gated tables successfully and leak them onto a public page.
  for (const f of publicReaders) {
    const src = readFileSync(f, "utf8");
    t(`⚠ §60 — ${f.replace("src/lib/resources/", "")} uses the viewer's session, not the admin client`,
      !src.includes("createAdminClient"), "createAdminClient found");
  }

  // Every read checks its error rather than letting a failure render as zero.
  const taxonomy = readFileSync("src/lib/resources/taxonomy.ts", "utf8");
  t("⚠ a failed read is reported, never rendered as an empty catalogue",
    taxonomy.includes("res.error") && taxonomy.includes("error:"),
    "expected explicit error handling on the parallel reads");
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
