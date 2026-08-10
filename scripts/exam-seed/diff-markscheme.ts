/**
 * The self-check: extractor proposals vs the hand transcription, field by field.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/diff-markscheme.ts <proposals.json>
 *
 * ============================================================================
 * WHY THIS IS THE POINT, NOT A FORMALITY
 * ============================================================================
 * Five questions were transcribed by hand on Day 0 and are seeded: Q1, Q2,
 * 20(a), 20(b)(iii), 22(c) — 25 mark-scheme points. They are the only ground
 * truth that exists. Running the extractor at them and diffing is the only
 * evidence of accuracy anyone can check.
 *
 * ⚠ IT REPORTS, IT DOES NOT RECONCILE. Where the two disagree, EITHER may be
 * right: the extractor may have misread the table, or the hand transcription
 * may have missed something and the extractor caught it. Deciding which is a
 * human's job, so every disagreement is printed with both sides and the source
 * line, and nothing is silently preferred.
 *
 * ⚠ PER FIELD, NOT ONE NUMBER. "94% of fields agree" hides which fields. If
 * every mark allocation is right and every reject[] rule is wrong, the single
 * number still reads well while the thing that decides student marks is broken.
 */
import { WCH11_01_2025_MAY_JUNE as FIXTURE } from "./wch11-01-2025-may-june.ts";
import { readFileSync } from "node:fs";

type Proposal = {
  questionNumber: string;
  marks: { value: number; sourceLine: string } | null;
  points: {
    pointCode: string;
    criterion: string;
    marks: number | null;
    methodBlock: string | null;
    route: number;
    confidence: number;
    sourceLine: string;
  }[];
  accept: { text: string; sourceLine: string }[];
  reject: { text: string; sourceLine: string }[];
  guidance: { text: string; sourceLine: string }[];
  requiresRuling: { text: string; requiresRuling: string[] }[];
  hasAlternativeMethods?: boolean;
  routes?: number;
  marksAvailable?: number | null;
  markingRule?: string | null;
};

const proposals = JSON.parse(readFileSync(process.argv[2], "utf8")) as { questions: Proposal[] };

/** The five that are hand-transcribed AND seeded. */
const GROUND_TRUTH = ["1", "2", "20(a)", "20(b)(iii)", "22(c)"];

const BOLD = "\x1b[1m", DIM = "\x1b[2m", RED = "\x1b[31m", GREEN = "\x1b[32m",
      YELLOW = "\x1b[33m", RESET = "\x1b[0m";

/** Compare on meaning, not on whitespace or case. Never on more than that. */
const norm = (s: string) =>
  s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").replace(/[.,;]+$/, "").trim();

type Tally = { agree: number; total: number; notes: string[] };
const tally: Record<string, Tally> = {};
const record = (field: string, ok: boolean, note?: string) => {
  const t = (tally[field] ??= { agree: 0, total: 0, notes: [] });
  t.total += 1;
  if (ok) t.agree += 1;
  else if (note) t.notes.push(note);
};

console.log(`\n${BOLD}EXTRACTOR vs HAND TRANSCRIPTION${RESET}`);
console.log(`${DIM}Ground truth: ${GROUND_TRUTH.join(", ")} — the questions transcribed on Day 0 and seeded.${RESET}\n`);

