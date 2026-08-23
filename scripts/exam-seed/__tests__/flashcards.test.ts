/**
 * The flashcard notes system: content model, progress, and the two guards
 * this build must not ship without.
 *
 * ============================================================================
 * ⚠ THE TWO GUARDS ARE §5 AND §56
 * ============================================================================
 * §5 — /dev/flashcards must not be reachable by an ordinary production user.
 * §56 — nothing this build touched may have broken slides, resume, practice,
 *       worked examples, the tuition CTA or the qualification routes.
 *
 * Both are checked structurally against the real files, and both are proven by
 * sabotage rather than asserted: remove the gate, or the deck integration, and
 * this suite goes red naming what broke.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  estimatedMinutes,
  overfullCards,
  isCardSubject,
  CARD_TYPES,
  DENSITY_LIMIT,
  type Deck,
} from "../../../src/lib/flashcards/types.ts";
import { CHEMISTRY_MOLE_DECK } from "../../../src/lib/flashcards/decks/chemistry-mole.ts";
import {
  BIOLOGY_PREVIEW_DECK,
  PHYSICS_PREVIEW_DECK,
} from "../../../src/lib/flashcards/decks/preview-decks.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const DECKS: Deck[] = [CHEMISTRY_MOLE_DECK, BIOLOGY_PREVIEW_DECK, PHYSICS_PREVIEW_DECK];

// ============================================================================
console.log("\n=== 1. ⚠ §5 — /dev/flashcards is staff-gated and 404s otherwise ===");
// ============================================================================
{
  const DEV = "src/app/dev/flashcards/page.tsx";
  t("the dev preview route exists", existsSync(DEV));
  const src = existsSync(DEV) ? readFileSync(DEV, "utf8") : "";

  t("⚠ it asks who is asking — getStaffStatus is imported and called",
    /import\s*\{[^}]*getStaffStatus/.test(src) && /getStaffStatus\(\)/.test(src));

  t("⚠ a non-staff visitor gets notFound(), not a refusal page that confirms the route exists",
    /if\s*\(\s*!\s*\w+\.ok\s*\)\s*notFound\(\)/.test(src),
    "expected `if (!staff.ok) notFound()`");

  // Fails CLOSED: the guard must key on ok, never on a specific reason —
  // `reason === "not_staff"` would let an `unavailable` outage through.
  t("⚠ it fails CLOSED — the gate keys on ok, never on a particular reason",
    !/reason\s*===\s*["']not_staff["']/.test(src));

  t("it is not statically rendered (a cached staff page could be served to anyone)",
    /force-dynamic/.test(src));

  t("it asks crawlers not to index it, as a courtesy on top of the gate",
    /robots/.test(src) && /index:\s*false/.test(src));

  // ⚠ NO OTHER /dev ROUTE MAY EXIST UNGATED. A second dev page added later
  // without a gate is exactly how an internal tool leaks.
  const devRoot = "src/app/dev";
  const devPages: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const f = join(d, e);
      if (statSync(f).isDirectory()) walk(f);
      else if (/^page\.tsx?$/.test(e)) devPages.push(f);
    }
  };
  if (existsSync(devRoot)) walk(devRoot);
  const ungated = devPages.filter((f) => !/getStaffStatus/.test(readFileSync(f, "utf8")));
  t("⚠ EVERY page under /dev is staff-gated, not just this one",
    ungated.length === 0, ungated.join(", "));
}

// ============================================================================
console.log("\n=== 2. ⚠ §56 — the lesson page still has everything it had ===");
// ============================================================================
{
  const LESSON = "src/app/learn/[subject]/[pathway]/[course]/[lesson]/page.tsx";
  const src = readFileSync(LESSON, "utf8");

  // Each of these is a feature the brief names as untouchable.
  const REQUIRED: [string, string][] = [
    ["interactive slides", "LessonSlides"],
    ["slide resume + player", "loadPublishedDeck"],
    ["lesson progress", "LessonProgressProvider"],
    ["the journey rail", "LessonJourney"],
    ["worked examples", "LessonWorkedExamples"],
    ["practice", "LessonPractice"],
    ["exam questions", "LessonExamQuestions"],
    ["the tuition CTA", "TuitionCta"],
    ["spec point mapping", "spec_points"],
    ["completion state", "readCompletion"],
  ];
  for (const [label, token] of REQUIRED) {
    t(`§56 — ${label} is still wired into the lesson page`, src.includes(token), `missing ${token}`);
  }

  t("⚠ the flashcard deck was ADDED, not swapped in for something",
    src.includes("DeckPreview") && src.includes("loadDeckForLesson"));

  // §40 — opening or finishing a deck must not complete the lesson. The engine
  // reports reaching the end; only the section control marks completion.
  const engine = readFileSync("src/components/flashcards/StudyCardDeck.tsx", "utf8");
  t("⚠ §40 — the deck engine NEVER calls the lesson completion writer",
    !engine.includes("setSectionState") && !engine.includes("useLessonProgress"),
    "the deck must not be able to mark a lesson complete");
  t("…it reports reaching the end and nothing more",
    engine.includes("onReachedEnd"));

  // §39 — no download button while there is no offline architecture.
  const surfaces = ["src/components/flashcards/StudyCardDeck.tsx", "src/components/flashcards/DeckPreview.tsx"]
    .map((f) => readFileSync(f, "utf8")).join("\n");
  t("⚠ §39 — no download control anywhere, because downloads do not work yet",
    !/download/i.test(surfaces));
}

// ============================================================================
console.log("\n=== 3. ⚠ §44 — Notes are a notes format, not a quiz ===");
// ============================================================================
{
  for (const deck of DECKS) {
    const withBack = deck.cards.filter((c) => c.back).length;
    t(`${deck.subject}: not every card is question-and-answer (${withBack}/${deck.cards.length} have a back)`,
      withBack < deck.cards.length, `${withBack} of ${deck.cards.length}`);
    t(`${deck.subject}: at least one card DOES support active recall`, withBack > 0);
  }

  // A deck of pure reading cards must be completely valid — the type system
  // has to allow it or the format has quietly become a quiz.
  const readingOnly: Deck = {
    ...CHEMISTRY_MOLE_DECK,
    id: "reading-only",
    cards: CHEMISTRY_MOLE_DECK.cards.filter((c) => !c.back),
  };
  t("⚠ a deck with NO backs at all is a valid deck", readingOnly.cards.length > 0);
  t("…and still reports a sensible reading time", estimatedMinutes(readingOnly) >= 1);
}

// ============================================================================
console.log("\n=== 4. the content model behaves ===");
// ============================================================================
{
  for (const deck of DECKS) {
    t(`${deck.subject}: subject is one of the three`, isCardSubject(deck.subject));
    const ids = deck.cards.map((c) => c.id);
    t(`${deck.subject}: card ids are unique (saved cards reference them)`,
      new Set(ids).size === ids.length, ids.join(","));
    t(`${deck.subject}: every card declares a known type`,
      deck.cards.every((c) => (CARD_TYPES as readonly string[]).includes(c.type)));
    t(`${deck.subject}: every card has front content`,
      deck.cards.every((c) => c.front.length > 0));
    t(`${deck.subject}: reading time is derived and > 0`, estimatedMinutes(deck) >= 1);

    // ⚠ EVERY IMAGE HAS ALT TEXT (§49). A diagram nobody can hear is not
    // publishable, and the model must not let one through unnoticed.
    const media = deck.cards.flatMap((c) => [...c.front, ...(c.back ?? [])])
      .filter((b): b is Extract<typeof b, { kind: "media" }> => b.kind === "media");
    t(`${deck.subject}: every media block carries alt text`,
      media.every((m) => m.media.alt.trim().length > 0), `${media.length} media blocks`);

    // §48 — the sample decks must themselves fit the shell they demonstrate.
    const over = overfullCards(deck);
    t(`${deck.subject}: no sample card exceeds the ${DENSITY_LIMIT}-word density limit`,
      over.length === 0, over.map((c) => `${c.id}=${c.words}`).join(", "));
  }

  t("⚠ every card type is demonstrated somewhere across the three decks",
    (() => {
      const used = new Set(DECKS.flatMap((d) => d.cards.map((c) => c.type)));
      // image_annotation shares the diagram renderer and needs real media to
      // demonstrate, so it is the one type the sample decks legitimately omit.
      const expected = CARD_TYPES.filter((t) => t !== "image_annotation");
      return expected.every((t) => used.has(t));
    })(),
    [...new Set(DECKS.flatMap((d) => d.cards.map((c) => c.type)))].join(", "));

  t("the Chemistry deck is attached to a real lesson (§30)",
    CHEMISTRY_MOLE_DECK.lessonSlug === "definitions-formulae-and-the-mole");
  t("⚠ the preview decks are NOT attached to any lesson (§55)",
    !BIOLOGY_PREVIEW_DECK.lessonSlug && !PHYSICS_PREVIEW_DECK.lessonSlug);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
