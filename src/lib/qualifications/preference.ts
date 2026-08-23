import { isLevel, isQualificationScope, type Level, type QualificationScope } from "./model.ts";

/**
 * The student's stated qualification, per subject (§17, §18).
 *
 * ============================================================================
 * ⚠ A STATED PREFERENCE. IT GRANTS NOTHING (§37)
 * ============================================================================
 * This records which qualification a student says they study, so the flow
 * stops asking. It is not an enrolment, not a subscription and not an
 * entitlement: access continues to come from student_courses, entitlements
 * and cohort_enrolments, none of which this can touch. A student may set this
 * to anything; setting it to the flagship buys them nothing they did not
 * already have.
 *
 * ⚠ PER SUBJECT, BECAUSE ONE VALUE CANNOT DESCRIBE A REAL STUDENT (§18).
 * A student may sit Edexcel IAL Chemistry and Cambridge Biology. `profiles
 * .curriculum_id` (0017) exists and is a single global value — its own
 * migration header records that it "cannot describe a student taking GCSE and
 * AS at once" — so it is deliberately NOT reused here rather than bent.
 *
 * ⚠ DEVICE-LOCAL TODAY, AND THE UI SAYS SO. The per-subject table is a parked
 * _PROPOSED_ migration, so the choice lives in this browser until it lands.
 * The named wiring point is `readPreference`/`writePreference`: when the table
 * exists these gain a server round-trip and nothing else in the flow changes.
 */

export type QualificationPreference = {
  subject: string;
  level: Level;
  scope: QualificationScope;
  /** Curriculum slug, or null when the student answered "I'm not sure" (§19). */
  curriculum: string | null;
  /**
   * ⚠ THE COURSE, ADDED AS A FIELD RATHER THAN A SECOND RECORD (§27).
   * A curriculum is not always enough to resume into: Edexcel IAL is TWO
   * courses (AS and A2), so "continue studying" against a curriculum alone
   * could only guess which one the student meant. This is optional and
   * validated, so preferences written before it existed still parse — a new
   * preference store would have orphaned every one of them.
   */
  course?: string | null;
  savedAt: string;
};

const KEY = "ailemy:qualification";

/** Pure so the suite can check it without a browser. */
export function parsePreferences(raw: string | null): Record<string, QualificationPreference> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, QualificationPreference> = {};
    for (const [subject, v] of Object.entries(parsed)) {
      const p = v as Partial<QualificationPreference>;
      // ⚠ VALIDATED, NOT TRUSTED. localStorage is user-writable; a level that
      // is not a level would render a broken link into the catalogue.
      if (typeof p?.level !== "string" || !isLevel(p.level)) continue;
      if (typeof p?.scope !== "string" || !isQualificationScope(p.scope)) continue;
      out[subject] = {
        subject,
        level: p.level,
        scope: p.scope,
        curriculum: typeof p.curriculum === "string" ? p.curriculum : null,
        course: typeof p.course === "string" ? p.course : null,
        savedAt: typeof p.savedAt === "string" ? p.savedAt : "",
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function readPreference(subject: string): QualificationPreference | null {
  if (typeof localStorage === "undefined") return null;
  return parsePreferences(localStorage.getItem(KEY))[subject] ?? null;
}

export function writePreference(p: Omit<QualificationPreference, "savedAt">): void {
  if (typeof localStorage === "undefined") return;
  try {
    const all = parsePreferences(localStorage.getItem(KEY));
    all[p.subject] = { ...p, savedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked — the flow still works, it just asks again */
  }
}

export function clearPreference(subject: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const all = parsePreferences(localStorage.getItem(KEY));
    delete all[subject];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