for (const qn of GROUND_TRUTH) {
  const fixture = FIXTURE.questions.find((q) => q.questionNumber === qn);
  const proposed = proposals.questions.find((q) => q.questionNumber === qn);

  console.log(`${BOLD}━━ ${qn} ━━${RESET}`);
  if (!fixture) { console.log(`  ${RED}not in the fixture${RESET}`); continue; }
  if (!proposed) {
    console.log(`  ${RED}NOT EXTRACTED — the extractor produced no block for this question${RESET}`);
    record("question found", false, `${qn}: extractor produced nothing`);
    continue;
  }
  record("question found", true);

  // ── mark allocation ─────────────────────────────────────────────────────
  const marksOk = proposed.marks?.value === fixture.marks;
  record("mark allocation", marksOk,
    `${qn}: fixture ${fixture.marks}, extractor ${proposed.marks?.value ?? "none"}`);
  console.log(`  marks        ${marksOk ? GREEN + "agree" + RESET : RED + "DIFFER" + RESET}` +
    `  fixture=${fixture.marks} extractor=${proposed.marks?.value ?? "—"}` +
    (proposed.marks ? `  ${DIM}[${proposed.marks.sourceLine}]${RESET}` : ""));

  // ── point count ─────────────────────────────────────────────────────────
  const fixturePoints = fixture.markScheme ?? [];
  // ⚠ COMPARED PER ROUTE. 22(c) prints its three marks twice, once per route to
  // the answer; the fixture holds one route because a script takes one and can
  // earn three. Diffing the flat list against the fixture reported three
  // phantom "extractor only" points on a question where both sides agree.
  // Ruling: store both routes, mark against whichever the script matches, cap
  // at the tariff, never sum across routes.
  const route1 = proposed.points.filter((p) => (p.route ?? 1) === 1);
  const otherRoutes = proposed.points.filter((p) => (p.route ?? 1) !== 1);
  const countOk = route1.length === fixturePoints.length;
  record("point count", countOk,
    `${qn}: fixture ${fixturePoints.length}, extractor route 1 ${route1.length}`);
  console.log(`  point count  ${countOk ? GREEN + "agree" + RESET : YELLOW + "DIFFER" + RESET}` +
    `  fixture=${fixturePoints.length} extractor(route 1)=${route1.length}` +
    (proposed.hasAlternativeMethods
      ? `  ${DIM}[+${otherRoutes.length} in ${(proposed.routes ?? 1) - 1} alternative route(s), capped at ${proposed.marksAvailable}]${RESET}`
      : ""));

  // ── per point: code, criterion, marks ───────────────────────────────────
  for (let i = 0; i < Math.max(fixturePoints.length, route1.length); i++) {
    const f = fixturePoints[i], p = route1[i];
    if (!f || !p) {
      const side = f ? "fixture only" : "extractor only";
      record("point criterion", false, `${qn}: ${side} — ${(f ?? p)!.criterion ?? ""}`.slice(0, 120));
      console.log(`   ${YELLOW}${(f ? f.pointCode : p.pointCode).padEnd(4)}${RESET} ${YELLOW}${side}${RESET}`);
      console.log(`        ${f ? f.criterion : p.criterion}`);
      continue;
    }
    const codeOk = f.pointCode === p.pointCode;
    record("point code", codeOk, `${qn}: ${f.pointCode} vs ${p.pointCode}`);
    const critOk = norm(f.criterion) === norm(p.criterion);
    record("point criterion", critOk);
    const markOk = (p.marks ?? 1) === 1;
    record("point mark value", markOk, `${qn} ${f.pointCode}: extractor ${p.marks}`);

    if (critOk) {
      console.log(`   ${GREEN}${p.pointCode.padEnd(4)}agree${RESET}  ${DIM}${p.criterion.slice(0, 62)}${RESET}`);
    } else {
      console.log(`   ${RED}${p.pointCode.padEnd(4)}DIFFER${RESET}`);
      console.log(`        fixture   ${f.criterion}`);
      console.log(`        extractor ${p.criterion}`);
      console.log(`        ${DIM}source    ${p.sourceLine}${RESET}`);
    }
  }

  // ── accept / reject, as SETS: order is not meaning ──────────────────────
  for (const [field, fx, px] of [
    ["accept", (fixturePoints.flatMap((p) => p.accept ?? [])), proposed.accept.map((a) => a.text)],
    ["reject", (fixturePoints.flatMap((p) => p.reject ?? [])), proposed.reject.map((a) => a.text)],
  ] as const) {
    const fset = new Set(fx.map(norm)), pset = new Set(px.map(norm));
    const both = [...fset].filter((x) => pset.has(x));
    const onlyF = [...fset].filter((x) => !pset.has(x));
    const onlyP = [...pset].filter((x) => !fset.has(x));

    // ⚠ TWO KINDS OF DISAGREEMENT, AND CONFLATING THEM IS THE LIE.
    //
    // A line the fixture classified and the extractor MISSED is a defect. A
    // line the fixture classified and the extractor deliberately ESCALATED —
    // because it carries a negation, a condition, or an SF/TE rule — is the
    // design working: it is a ruling the extractor refuses to make. Reporting
    // both as "0% agreement" makes a working refusal look like a failure, and
    // would push whoever reads it to "fix" the one guard that matters.
    const escalated = new Set(proposed.requiresRuling.map((r) => norm(r.text)));
    const refused = onlyF.filter((x) => escalated.has(x));
    const missed = onlyF.filter((x) => !escalated.has(x));

    for (const _ of both) record(`${field}[] classified alike`, true);
    for (const x of missed) record(`${field}[] classified alike`, false, `${qn}: MISSED — "${x.slice(0, 70)}"`);
    for (const x of refused) record(`${field}[] escalated not classified`, true,
      `${qn}: escalated — "${x.slice(0, 70)}"`);
    for (const x of onlyP) record(`${field}[] classified alike`, false,
      `${qn}: extractor only — "${x.slice(0, 70)}"`);

    if (missed.length || onlyP.length) {
      console.log(`  ${field.padEnd(12)} ${RED}DIFFER${RESET}  ${both.length} shared`);
    } else if (refused.length) {
      console.log(`  ${field.padEnd(12)} ${GREEN}agree${RESET}  ${both.length} shared, ` +
        `${YELLOW}${refused.length} escalated by design${RESET}`);
    } else if (both.length) {
      console.log(`  ${field.padEnd(12)} ${GREEN}agree${RESET}  ${both.length} line(s)`);
    }
    for (const x of missed) console.log(`        ${RED}MISSED        ${RESET}${x.slice(0, 76)}`);
    for (const x of refused) console.log(`        ${YELLOW}escalated     ${RESET}${x.slice(0, 76)}`);
    for (const x of onlyP) console.log(`        ${YELLOW}extractor only${RESET} ${x.slice(0, 76)}`);
  }

  if (proposed.requiresRuling.length) {
    console.log(`  ${YELLOW}${proposed.requiresRuling.length} line(s) flagged for a ruling — NOT classified:${RESET}`);
    for (const r of proposed.requiresRuling) {
      console.log(`        "${r.text.slice(0, 66)}"`);
      console.log(`        ${DIM}${r.requiresRuling.join("; ")}${RESET}`);
    }
  }
  console.log();
}

console.log(`${BOLD}PER-FIELD AGREEMENT${RESET}`);
const width = Math.max(...Object.keys(tally).map((k) => k.length));
for (const [field, t] of Object.entries(tally)) {
  const pct = t.total === 0 ? 0 : Math.round((t.agree / t.total) * 100);
  const colour = pct === 100 ? GREEN : pct >= 70 ? YELLOW : RED;
  console.log(`  ${field.padEnd(width)}  ${colour}${String(pct).padStart(3)}%${RESET}  ${t.agree}/${t.total}`);
}
console.log(`\n${DIM}"classified alike" counts lines both sides filed the same way. "escalated`);
console.log(`not classified" counts lines the extractor REFUSED to file because they`);
console.log(`carry a negation, a condition, or an SF/TE rule — those are rulings, and`);
console.log(`refusing them is the design, not a miss.${RESET}`);
console.log(`${DIM}A disagreement is not automatically an extractor error. Both sides are`);
console.log(`printed with the source line so the ruling can be made on evidence.${RESET}\n`);

for (const [field, t] of Object.entries(tally)) {
  if (!t.notes.length) continue;
  console.log(`${BOLD}${field}${RESET}`);
  for (const n of t.notes) console.log(`   ${n}`);
}
console.log();
