/**
 * Precedent matching, verdict suggestion, and what may never be automated.
 *
 * ============================================================================
 * ⚠ A SUGGESTION IS NOT A RULING. THAT IS THE WHOLE CONTRACT.
 * ============================================================================
 * Everything in this file produces ADVICE. Nothing here writes a ruling,
 * approves a question, or reaches the emitter. A line carrying a suggestion is
 * unruled in every sense the rest of the system understands: `isResolved` says
 * false, `pointsFullyRuled` says false, the Approve button stays disabled, and
 * `toFixture` refuses the question by name.
 *
 * The reason is not caution for its own sake. The founder is the signing
 * examiner: a mark scheme that awards a student a mark is a claim a person
 * made, and a tool that can quietly turn its own guess into that claim has
 * removed the person from the loop while still printing their name on it.
 * Speed comes from making the decision FAST TO CONFIRM, never from making it
 * on their behalf.
 *
 * ============================================================================
 * ⚠ THE SUPERSCRIPT TRAP, WHICH IS WHY BYTE-IDENTICAL IS NOT ENOUGH
 * ============================================================================
 * The PDF text layer FLATTENS superscripts. "1.672 × 10²¹" arrives as
 * "1.672 × 1021", and the extractor's proposal and the source line then match
 * each other perfectly — both are wrong in exactly the same way. Byte equality
 * proves the extractor copied faithfully; it proves nothing about whether the
 * characters mean what they appear to mean.
 *
 * So exact-match auto-verification is refused outright for any line that could
 * be carrying a flattened superscript, and those lines go to the founder. A
 * tenth of the rest are sampled for a spot check that shows the RENDERED page
 * band — pixels, not text — because comparing flattened text against flattened
 * text is a check that cannot fail in the one way that matters.
 *
 * Pure and import-free except for option detection, so the suites load it
 * under plain `node`. See markscheme-proposals.ts on `.ts` specifiers.
 */
import { resolveDistractorOption } from "./distractor.ts";

// ============================================================================
// WHAT A PRECEDENT IS
// ============================================================================

/** The verdicts a precedent may propose. Deliberately the ruling kinds. */
export type PrecedentVerdict =
  | "criterion"
  | "accept"
  | "reject"
  | "guidance"
  | "distractor_feedback"
  | "discard";

export type Precedent = {
  /** Stable, referenced in provenance: "P1". */
  id: string;
  /** What an examiner would call this rule. */
  title: string;
  /** Why this verdict — shown on the review screen, in the founder's terms. */
  rationale: string;
  /** JavaScript regex source, case-insensitive. Matched against the line text. */
  pattern: string;
  verdict: PrecedentVerdict;
  /**
   * True when the verdict needs an MCQ option letter (distractor feedback).
   * Detection is delegated to distractor.ts and REFUSES rather than guessing.
   */
  needsOption?: boolean;
  /**
   * Where this precedent came from. "canon" is the locked examiner canon;
   * anything else names the question whose ruling it was generalised from.
   */
  source: "canon" | string;
  /** The founder's own ruled line, when this was derived rather than written. */
  derivedFrom?: string;
};

export type PrecedentStore = {
  version: number;
  note: string;
  precedents: Precedent[];
};

// ============================================================================
// THE SUPERSCRIPT RISK
// ============================================================================

/**
 * Patterns that mean "the text layer may have flattened something".
 *
 * ⚠ DELIBERATELY OVER-BROAD. A false positive costs the founder one glance at
 * a line they were going to see anyway; a false negative auto-verifies
 * "1.672 × 1021" as if it said 10²¹ and puts a wrong number into a mark
 * scheme. The asymmetry is total, so these are tuned to over-catch.
 */
