/**
 * What a capacity figure is allowed to say (§14).
 *
 * ============================================================================
 * ⚠ PURE, AND THAT IS STRUCTURAL RATHER THAN TIDY
 * ============================================================================
 * The reader half is `import "server-only"`, so anything importing it drags a
 * Supabase client and a server boundary along. Keeping the RULES here means a
 * test asserts every one of them with no credentials and no database — the same
 * split academic.ts and results-insights.ts already use, and the reason those
 * two are testable at all.
 *
 * ⚠ THE BRIEF SAYS "DO NOT CREATE FAKE SCARCITY", AND THERE ARE THREE WAYS TO:
 * render a number from a FAILED read; render one that is true and misleading
 * ("20 places left" on a cohort nobody has joined reads as an empty room); or
 * render urgency before it exists. The first is the dangerous one, because it
 * looks identical to the truth — and it is the reader's job, below.
 */

export type Capacity =
  | { known: false; reason: string }
  | {
      known: true;
      taken: number;
      cap: number;
      remaining: number;
      /** Rendered state. `quiet` means: say nothing about scarcity. */
      state: "quiet" | "available" | "few-left" | "full";
      label: string | null;
    };

/**
 * ⚠ FEW-LEFT AT A QUARTER OF THE CAP, WRITTEN DOWN SO IT CAN BE ARGUED WITH.
 * On a cap of 20 that is five. Low enough to be true urgency rather than a
 * growth tactic, high enough that a family has time to act on it.
 */
export const FEW_LEFT_FRACTION = 0.25;

/**
 * ⚠ NOTHING IS SAID UNTIL A QUARTER OF THE SEATS HAVE GONE. Before that the
 * number is a statement about how new the cohort is, not about how scarce it
 * is, and putting it on a card invites the reader to conclude nobody wants it.
 */
export const SPEAK_AFTER_FRACTION = 0.25;

export function describeCapacity(taken: number, cap: number): Capacity {
  if (cap <= 0) {
    return { known: false, reason: "This cohort has no published capacity." };
  }
  const safeTaken = Math.max(0, Math.min(taken, cap));
  const remaining = cap - safeTaken;

  if (remaining === 0) {
    return {
      known: true, taken: safeTaken, cap, remaining,
      state: "full", label: "Full — join the waiting list",
    };
  }
  if (remaining <= Math.max(1, Math.floor(cap * FEW_LEFT_FRACTION))) {
    return {
      known: true, taken: safeTaken, cap, remaining,
      state: "few-left",
      label: `${remaining} ${remaining === 1 ? "place" : "places"} left`,
    };
  }
  if (safeTaken >= Math.ceil(cap * SPEAK_AFTER_FRACTION)) {
    return {
      known: true, taken: safeTaken, cap, remaining,
      state: "available", label: `${safeTaken} of ${cap} places booked`,
    };
  }
  // ⚠ QUIET, NOT ZERO. See the header.
  return { known: true, taken: safeTaken, cap, remaining, state: "quiet", label: null };
}
