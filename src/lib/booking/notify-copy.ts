// ⚠ RELATIVE, WITH .ts — this module is imported by a suite under plain node,
// which resolves neither the "@/" alias nor an extensionless path.
import { dualTime, formatDay, CANONICAL_TZ } from "../schedule/timezone.ts";
import type { NotifyKind } from "./notify-keys.ts";

/**
 * Turning a stored FACT into a sentence a student reads (§47).
 *
 * ============================================================================
 * ⚠ THE COPY LIVES HERE AND THE FACTS LIVE IN THE ROW. THAT IS THE WHOLE
 * REASON payload IS FACTS AND NOT A RENDERED SENTENCE.
 * ============================================================================
 * Fix a wording mistake in this file and every message ever sent renders
 * correctly the next time it is read — including the ones already in somebody's
 * panel. Had the sentence been stored at write time, the mistake would be
 * permanent and re-sending would be the only remedy.
 *
 * ⚠ AND AN UNKNOWN KIND MUST NEVER THROW. 0053's CHECK constraint lists nine
 * kinds; this file must keep working if a tenth is added to the database before
 * a template exists for it, because the alternative is that adding a row to a
 * table takes down /profile for everyone who has one. Unknown degrades to an
 * honest, generic line naming the kind.
 *
 * ⚠ EVERY payload READ IS DEFENSIVE. The column is jsonb with no shape
 * enforced, rows written by older code are still there, and a missing field
 * must produce a shorter sentence rather than "undefined" in front of a parent.
 */

export type NotificationCopy = { title: string; detail: string | null };

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const bool = (v: unknown): boolean => v === true;

/** An ISO instant, or null for anything that is not one. Never an Invalid Date. */
const at = (v: unknown): Date | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * ⚠ BOTH CLOCKS, THE SAME WAY THE REST OF THE SITE DOES IT. A notification
 * saying "19:00" with no zone is the single most likely way to make somebody
 * miss a lesson, and this is the one surface where the student is NOT looking
 * at a calendar that already told them which zone it means.
 */
function when(d: Date, viewerTz: string | null): string {
  const t = dualTime(d, viewerTz);
  const day = formatDay(d, CANONICAL_TZ);
  return t.viewer
    ? `${day}, ${t.canonical} ${t.canonicalLabel} (${t.viewer} ${t.viewerLabel})`
    : `${day}, ${t.canonical} ${t.canonicalLabel}`;
}

export function describeNotification(
  kind: NotifyKind | string,
  payload: Record<string, unknown>,
  viewerTz: string | null,
): NotificationCopy {
  const ref = str(payload.bookingRef);
  const starts = at(payload.startsAt);
  const refSuffix = ref ? ` · ${ref}` : "";

  switch (kind) {
    case "booking_confirmed":
      return {
        title: "Your 1-to-1 lesson is booked",
        detail: starts ? `${when(starts, viewerTz)}${refSuffix}` : ref,
      };

    case "booking_cancelled":
      return {
        title: "Your 1-to-1 lesson was cancelled",
        detail: bool(payload.creditRestored)
          ? "Your lesson credit is back on your account."
          // ⚠ NOT "your credit was NOT restored". A cash lesson never had one,
          // and telling somebody a credit is missing invents a problem.
          : null,
      };

    case "credit_restored":
      return { title: "A lesson credit is back on your account", detail: null };

    case "cancellation_requested":
      return {
        title: "We have your cancellation request",
        // ⚠ THE SENTENCE 0052 EXISTS FOR. A student who reads "requested" as
        // "cancelled" does not turn up.
        detail: "Your lesson stays booked until we reply — please still come unless we say otherwise.",
      };

    case "cancellation_resolved": {
      const resolution = str(payload.resolution);
      const cancelled = bool(payload.lessonCancelled);
      const detail =
        resolution === "refunded" ? "We are refunding this lesson."
        : resolution === "credited" ? "A lesson credit has gone back on your account."
        : resolution === "rescheduled" ? "We have moved this lesson — check your calendar."
        : resolution === "declined" ? "This lesson is going ahead as booked."
        : null;
      return {
        title: cancelled ? "Your cancellation request was accepted" : "We have answered your cancellation request",
        detail,
      };
    }

    case "session_moved": {
      const from = at(payload.previousStartsAt);
      const to = at(payload.startsAt);
      return {
        title: "A lesson has moved",
        detail: from && to
          ? `Was ${when(from, viewerTz)} — now ${when(to, viewerTz)}.`
          : to ? `Now ${when(to, viewerTz)}.` : null,
      };
    }

    case "session_cancelled":
      return {
        title: "A lesson has been cancelled",
        detail: [starts ? when(starts, viewerTz) : null, str(payload.reason)]
          .filter(Boolean).join(" — ") || null,
      };

    case "session_added":
      return {
        title: str(payload.title) ?? "A lesson has been added",
        detail: starts ? when(starts, viewerTz) : null,
      };

    case "announcement":
      return {
        // An announcement is the one kind whose words are genuinely the fact.
        title: str(payload.title) ?? "A note from Ailemy",
        detail: str(payload.body),
      };

    default:
      /**
       * ⚠ HONEST, NOT SILENT, AND NOT A CRASH. It names the kind so an operator
       * reading a screenshot knows which template is missing, and it tells the
       * student there is something to ask about rather than showing a blank row
       * that looks like a bug.
       */
      return {
        title: "There is an update about your tuition",
        detail: `We do not have wording for this yet (${String(kind)}). Please ask us.`,
      };
  }
}
