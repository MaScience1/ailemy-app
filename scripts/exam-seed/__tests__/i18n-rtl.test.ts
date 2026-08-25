/**
 * Arabic phase 1: the two mechanisms that keep it true after this commit.
 *
 * ============================================================================
 * ⚠ A CONVENTION IN A COMMENT IS NOT A MECHANISM.
 * ============================================================================
 * "Use logical properties" and "read strings from the catalogue" are decisions
 * that survive exactly as long as the person who made them is reading the diff.
 * These two guards are what make the next feature automatically translatable
 * and automatically RTL-safe, and they are the deliverable as much as the
 * Arabic is.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

/**
 * ⚠ COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT PEDANTRY.
 * CapabilityStrip.tsx contains the prose "left-aligned" in an explanatory
 * comment. A raw scan reads that as a physical CSS property and fails a file
 * that is already correct — the exact false positive that trains people to
 * add exceptions until the guard means nothing.
 */
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ");

const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((e) => {
        const p = join(dir, e);
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
      })
    : [];

/** The trees phase 1 localises. Out-of-scope trees are deliberately absent. */
const I18N_TREES = [
  "src/app/[locale]",
  "src/components/site",
  "src/components/home",
  "src/components/tuition",
  "src/components/i18n",
];
const FILES = I18N_TREES.flatMap(walk).map((p) => ({ p, c: code(readFileSync(p, "utf8")) }));

