import type { ResponsePayload } from "./attempts";

/**
 * The boundary between what a client sends and what the database stores.
 *
 * ============================================================================
 * WHY THIS IS ITS OWN FILE
 * ============================================================================
 * It used to live inside the sit/ server action, where nothing could test it.
 * When `working` was added to the numeric payload, this function did not know
 * about it — so the editor collected the student's method, the action dropped
 * it on the floor, and the database stored a numeric answer with no working.
 * Every layer either side was correct; the feature simply did not happen, and
 * nothing anywhere reported a problem.
 *
 * That is the same shape as every other defect on this stack: a silent success.
 * The fix is not only the missing line — it is that this function is now
 * importable and has tests, because it is the one place where a field can go
 * missing without any layer noticing.
 *
 * ⚠ ADD A FIELD TO ResponsePayload, ADD IT HERE. An unknown key is DROPPED, not
 * rejected, and that is deliberate — see below — which means a field this
 * function has not been taught about is indistinguishable from one the student
 * never filled in.
 *
 * ============================================================================
 * IT NARROWS RATHER THAN COERCES
 * ============================================================================
 * An unrecognised shape returns null instead of a best-effort object. Storing
 * a coerced version would put something in response_payload that nothing
 * downstream knows how to read — and response_payload is jsonb, so the database
 * will accept literally anything.
 *
 * Text is capped. Without a limit a single answer could carry megabytes into a
 * jsonb column on every debounce tick.
 */

/** Far beyond any real A-level answer, and still bounded. */
export const MAX_TEXT = 20_000;
/** A numeric answer is a number as typed — "1.72e-2", "3/4". Not an essay. */
export const MAX_VALUE = 120;
export const MAX_UNIT = 60;
/**
 * Working is prose and arithmetic over several lines, so it needs real room —
 * but it is one question's method, not a dissertation. Same order as a long_text
 * answer, which is the closest thing to it that already existed.
 */
export const MAX_WORKING = MAX_TEXT;

export function narrowResponsePayload(raw: unknown): ResponsePayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;

  switch (p.kind) {
    case "mcq":
      return typeof p.choice === "string" && /^[A-D]$/.test(p.choice)
        ? { kind: "mcq", choice: p.choice }
        : null;
    case "text":
      return typeof p.text === "string"
        ? { kind: "text", text: p.text.slice(0, MAX_TEXT) }
        : null;
    case "numeric": {
      if (typeof p.value !== "string") return null;
      // ⚠ BLANK WORKING IS OMITTED, NOT STORED AS "". workingFrom() already
      // treats absent and blank as one state, so both spellings mark the same;
      // omitting keeps the stored payload identical to what a student who never
      // touched the box produces, which is what makes "not penalised for
      // leaving it blank" true of the DATA and not only of the marking code.
      const working = typeof p.working === "string" ? p.working.slice(0, MAX_WORKING) : "";
      return {
        kind: "numeric",
        value: p.value.slice(0, MAX_VALUE),
        ...(typeof p.unit === "string" ? { unit: p.unit.slice(0, MAX_UNIT) } : {}),
        ...(working.trim().length > 0 ? { working } : {}),
      };
    }
    default:
      return null;
  }
}
