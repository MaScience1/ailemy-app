/**
 * The six-section lesson journey: completion arithmetic and the notes renderer.
 *
 * ============================================================================
 * ⚠ EVERY EXPECTATION HERE IS DERIVED FROM THE SOURCE MODULE, NOT TYPED OUT
 * ============================================================================
 * The section list, their anchors and their auto-evidence come from
 * src/lib/lesson/sections.ts by import. A test that hard-coded "there are six
 * sections" would keep passing on the day a seventh is added and the journey
 * silently stops rendering it — the exact failure mode AGENTS.md records for
 * the WCH11/01 model that pinned yesterday's behaviour for a week.
 *
 * ⚠ AND THE GUARDS ARE SABOTAGED, NOT ASSUMED. The markdown renderer's whole
 * security claim is "no raw HTML is ever parsed", so this suite feeds it a
 * script tag and an img/onerror payload and asserts they survive as TEXT. A
 * guard that has never been seen to hold has not been shown to work.
 */
import {
  LESSON_SECTIONS,
  SECTION_META,
  isSectionKey,
  summarise,
  type LessonSectionKey,
  type SectionState,
} from "../../../src/lib/lesson/sections.ts";
import { parseBlocks } from "../../../src/lib/lesson/markdown-parse.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const complete = (key: LessonSectionKey): SectionState => ({
  key, status: "complete", completedAt: "2026-08-23T10:00:00Z", source: "manual",
});

// ============================================================================
console.log("\n=== 1. the section vocabulary is internally consistent ===");
// ============================================================================
{
  t("every section has metadata", LESSON_SECTIONS.every((k) => Boolean(SECTION_META[k])));

  const anchors = LESSON_SECTIONS.map((k) => SECTION_META[k].anchor);
  t("⚠ anchors are unique — a duplicate would make two sections one scroll target",
    new Set(anchors).size === anchors.length, anchors.join(","));
  t("anchors are URL-safe fragments (§30 deep links)",
    anchors.every((a) => /^[a-z][a-z0-9-]*$/.test(a)), anchors.join(","));

  t("isSectionKey accepts every real key", LESSON_SECTIONS.every(isSectionKey));
  t("⚠ isSectionKey REFUSES a plausible near-miss — the DB CHECK uses these exact strings",
    !isSectionKey("worked-examples") && !isSectionKey("exam") && !isSectionKey(""),
    "worked-examples / exam / '' must all be rejected");

  // §25/§105: auto-completion needs observable evidence. Notes has none, by
  // design — reading cannot be observed, so it must stay manual-only.
  t("⚠ notes has NO automatic evidence — reading is not observable (§105)",
    SECTION_META.notes.autoEvidence === null, SECTION_META.notes.autoEvidence);
  t("practice's auto-evidence is ATTEMPTING, not passing (§18)",
    /submitted/.test(SECTION_META.practice.autoEvidence ?? "") &&
    !/pass|correct|score/i.test(SECTION_META.practice.autoEvidence ?? ""),
    SECTION_META.practice.autoEvidence);
}

// ============================================================================
console.log("\n=== 2. the denominator is what the lesson HAS (§89) ===");
// ============================================================================
{
  const four: LessonSectionKey[] = ["slides", "notes", "worked_examples", "practice"];
  const all = summarise(four, {
    slides: complete("slides"), notes: complete("notes"),
    worked_examples: complete("worked_examples"), practice: complete("practice"),
  });
  t("⚠ a lesson with 4 sections completes at 4/4 — never stuck at 4/6 waiting for content nobody wrote",
    all.complete === 4 && all.total === 4 && all.percent === 100 && all.allComplete,
    JSON.stringify(all));

  const partial = summarise(four, { slides: complete("slides"), notes: complete("notes") });
  t("2 of 4 is 50% and NOT all-complete", partial.percent === 50 && !partial.allComplete,
    JSON.stringify(partial));

  // A section the lesson does not have must not count, even if a stale row for
  // it exists — a student who completed video on a lesson that later lost its
  // video must not read as 5/4.
  const stale = summarise(four, {
    slides: complete("slides"), video: complete("video"),
  });
  t("⚠ a state for a section this lesson does NOT have is ignored, not counted",
    stale.complete === 1 && stale.total === 4, JSON.stringify(stale));

  const none = summarise([], {});
  t("an empty lesson is 0/0 and NOT 'all complete' (0/0 must not read as done)",
    none.total === 0 && none.percent === 0 && !none.allComplete, JSON.stringify(none));

  const inProgressDoesNotCount = summarise(["slides", "notes"], {
    slides: { key: "slides", status: "in_progress", completedAt: null, source: null },
  });
  t("in_progress is NOT complete", inProgressDoesNotCount.complete === 0,
    JSON.stringify(inProgressDoesNotCount));
}