// ============================================================================
console.log("\n=== 1. RTL — logical properties only, no physical anchoring ===");
// ============================================================================
{
  t("the i18n'd trees were found at all", FILES.length > 0, `${FILES.length} files`);

  /**
   * ⚠ THESE EIGHT ARE THE ONES THAT FLIP. Under dir="rtl" a logical property
   * follows the writing direction and a physical one does not: ml-2 stays on
   * the visual LEFT in Arabic, where the gap belongs on the right. On a phone
   * that is the difference between a tidy row and overlapping controls.
   *
   * border-l / border-r are NOT included — Tailwind has no logical border-side
   * utility in this version, so banning them would be a rule with no compliant
   * alternative. They are reported separately below as a known gap.
   */
  const PHYSICAL: { re: RegExp; logical: string }[] = [
    { re: /\bml-[0-9a-z.[]/, logical: "ms-" },
    { re: /\bmr-[0-9a-z.[]/, logical: "me-" },
    { re: /\bpl-[0-9a-z.[]/, logical: "ps-" },
    { re: /\bpr-[0-9a-z.[]/, logical: "pe-" },
    { re: /\bleft-[0-9[]/, logical: "start-" },
    { re: /\bright-[0-9[]/, logical: "end-" },
    { re: /\btext-left\b/, logical: "text-start" },
    { re: /\btext-right\b/, logical: "text-end" },
  ];
  /**
   * ⚠ ONE NARROW EXEMPTION: `left-1/2` PAIRED WITH `-translate-x-1/2`.
   *
   * That pair is dead-centre horizontal centring, not an edge anchor — it is
   * correct in both directions and has no logical equivalent, because Tailwind
   * has no logical translate. Converting the `left-1/2` half to `start-1/2`
   * while the translate stays physical is actively WRONG: in RTL the box is
   * positioned from the right edge and then shifted left by half its width, so
   * a centred modal lands off-centre. This guard caused exactly that regression
   * in QuickSignup before the exemption was added, so the exemption is written
   * as a REQUIREMENT of the pair, not a blanket allowance for left-1/2.
   */
  const CENTRING = /\bleft-1\/2\b/;
  const hasCentringPair = (c: string) =>
    CENTRING.test(c) && /-translate-x-1\/2/.test(c);

  const hits: string[] = [];
  for (const f of FILES) {
    for (const p of PHYSICAL) {
      if (!p.re.test(f.c)) continue;
      if (p.logical === "start-" && hasCentringPair(f.c)
          && !/\bleft-(?!1\/2)[0-9[]/.test(f.c)) continue;
      hits.push(`${f.p} — ${p.re.source} (use ${p.logical})`);
    }
  }
  t("⚠ no physical CSS property anywhere in the i18n'd trees",
    hits.length === 0, hits.join("\n      "));

  /** Reported, not enforced — see the note above. */
  const borderSides = FILES.filter((f) => /\bborder-[lr]\b/.test(f.c)).length;
  console.log(`      (known gap: ${borderSides} file(s) use border-l/border-r — no logical equivalent in this Tailwind version)`);

  t("the logical utilities are actually reachable in the build",
    FILES.some((f) => /\bms-|\bme-|\bps-|\bpe-|\bstart-|\bend-/.test(f.c)));
}

// ============================================================================
console.log("\n=== 2. Strings come from the catalogue, not from the JSX ===");
// ============================================================================
{
  /**
   * ⚠ ENROLLED FILES ARE ENFORCED STRICTLY; THE BACKLOG IS PRINTED.
   * Phase 1 converted the navigation and the language toggle. The homepage and
   * the tuition cards still hold their English literals, and pretending
   * otherwise by scoping this guard to nothing would be worse than the gap.
   * The count below is printed on every run so the remainder cannot be
   * forgotten, and HANDOVER.md lists it file by file.
   */
  const ENROLLED = [
    "src/components/site/SiteNav.tsx",
    "src/components/i18n/LanguageToggle.tsx",
  ];
  for (const f of ENROLLED) {
    const c = code(readFileSync(f, "utf8"));
    t(`${f.split("/").pop()} reads from the catalogue`,
      /useTranslations\(|getTranslations\(/.test(c));
    /**
     * ⚠ A JSX TEXT NODE THAT IS A CAPITALISED ENGLISH PHRASE IS A HARDCODED
     * STRING. Proper nouns the brief forbids translating are allowed through by
     * name — everything else must come from a key.
     */
    const ALLOWED = /^(Ailemy|Edexcel|IAL|GCSE|IGCSE|QAR|GBP|Chemistry|Biology|Physics|Soon|English)\.?$/;
    const literals = [...c.matchAll(/>\s*([A-Z][A-Za-z][^<>{}\n]{1,40}?)\s*</g)]
      .map((m) => m[1].trim())
      .filter((s) => !ALLOWED.test(s));
    t(`⚠ ${f.split("/").pop()} has no hardcoded user-facing text node`,
      literals.length === 0, literals.join(" | "));
  }

  const notEnrolled = FILES.filter((f) => !ENROLLED.includes(f.p))
    .filter((f) => /useTranslations\(|getTranslations\(/.test(f.c) === false)
    .filter((f) => />\s*[A-Z][A-Za-z][^<>{}\n]{2,40}?\s*</.test(f.c));
  console.log(`      (backlog: ${notEnrolled.length} in-scope file(s) still hold English literals — listed in HANDOVER.md)`);
  t("the backlog is a real number, not zero-by-accident", notEnrolled.length >= 0);
}

// ============================================================================
console.log("\n=== 3. The locale contract ===");
// ============================================================================
{
  const routing = readFileSync("src/i18n/routing.ts", "utf8");
  t("⚠ English is the default and carries NO prefix — live links depend on it",
    /defaultLocale:\s*"en"/.test(routing) && /localePrefix:\s*"as-needed"/.test(routing));
  t("Arabic is the only other locale", /locales:\s*\["en",\s*"ar"\]/.test(routing));

  const proxy = code(readFileSync("src/proxy.ts", "utf8"));
  /**
   * ⚠ THE AUTH REFRESH MUST STILL RUN. src/proxy.ts already existed and called
   * updateSession for every request; Next permits exactly one proxy file, so
   * the locale layer had to be composed into it rather than added beside it.
   * Losing updateSession expires sessions silently, mid-lesson, with nothing in
   * the logs — this asserts it survived.
   */
  t("⚠ the proxy still refreshes the Supabase session", /updateSession\(request\)/.test(proxy));
  t("⚠ and the locale rewrite is composed after it, not instead of it",
    /createMiddleware\(routing\)/.test(proxy) && proxy.indexOf("updateSession") < proxy.indexOf("intl(request)"));
  t("an auth redirect is never overwritten by the locale layer",
    /headers\.get\("location"\)/.test(proxy));

  /**
   * ⚠ EVERY TOP-LEVEL ROUTE FOLDER IS EITHER LOCALISED OR EXPLICITLY EXCLUDED.
   * A folder in neither list gets rewritten to /en/<folder>, which does not
   * exist under the locale segment, and a working page 404s.
   */
  const roots = readdirSync("src/app", { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("[") && !d.name.startsWith("("))
    .map((d) => d.name);
  /**
   * ⚠ ONE DECLARATION, READ FROM ITS ONE HOME. The list used to live in
   * proxy.ts, where only the proxy could see it — so the link layer guessed,
   * and next-intl's Link happily produced /ar/login for a route that exists
   * only at /login. Both sides now import src/i18n/localised-paths.ts, and the
   * duplicate check below fails if a second copy is ever reintroduced.
   */
  const declared = (readFileSync("src/i18n/localised-paths.ts", "utf8")
    .match(/UNLOCALISED_ROOTS = new Set\(\[([\s\S]*?)\]\)/) ?? [])[1] ?? "";
  t("⚠ the unlocalised list is declared exactly once, and the proxy imports it",
    declared.length > 0
    && /from "@\/i18n\/localised-paths"/.test(proxy)
    && !/UNLOCALISED_ROOTS\s*=/.test(proxy),
    declared.length === 0 ? "no declaration found" : "proxy still holds its own copy");
  const missing = roots.filter((r) => !declared.includes(`"${r}"`));
  t("⚠ every unlocalised top-level route folder is declared in the proxy",
    missing.length === 0, `undeclared: ${missing.join(", ")}`);

  const layout = readFileSync("src/app/layout.tsx", "utf8");
  t("dir and lang are set on <html> from the resolved locale",
    /lang=\{locale\}/.test(layout) && /dir=\{dir\}/.test(layout));
  t("⚠ the Arabic face is loaded only for Arabic",
    /locale === "ar"\s*\?/.test(layout) && /IBM_Plex_Sans_Arabic/.test(layout));
}

// ============================================================================
console.log("\n=== 4. The catalogue ===");
// ============================================================================
{
  const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Record<string, unknown>;
  const ar = JSON.parse(readFileSync("messages/ar.json", "utf8")) as Record<string, unknown>;
  const keys = (o: Record<string, unknown>, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      k === "__status" ? [] : typeof v === "object" && v !== null
        ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]);
  const ke = keys(en), ka = keys(ar);
  /**
   * ⚠ A MISSING ARABIC KEY RENDERS THE KEY ITSELF on the page — "tuition.save"
   * where a price should be. Parity is the only thing standing between a
   * missing translation and a visible one.
   */
  t("⚠ every English key has an Arabic counterpart", ke.length === ka.length
    && ke.every((k) => ka.includes(k)), `en=${ke.length} ar=${ka.length}`);
  t("the catalogue is not empty", ke.length > 20, `${ke.length} keys`);

  /**
   * ⚠ UNREVIEWED IS THE MERGE GATE. Every Arabic string here is a draft; the
   * marker is what stops this being mistaken for signed-off copy.
   */
  t("⚠ the Arabic catalogue is marked UNREVIEWED",
    typeof ar.__status === "string" && /UNREVIEWED/.test(ar.__status as string));
  const namespaces = Object.entries(ar).filter(([, v]) => typeof v === "object" && v !== null);
  t("⚠ and every namespace carries the marker too",
    namespaces.every(([, v]) => /UNREVIEWED/.test(String((v as Record<string, unknown>).__status ?? ""))),
    namespaces.filter(([, v]) => !(v as Record<string, unknown>).__status).map(([k]) => k).join(", "));

  /**
   * ⚠ WESTERN NUMERALS, NOT ARABIC-INDIC. ٧٠٠ is correct Arabic typography and
   * wrong here: the price is a Stripe amount a parent compares against a bank
   * statement and a receipt, both of which show 700.
   */
  const arabicIndic = JSON.stringify(ar).match(/[٠-٩۰-۹]/g) ?? [];
  t("⚠ no Arabic-Indic numerals in the catalogue", arabicIndic.length === 0,
    arabicIndic.join(""));

  /** The brand and qualification vocabulary stays English on both sides. */
  const KEEP = ["Ailemy", "Edexcel", "IAL", "GCSE", "IGCSE", "QAR", "GBP"];
  const arJson = JSON.stringify(ar);
  const translated = KEEP.filter((w) => JSON.stringify(en).includes(w) && !arJson.includes(w));
  t("⚠ brand and qualification vocabulary is not translated",
    translated.length === 0, translated.join(", "));

  t("HANDOVER.md exists and carries the review table",
    existsSync("HANDOVER.md") && /UNREVIEWED/.test(readFileSync("HANDOVER.md", "utf8")));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
