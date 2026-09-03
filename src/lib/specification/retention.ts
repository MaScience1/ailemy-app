/**
 * The retention engine — how confident are we that demonstrated competence is
 * still available NOW?
 *
 * ============================================================================
 * ⚠ RETENTION NEVER REWRITES MASTERY (owner decision, 2026-09-03)
 * ============================================================================
 * A student who demonstrated 90% seven weeks ago still demonstrated 90% —
 * that history is not silently marked down because time passed. Retention is
 * a SECOND, orthogonal dimension: "how stale is the demonstration", carried
 * beside the mastery facts, never multiplied into them.
 *
 * THE RULES, EXACTLY:
 *
 * A point is ELIGIBLE for retention/retrieval only when its mastery state is
 * developing or secure — demonstrated competence worth protecting. Unstarted,
 * insufficient and emerging points belong to PRACTICE (recommendNext), not to
 * a retrieval queue: retrieving what was never learned retrieves nothing.
 *
 * A QUALIFYING DEMONSTRATION is one answer with markAwarded/markAvailable >=
 * MASTERY_SECURE_AT (a correct 1-marker; 3 of 4 on a structured part). The
 * threshold is REUSED from academic.ts, not a new number.
 *
 * DEMONSTRATION DAYS: distinct calendar days (UTC) carrying at least one
 * qualifying demonstration. Counting DAYS, not answers, is the §24
 * immediate-retry discount the captured data actually supports: getting a
 * question right five times in one sitting is one day of evidence, not five
 * independent recalls. (True hint/independence weighting activates when
 * those fields are captured — nothing is invented meanwhile.)
 *
 * THE INTERVAL LADDER: RETENTION_INTERVALS_DAYS = [7, 14, 30, 60], indexed
 * by demonstration days (1 day of success → 7-day interval, 2 → 14, 3 → 30,
 * 4+ → 60). Repeated success on different days EXTENDS the interval — the
 * §10 post-retrieval rule — and a new qualifying demonstration both resets
 * the age and (on a new day) climbs the ladder, deterministically, with no
 * stored schedule: the schedule IS a function of the evidence.
 *
 * BANDS, from age = days since the last qualifying demonstration and
 * interval I:
 *
 *   age <= I/2      → fresh          (retrievalDue false)
 *   age <= I        → aging          (retrievalDue false — "review soon")
 *   age <= 2 x I    → at-risk        (retrievalDue TRUE)
 *   age  > 2 x I    → stale          (retrievalDue TRUE — long overdue)
 *
 * FAILURE: an answer with ratio < MASTERY_DEVELOPING_AT (again reused). A
 * failed answer does NOT reset the age — the last success stands — it grows
 * failStreak (consecutive newest-first failures). FAIL_STREAK_INTERVENTION=3
 * consecutive failures on a previously demonstrated point flags
 * intervention: retrieval alone is no longer the right prescription.
 */

import {
  MASTERY_DEVELOPING_AT,
  MASTERY_SECURE_AT,
} from "../account/academic.ts";
import type {
  MasteryEvidenceRow,
  RetentionFacts,
  RetrievalState,
  SpecMasteryFacts,
} from "./types.ts";

export const RETENTION_INTERVALS_DAYS = [7, 14, 30, 60] as const;
export const FAIL_STREAK_INTERVENTION = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

const NOT_ELIGIBLE: RetentionFacts = {
  eligible: false,
  band: null,
  retrievalDue: false,
  lastDemonstratedAt: null,
  demonstrationDays: 0,
  intervalDays: null,
  ageDays: null,
  failStreak: 0,
};

const isDemonstration = (r: MasteryEvidenceRow) =>
  r.markAwarded / r.markAvailable >= MASTERY_SECURE_AT;
const isFailure = (r: MasteryEvidenceRow) =>
  r.markAwarded / r.markAvailable < MASTERY_DEVELOPING_AT;

export function retentionFor(input: {
  facts: SpecMasteryFacts;
  rows: MasteryEvidenceRow[];
  nowIso: string;
}): RetentionFacts {
  const { facts, rows, nowIso } = input;
  if (facts.state !== "developing" && facts.state !== "secure") {
    // failStreak is still worth carrying for ranking, but the point is a
    // practice concern, not a retrieval one.
    return { ...NOT_ELIGIBLE, failStreak: failStreakOf(rows) };
  }

  const dated = rows
    .filter((r) => r.attemptedAt !== null)
    .sort((a, b) => a.attemptedAt!.localeCompare(b.attemptedAt!));

  const demoDays = new Set<string>();
  let lastDemonstratedAt: string | null = null;
  for (const r of dated) {
    if (!isDemonstration(r)) continue;
    demoDays.add(r.attemptedAt!.slice(0, 10));
    lastDemonstratedAt = r.attemptedAt!;
  }

  // Eligible state but no timestamped qualifying demonstration — a rated
  // point earned by many partial answers. It cannot be scheduled (there is
  // no "last success" to age from), so it is honestly not queued rather
  // than given an invented date.
  if (lastDemonstratedAt === null || demoDays.size === 0) {
    return { ...NOT_ELIGIBLE, failStreak: failStreakOf(dated) };
  }

  const intervalDays =
    RETENTION_INTERVALS_DAYS[
      Math.min(demoDays.size, RETENTION_INTERVALS_DAYS.length) - 1
    ];
  const ageDays = Math.max(
    0,
    Math.floor((Date.parse(nowIso) - Date.parse(lastDemonstratedAt)) / DAY_MS),
  );

  const band =
    ageDays <= intervalDays / 2
      ? "fresh"
      : ageDays <= intervalDays
        ? "aging"
        : ageDays <= 2 * intervalDays
          ? "at-risk"
          : "stale";

  return {
    eligible: true,
    band,
    retrievalDue: ageDays > intervalDays,
    lastDemonstratedAt,
    demonstrationDays: demoDays.size,
    intervalDays,
    ageDays,
    failStreak: failStreakOf(dated),
  };
}

/** Consecutive failures, counted from the newest answer backwards. */
function failStreakOf(rows: MasteryEvidenceRow[]): number {
  const dated = rows
    .filter((r) => r.attemptedAt !== null)
    .sort((a, b) => b.attemptedAt!.localeCompare(a.attemptedAt!));
  let streak = 0;
  for (const r of dated) {
    if (!isFailure(r)) break;
    streak += 1;
  }
  return streak;
}

/**
 * The actionable state a UI or (in Phase 3) Hydrogen acts on — retention
 * bands folded together with the failure history:
 *
 *   failStreak >= 3 on an eligible point → intervention-needed
 *   band fresh                           → fresh
 *   band aging                           → review-soon
 *   band at-risk / stale                 → retrieval-due
 *
 * null for ineligible points: they have no retrieval state at all, rather
 * than a misleading "fresh".
 */
export function retrievalStateFor(retention: RetentionFacts): RetrievalState | null {
  if (!retention.eligible) return null;
  if (retention.failStreak >= FAIL_STREAK_INTERVENTION) return "intervention-needed";
  if (retention.band === "fresh") return "fresh";
  if (retention.band === "aging") return "review-soon";
  return "retrieval-due";
}
