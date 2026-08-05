/**
 * The canonical exam sessions, shared by the admin form and the server action.
 *
 * ONE list, imported by both sides on purpose. The whole point of making
 * Session a dropdown is that a stray value silently breaks the /past-papers
 * filters, which match on the stored string — so a second copy of this list
 * drifting out of step with the first would reintroduce exactly the bug the
 * dropdown exists to prevent.
 *
 * CLIENT-SAFE: this module must NOT import anything `server-only`. It is
 * imported by a client component (admin/past-papers/_form.tsx) as a VALUE, not
 * a type, so a server-only import here would break the build — the same trap
 * documented in past-paper-filter-types.ts.
 *
 * "October-November" is canonical, matching the value documented in
 * 0007_past_papers.sql. The shorter "October" was considered and rejected: the
 * filters key on the stored string, so two spellings of the same session would
 * partition the same papers into two buckets.
 */

export const EXAM_SESSIONS = [
  "January",
  "May-June",
  "October-November",
] as const;

export type ExamSession = (typeof EXAM_SESSIONS)[number];

export function isExamSession(value: string): value is ExamSession {
  return (EXAM_SESSIONS as readonly string[]).includes(value);
}

/** For error messages: "January, May-June or October-November". */
export function examSessionsSentence(): string {
  const all = [...EXAM_SESSIONS];
  const last = all.pop();
  return `${all.join(", ")} or ${last}`;
}