// ============================================================================
console.log("\n=== 3. ⚠ SABOTAGE — the notes renderer must never parse HTML ===");
// ============================================================================
{
  // The renderer's entire security position is that it emits React ELEMENTS
  // and never interprets a tag. If a tag ever became structure, this is where
  // it shows: the payload must survive intact, as text, inside a paragraph.
  const attacks = [
    `<script>alert('xss')</script>`,
    `<img src=x onerror="alert(1)">`,
    `<a href="javascript:alert(1)">click</a>`,
    `<iframe src="//evil.test"></iframe>`,
  ];
  for (const payload of attacks) {
    const blocks = parseBlocks(payload);
    const asText = blocks.map((b) => ("text" in b ? b.text : b.items.join(" "))).join(" ");
    t(`⚠ ${payload.slice(0, 28)}… survives as literal TEXT, never as structure`,
      blocks.length === 1 && blocks[0].kind === "p" && asText === payload,
      `${blocks.length} block(s): ${JSON.stringify(blocks)}`);
  }

  const mixed = parseBlocks(`## Heading\n\nSome <b>bold-looking</b> text.`);
  t("⚠ a tag inside real markdown is still text — the heading parses, the tag does not",
    mixed.length === 2 && mixed[0].kind === "h2" &&
    mixed[1].kind === "p" && "text" in mixed[1] && mixed[1].text.includes("<b>"),
    JSON.stringify(mixed));
}

// ============================================================================
console.log("\n=== 4. the markdown subset parses what notes actually contain ===");
// ============================================================================
{
  const src = [
    "## Key definitions",
    "",
    "The **mole** is the amount of substance containing 6.02 × 10²³ specified particles.",
    "",
    "- n = m ÷ M",
    "- N = n × L",
    "",
    "1. Identify the data",
    "2. Choose the equation",
    "",
    "> Exam tip: always quote the unit.",
    "",
    "### Common misconception",
    "Forgetting the ×6 for glucose.",
  ].join("\n");
  const b = parseBlocks(src);
  const kinds = b.map((x) => x.kind).join(",");
  t("blocks parse in order: h2, p, ul, ol, quote, h3, p",
    kinds === "h2,p,ul,ol,quote,h3,p", kinds);

  const ul = b.find((x) => x.kind === "ul");
  t("bullet items keep their content", Boolean(ul && "items" in ul && ul.items.length === 2 &&
    ul.items[0] === "n = m ÷ M"), JSON.stringify(ul));

  const ol = b.find((x) => x.kind === "ol");
  t("numbered items are a separate list, not merged into the bullets",
    Boolean(ol && "items" in ol && ol.items.length === 2), JSON.stringify(ol));

  // Chemistry is typed as Unicode, exactly as the decks do — nothing to parse.
  const chem = parseBlocks("Concentration in mol dm⁻³, mass in g, M(H₂O) = 18.0 g mol⁻¹.");
  t("⚠ chemical notation passes through byte-for-byte (no LaTeX, nothing to break)",
    chem.length === 1 && "text" in chem[0] && chem[0].text.includes("mol dm⁻³") &&
    chem[0].text.includes("H₂O"), JSON.stringify(chem));

  const blank = parseBlocks("");
  t("empty source yields no blocks rather than one empty paragraph", blank.length === 0);

  const runOn = parseBlocks("line one\nline two\n\nnew para");
  t("consecutive lines join into one paragraph; a blank line starts a new one",
    runOn.length === 2 && "text" in runOn[0] && runOn[0].text === "line one line two",
    JSON.stringify(runOn));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