export const SUPERSCRIPT_RISK: { name: string; re: RegExp }[] = [
  // The live example: 1.672 × 10²¹ flattened to "1.672 × 1021".
  { name: "scientific notation", re: /[×x]\s?10\s?\d/ },
  // Formula and unit adjacency: C11H24, dm3, cm3, H2O, mol dm-3.
  { name: "letter-then-digit", re: /[A-Za-z]\d/ },
  { name: "digit-then-letter", re: /\d[A-Za-z]/ },
  // Equations, where state symbols and arrows also flatten.
  { name: "reaction arrow", re: /[→⇌⇋↔]/ },
  // Charges: Br-, 2+, Cu2+.
  { name: "charge after digit", re: /\d[+−–—-]/ },
  { name: "charge before digit", re: /[+−–—-]\d/ },
];

export type RiskReport = { risky: boolean; reasons: string[] };

/** Does this text carry anything the PDF text layer may have flattened? */
export function superscriptRisk(text: string): RiskReport {
  const reasons = SUPERSCRIPT_RISK.filter((p) => p.re.test(text ?? "")).map((p) => p.name);
  return { risky: reasons.length > 0, reasons };
}

export type VerifyDecision =
  | { eligible: true }
  | { eligible: false; reason: string; risky: boolean };

/**
 * May this white card be auto-verified?
 *
 * ⚠ BOTH CONDITIONS, AND THE SECOND IS THE REAL ONE. Byte equality says the
 * extractor copied the line faithfully. It says nothing about whether the line
 * itself survived the text layer — see the header.
 */
export function canAutoVerify(proposalText: string, sourceLine: string): VerifyDecision {
  if (proposalText !== sourceLine) {
    return {
      eligible: false,
      risky: false,
      reason: "The proposal is not byte-identical to the source line.",
    };
  }
  const risk = superscriptRisk(proposalText);
  if (risk.risky) {
    return {
      eligible: false,
      risky: true,
      reason: `superscript-risk — manual only (${risk.reasons.join(", ")})`,
    };
  }
  return { eligible: true };
}

/**
 * Which auto-verified cards go to the human spot check.
 *
 * ⚠ A SAMPLE THAT IS NEVER ZERO. 10% of three cards is nothing, and a check
 * that never runs is a check that cannot catch anything — so the floor is
 * three per paper, or all of them when there are fewer than three.
 *
 * ⚠ DETERMINISTIC, BY POSITION. Math.random() would resample on every render,
 * so the queue would change under the founder's hands mid-check, and it is
 * unavailable in workflow scripts besides. Evenly spaced beats "the first
 * three", which would only ever check the top of the paper.
 */
export const SPOT_CHECK_RATE = 0.1;
export const SPOT_CHECK_FLOOR = 3;

export function spotCheckIndices(total: number): number[] {
  if (total <= 0) return [];
  const want = Math.min(total, Math.max(SPOT_CHECK_FLOOR, Math.ceil(total * SPOT_CHECK_RATE)));
  const step = total / want;
  const out: number[] = [];
  for (let i = 0; i < want; i++) {
    const idx = Math.min(total - 1, Math.floor(i * step));
    if (!out.includes(idx)) out.push(idx);
  }
  // Rounding can collide on tiny inputs; fill forward so the count is honoured.
  for (let i = 0; out.length < want && i < total; i++) if (!out.includes(i)) out.push(i);
  return out.sort((a, b) => a - b);
}

// ============================================================================
// MATCHING
// ============================================================================

export type Suggestion = {
  verdict: PrecedentVerdict;
  /** One line, in the founder's terms: "matches P2" or the verb pattern. */
  reason: string;
  /** 0–1. Below CONFIDENCE_FLOOR nothing is suggested at all. */
  confidence: number;
  /** Set when a precedent produced this. Recorded in provenance on confirm. */
  precedentId?: string;
  /** For distractor feedback. Absent means the founder must choose. */
  option?: string;
};

/**
 * ⚠ BELOW THIS, SAY NOTHING. A weak suggestion is worse than none: it costs
 * the same glance to read, it is wrong often enough to need checking anyway,
 * and a reviewer who learns the suggestions are unreliable stops reading the
 * good ones too.
 */
