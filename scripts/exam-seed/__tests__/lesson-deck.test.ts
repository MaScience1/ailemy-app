/**
 * Deck pipeline + player data model + §70 protection (§97, §98, §13, §19).
 *
 * ============================================================================
 * ⚠ TWO IMPLEMENTATIONS MUST AGREE, PER BUNDLE, EVERY RUN
 * ============================================================================
 * ingest.py builds manifests with ElementTree in presentation order; probe.py
 * re-derives slide and build counts with regex, independently, into
 * groundtruth.json. This suite compares the two for EVERY bundle on disk — a
 * parsing bug in either path is a disagreement here, not a silently wrong
 * lesson. The pilot's known shape (25 slides / 49 frames) is additionally
 * pinned by hand as the cry-wolf anchor: if both implementations drift
 * together, the anchor still goes red.
 *
 * ⚠ §98 IS TESTED AGAINST THE REAL PILOT DECK, not a fixture: slide 15 (the
 * mass→moles worked example) must have exactly 3 frames — question, answer
 * reveal, mark-scheme reveal. If the deployed conversion cannot render builds,
 * this test is the one that goes red; it must never be weakened to "some
 * frames exist".
 *
 * No bundles on this machine → SKIPPED (exit 2), the schema-probe convention.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { flattenFrames, parseManifest } from "../../../src/lib/lesson-deck/manifest.ts";

const DECKS_ROOT = join(process.cwd(), "content", "decks");
if (!existsSync(DECKS_ROOT)) {
  console.log("SKIPPED — no content/decks on this machine (run the ingest pipeline first).");
  process.exit(2);
}
const BUNDLES = readdirSync(DECKS_ROOT)
  .map((slug) => ({ slug, dir: join(DECKS_ROOT, slug, "v1") }))
  .filter((b) => existsSync(join(b.dir, "manifest.json")));
if (BUNDLES.length === 0) {
  console.log("SKIPPED — content/decks exists but holds no complete bundle.");
  process.exit(2);
}

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

// ============================================================================
console.log(`\n=== 1. manifest ↔ independent probe agreement (${BUNDLES.length} bundle(s)) ===`);
// ============================================================================
const manifests = new Map<string, ReturnType<typeof parseManifest>>();
for (const b of BUNDLES) {
  const verdict = parseManifest(JSON.parse(readFileSync(join(b.dir, "manifest.json"), "utf8")));
  manifests.set(b.slug, verdict);
  if (!verdict.ok) {
    t(`${b.slug}: manifest parses`, false, verdict.reason);
    continue;
  }
  const m = verdict.manifest;
  const gt = JSON.parse(readFileSync(join(b.dir, "groundtruth.json"), "utf8")) as {
    slideCount: number; frameCount: number; steps: Record<string, number>;
  };
  t(`${b.slug}: slide count agrees (${m.slideCount})`, m.slideCount === gt.slideCount,
    `manifest ${m.slideCount} vs probe ${gt.slideCount}`);

  // ⚠ THE RECONCILIATION: probe counts every click par (raw, target-blind);
  // ingest renders the ones that can show something and records the dropped
  // ghosts. rawSteps == liveFrames-1 + ghostSteps, per slide, exactly.
  const raw = JSON.parse(readFileSync(join(b.dir, "manifest.json"), "utf8")) as {
    slides: { n: number; ghostSteps?: number }[];
  };
  const ghostByN = new Map(raw.slides.map((s) => [s.n, s.ghostSteps ?? 0]));
  const stepMismatch = m.slides.find(
    (s) => (gt.steps[String(s.n)] ?? 0) !== s.frames.length - 1 + (ghostByN.get(s.n) ?? 0),
  );
  t(`${b.slug}: per-slide build steps reconcile (live + ghosts = probe's raw)`, !stepMismatch,
    stepMismatch &&
      `slide ${stepMismatch.n}: probe ${gt.steps[String(stepMismatch.n)]} vs live ${stepMismatch.frames.length - 1} + ghosts ${ghostByN.get(stepMismatch.n) ?? 0}`);
  const totalGhosts = raw.slides.reduce((a2, s) => a2 + (s.ghostSteps ?? 0), 0);
  if (totalGhosts > 0) console.log(`      (fidelity note: ${totalGhosts} ghost step(s) dropped in ${b.slug})`);
  t(`${b.slug}: frame totals reconcile too`,
    gt.frameCount === m.frameCount + totalGhosts,
    `probe ${gt.frameCount} vs live ${m.frameCount} + ghosts ${totalGhosts}`);
  const pngs = readdirSync(join(b.dir, "frames")).filter((f) => f.endsWith(".png"));
  t(`${b.slug}: every manifest frame exists on disk (${pngs.length})`,
    pngs.length === m.frameCount && m.slides.every((s) => s.frames.every((f) => pngs.includes(f.replace("frames/", "")))),
    `${pngs.length} png vs ${m.frameCount} frames`);
  // §13: presentation order preserved — positions are 1..N contiguous.
  t(`${b.slug}: slides are 1..${m.slideCount} in order (§13)`,
    m.slides.every((s, i) => s.n === i + 1));
}

// ============================================================================
console.log("\n=== 2. §98 — REAL builds on the REAL pilot deck ===");
// ============================================================================
{
  const v = manifests.get("definitions-formulae-and-the-mole");
  if (!v?.ok) {
    t("pilot bundle present", false, "definitions-formulae-and-the-mole missing — §98 is BLOCKED, not passing");
  } else {
    const m = v.manifest;
    t("⚠ the cry-wolf anchor: pilot is 25 slides / 49 frames", m.slideCount === 25 && m.frameCount === 49,
      `${m.slideCount}/${m.frameCount}`);
    const s15 = m.slides.find((s) => s.n === 15);
    t("⚠ slide 15 (mass→moles worked example) has 3 frames — question, answer, mark scheme",
      s15?.frames.length === 3, s15?.frames.length);
    t("slide 15's build labels name what each click reveals",
      Boolean(s15 && s15.buildLabels.length === 2 && s15.buildLabels.join(" ").includes("MARK SCHEME")),
      s15?.buildLabels.join(" | "));
    const s7 = m.slides.find((s) => s.n === 7);
    t("slide 7 (particle-language quick check) has 5 frames", s7?.frames.length === 5, s7?.frames.length);
    t("a static slide has exactly 1 frame — no fake animation (§21)",
      m.slides.find((s) => s.n === 6)?.frames.length === 1);
    t("16 static + 9 animated slides",
      m.slides.filter((s) => s.frames.length === 1).length === 16 &&
      m.slides.filter((s) => s.frames.length > 1).length === 9);
  }
}

// ============================================================================
console.log("\n=== 3. the parser REFUSES what must never be served ===");
// ============================================================================
{
  const good = manifests.get(BUNDLES[0].slug);
  if (good?.ok) {
    const base = JSON.parse(readFileSync(join(BUNDLES[0].dir, "manifest.json"), "utf8"));

    const withNotes = structuredClone(base);
    withNotes.slides[0].notes = "teacher-only commentary";
    const v1 = parseManifest(withNotes);
    t("⚠ a manifest carrying a 'notes' key ANYWHERE is refused whole (§22)",
      !v1.ok && v1.reason.includes("notes"), v1.ok ? "ACCEPTED" : v1.reason);

    const traversal = structuredClone(base);
    traversal.slides[0].frames[0] = "../../../lesson-sources/steal.png";
    const v2 = parseManifest(traversal);
    t("⚠ a frame path escaping the bundle is refused", !v2.ok && v2.reason.includes("escapes"),
      v2.ok ? "ACCEPTED" : v2.reason);

    const lying = structuredClone(base);
    lying.frameCount = lying.frameCount + 5;
    const v3 = parseManifest(lying);
    t("a manifest disagreeing with its own slides is refused", !v3.ok, v3.ok ? "ACCEPTED" : v3.reason);
  }
}

// ============================================================================
console.log("\n=== 4. the flat frame list IS the §16 next-button semantics ===");
// ============================================================================
{
  const v = manifests.get("definitions-formulae-and-the-mole");
  if (v?.ok) {
    const flat = flattenFrames(v.manifest);
    t("indexes are 0..N-1 sequential", flat.every((f, i) => f.index === i));
    const s15start = flat.findIndex((f) => f.slideN === 15);
    t("⚠ next from slide 15's opening frame is slide 15 step 1, NOT slide 16",
      flat[s15start + 1]?.slideN === 15 && flat[s15start + 1]?.step === 1,
      `next = slide ${flat[s15start + 1]?.slideN} step ${flat[s15start + 1]?.step}`);
    t("…and next after its LAST build is slide 16",
      flat[s15start + 3]?.slideN === 16 && flat[s15start + 3]?.step === 0);
    t("step 0 carries no build label; later steps may", flat[s15start].buildLabel === null);
  }
}

// ============================================================================
console.log("\n=== 5. §70 — the original PPTX is unreachable by construction ===");
// ============================================================================
{
  // The student asset route: derive its extension allowlist FROM THE SOURCE
  // and prove .pptx cannot pass it — plus the prefix rule that keeps
  // lesson-sources/ entirely unservable.
  const route = readFileSync(join(process.cwd(), "src/app/api/assets/[...path]/route.ts"), "utf8");
  const m = route.match(/const SERVABLE_EXTENSIONS = (\/.+\/i);/);
  t("the asset route declares an extension allowlist", Boolean(m), "SERVABLE_EXTENSIONS not found");
  if (m) {
    const re = new RegExp(m[1].slice(1, -2), "i");
    t("⚠ .pptx is refused by the allowlist", !re.test("source.pptx") && !re.test("deck.PPTX"));
    t("⚠ manifest.json is refused too — deck structure stays server-side", !re.test("manifest.json"));
    t("frames and worksheets still pass (control)", re.test("s01-f0.png") && re.test("worksheet.pdf"));
  }
  t("the route serves ONLY the lessons/ prefix — lesson-sources/ is unreachable",
    route.includes('parts[0] !== "lessons"'));

  // The admin preview route: only .png leaves it, and confinement is checked.
  const preview = readFileSync(join(process.cwd(), "src/app/api/admin/deck-preview/[...path]/route.ts"), "utf8");
  t("admin preview serves only *.png", preview.includes("\\.png$"));
  t("admin preview re-checks the resolved path stays under its root", preview.includes("startsWith(ROOT"));
  t("admin preview begins with assertAdmin", preview.indexOf("assertAdmin()") < preview.indexOf("params"));

  // The staging action never uploads notes.json — comment mentions it, code
  // must not. Positive control: it does upload the manifest.
  const actions = readFileSync(join(process.cwd(), "src/app/admin/lessons/[id]/deck/actions.ts"), "utf8");
  const codeLines = actions.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"));
  t("⚠ staging uploads NO notes.json (§22)", !codeLines.some((l) => l.includes("notes.json")));
  t("…while uploading manifest.json (control that the scan sees uploads)",
    codeLines.some((l) => l.includes("manifest.json")));
  t("the source uploads to lesson-sources/, never under lessons/",
    codeLines.some((l) => l.includes("`lesson-sources/")) &&
    !codeLines.some((l) => l.includes("`lessons/") && l.includes("source.pptx")));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