export const CONFIDENCE_FLOOR = 0.7;

/** Compile once. A bad pattern in the store must not take the surface down. */
function compile(p: Precedent): RegExp | null {
  try {
    return new RegExp(p.pattern, "i");
  } catch {
    return null;
  }
}

/**
 * The first precedent that matches, with its option resolved where needed.
 *
 * ⚠ ORDER IS THE TIE-BREAK, AND THE STORE IS ORDERED MOST-SPECIFIC-FIRST. The
 * distractor pattern must be tried before the general verb rules, or
 * "A is incorrect because…" reads as a plain reject.
 */
export function matchPrecedent(
  text: string,
  store: readonly Precedent[],
  correctOption?: string | null,
): Suggestion | null {
  for (const p of store) {
    const re = compile(p);
    if (!re || !re.test(text)) continue;

    if (p.needsOption) {
      const found = resolveDistractorOption(text, correctOption ?? null);
      if (found.status !== "detected") {
        // ⚠ MATCHED THE SHAPE, COULD NOT NAME THE OPTION. Suggest the verdict
        // WITHOUT an option: the founder still picks the letter, and the
        // ruling stays incomplete until they do (isResolved says false).
        return {
          verdict: p.verdict,
          reason: `matches ${p.id} — ${found.reason}`,
          confidence: CONFIDENCE_FLOOR,
          precedentId: p.id,
        };
      }
      return {
        verdict: p.verdict,
        reason: `matches ${p.id} · option ${found.option}`,
        confidence: 1,
        precedentId: p.id,
        option: found.option,
      };
    }

    return { verdict: p.verdict, reason: `matches ${p.id}`, confidence: 1, precedentId: p.id };
  }
  return null;
}

// ============================================================================
// THE VERB CLASSIFIER — what the line's own grammar says it is
// ============================================================================

/**
 * ⚠ DISCARD IS NOT REACHABLE FROM HERE, AT ALL.
 *
 * Every other wrong suggestion is visible: a criterion filed as guidance still
 * shows its text on the question. A wrong Discard deletes the examiner's
 * sentence from everything downstream, silently, and the only way to notice is
 * to re-read the original PDF. It may only ever come from an exact precedent
 * match, where a human wrote the rule down first.
 */
const VERB_RULES: { re: RegExp; verdict: PrecedentVerdict; why: string; confidence: number }[] = [
  // Scope and conditional language — the examiner qualifying HOW to mark,
  // rather than naming something that earns or loses a mark.
  { re: /\bignore\b/i, verdict: "guidance", why: "verb pattern: Ignore… → Guidance", confidence: 0.9 },
  { re: /\bTE\b|\becf\b/i, verdict: "guidance", why: "TE/ecf scope → Guidance", confidence: 0.9 },
  { re: /\bSF\b|significant figure/i, verdict: "guidance", why: "SF scope → Guidance", confidence: 0.9 },
  { re: /scores?\s*\(?\d|\bno working\b/i, verdict: "guidance", why: "tariff override → Guidance", confidence: 0.85 },
  { re: /\bif\b.+\bthen\b|\bprovided that\b|\bunless\b/i, verdict: "guidance", why: "conditional → Guidance", confidence: 0.75 },

  // ⚠ NEGATIVES BEFORE POSITIVES. "Do not accept X" contains "accept", and
  // reading it as a concession is the exact failure that shipped once already.
  { re: /^\s*(do not|don't)\s+(accept|allow|award|credit)/i, verdict: "reject", why: "verb pattern: Do not accept… → Reject", confidence: 0.95 },
  { re: /^\s*(reject|no marks?\b)/i, verdict: "reject", why: "verb pattern: Reject… → Reject", confidence: 0.95 },

  { re: /^\s*(allow|accept|credit)\b/i, verdict: "accept", why: "verb pattern: Allow… → Accept", confidence: 0.9 },
];

/**
 * A line that NAMES what earns the mark, rather than qualifying it.
 *
 * ⚠ HIGH CONFIDENCE ONLY, AND DELIBERATELY NARROW. Promoting a line to
 * criterion adds a marking point, which changes what a student can score. The
 * cost of missing one is that the founder rules it by hand — which is the
 * status quo, and costs nothing.
 */
const CRITERION_RE = /^\s*(?:M\d\b|award\s+(?:one|1|a)\s+mark|\(?\d\)?\s*marks?\s+for\b)/i;

export function classifyByVerb(text: string): Suggestion | null {
  const line = (text ?? "").trim();
  if (!line) return null;

  if (CRITERION_RE.test(line)) {
    return { verdict: "criterion", reason: "names what earns the mark → Criterion", confidence: 0.85 };
  }
  for (const rule of VERB_RULES) {
    if (rule.re.test(line)) {
      return { verdict: rule.verdict, reason: rule.why, confidence: rule.confidence };
    }
  }
  return null;
}

/**
 * The suggestion for one unruled line: precedent first, then grammar.
 *
 * Returns null — meaning the card shows nothing at all — whenever confidence
 * falls below the floor. See CONFIDENCE_FLOOR.
 */
export function suggestFor(
  text: string,
  store: readonly Precedent[],
  correctOption?: string | null,
): Suggestion | null {
  const byPrecedent = matchPrecedent(text, store, correctOption);
  if (byPrecedent) return byPrecedent;

  const byVerb = classifyByVerb(text);
  if (!byVerb) return null;
  if (byVerb.confidence < CONFIDENCE_FLOOR) return null;

  // ⚠ BELT AND BRACES. classifyByVerb cannot return discard today; this makes
  // that a property of the exported function rather than of one table.
  if (byVerb.verdict === "discard") return null;

  return byVerb;
}

// ============================================================================
// BATCH APPLY — what WOULD be written, computed without writing anything
// ============================================================================

export type BatchCandidate = {
  questionNumber: string;
  sourceLine: string;
  text: string;
  page: number;
  y: number;
  suggestion: Suggestion;
};

export type BatchPlan = {
  /** Grouped by precedent id for the review screen. */
  groups: { precedentId: string; title: string; verdict: PrecedentVerdict; candidates: BatchCandidate[] }[];
  /** Every candidate, flat, for counting. */
  all: BatchCandidate[];
  /** Questions deliberately skipped, and why — shown so the skip is visible. */
  skipped: { questionNumber: string; reason: string }[];
};

type PlanQuestion = {
  questionNumber: string;
  points: readonly { criterion: string }[];
  requiresRuling: readonly { sourceLine: string; text: string; page: number; y: number }[];
};

/**
 * Compute every precedent match among UNRULED lines. Writes nothing.
 *
 * ⚠ THREE THINGS IT WILL NOT TOUCH, and each was a way to destroy examiner
 * work: a line that already carries a ruling, any line on an APPROVED
 * question, and any match that came from the verb classifier rather than a
 * written precedent. Batch apply is for rules a human wrote down; the verb
 * classifier is advice on a single card, where it is read one at a time.
 */
export function planBatch(
  questions: readonly PlanQuestion[],
  rulings: Readonly<Record<string, { lines?: Record<string, unknown>; approvedAt?: string } | undefined>>,
  store: readonly Precedent[],
  correctOptionOf: (q: PlanQuestion) => string | null,
): BatchPlan {
  const all: BatchCandidate[] = [];
  const skipped: { questionNumber: string; reason: string }[] = [];

  for (const q of questions) {
    const book = rulings[q.questionNumber];
    if (book?.approvedAt) {
      skipped.push({ questionNumber: q.questionNumber, reason: "already approved" });
      continue;
    }
    const done = book?.lines ?? {};
    for (const line of q.requiresRuling) {
      if (done[line.sourceLine]) continue; // ⚠ never re-rule a ruled line
      const s = matchPrecedent(line.text, store, correctOptionOf(q));
      if (!s?.precedentId) continue;
      all.push({
        questionNumber: q.questionNumber,
        sourceLine: line.sourceLine,
        text: line.text,
        page: line.page,
        y: line.y,
        suggestion: s,
      });
    }
  }

  const byId = new Map<string, BatchCandidate[]>();
  for (const c of all) {
    const id = c.suggestion.precedentId!;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push(c);
  }
  const groups = [...byId.entries()].map(([precedentId, candidates]) => {
    const p = store.find((x) => x.id === precedentId);
    return {
      precedentId,
      title: p?.title ?? precedentId,
      verdict: p?.verdict ?? candidates[0].suggestion.verdict,
      candidates,
    };
  });

  return { groups, all, skipped };
}

// ============================================================================
// WHAT A BATCH CONFIRM WRITES — decided purely, so it can be tested
// ============================================================================

export type BatchEntry = {
  sourceLine: string;
  kind: PrecedentVerdict;
  option?: string;
  precedentId?: string;
};

export type LineRulingLike = {
  kind: string;
  option?: string;
  provenance?: { method: "manual" | "batch"; precedentId?: string };
};

export type MergeDecision = {
  /** The question's new `lines` map. Identical to the old one when nothing applies. */
  lines: Record<string, LineRulingLike>;
  added: number;
  skipped: { sourceLine: string; reason: string }[];
};

/**
 * Merge confirmed batch entries into one question's existing rulings.
 *
 * ============================================================================
 * ⚠ EXTRACTED FROM applyBatch SO THAT IT IS TESTABLE AT ALL
 * ============================================================================
 * applyBatch is `server-only` — it reads the filesystem and the caller's
 * session — so a plain `node` suite cannot load it, and the three refusals
 * that protect examiner work would have been the least-tested code in the
 * feature that writes the most rulings at once. The decision is pure and lives
 * here; applyBatch supplies the disk and the session and does what this says.
 *
 * The refusals, and what each one prevents:
 *   - APPROVED question -> nothing at all is written. Adding a ruling to a
 *     signed mark scheme changes a human's conclusion without their knowledge.
 *   - LINE ALREADY RULED -> left exactly as it was. The founder's own decision
 *     always outranks a precedent, including a precedent derived from it.
 *   - NO VALID OPTION on distractor feedback -> not written. isResolved would
 *     call it unresolved, so writing it would produce a question that looks
 *     ruled, cannot be approved, and gives no reason why.
 *
 * Every refusal is RETURNED, never swallowed: a batch that silently applied to
 * 40 of 60 lines and reported success is indistinguishable from one that
 * worked.
 */
export function mergeBatchIntoBook(
  existing: { lines?: Record<string, LineRulingLike>; approvedAt?: string } | undefined,
  entries: readonly BatchEntry[],
  isResolvedFn: (r: LineRulingLike) => boolean,
): MergeDecision {
  const lines: Record<string, LineRulingLike> = { ...(existing?.lines ?? {}) };

  if (existing?.approvedAt) {
    return {
      lines,
      added: 0,
      skipped: entries.map((e) => ({ sourceLine: e.sourceLine, reason: "question already approved" })),
    };
  }

  const skipped: { sourceLine: string; reason: string }[] = [];
  let added = 0;

  for (const e of entries) {
    if (lines[e.sourceLine]) {
      skipped.push({ sourceLine: e.sourceLine, reason: "already ruled — left as it was" });
      continue;
    }
    const ruling: LineRulingLike = {
      kind: e.kind,
      provenance: { method: "batch", ...(e.precedentId ? { precedentId: e.precedentId } : {}) },
      ...(e.option ? { option: e.option } : {}),
    };
    if (!isResolvedFn(ruling)) {
      skipped.push({ sourceLine: e.sourceLine, reason: "no option letter — this one needs you to pick it" });
      continue;
    }
    lines[e.sourceLine] = ruling;
    added++;
  }

  return { lines, added, skipped };
}
