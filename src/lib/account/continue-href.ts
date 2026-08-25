/**
 * WHERE "CONTINUE COURSE" ACTUALLY SENDS A STUDENT.
 *
 * ============================================================================
 * ⚠ EVERY LINK ON /profile USED TO LEAD BACK TO THE CATALOGUE ROOT.
 * ============================================================================
 * MyCourses rendered `href="/learn"` — a hardcoded literal, on the button
 * labelled "Continue course →". A student who has paid, signed in and opened
 * their profile was sent to the same subject chooser a stranger sees, four taps
 * from the one lesson they can actually open. The data to do better was already
 * on the row: courseSlug and subjectSlug were there the whole time.
 *
 * ⚠ IT MUST LAND ON SOMETHING REAL, NOT JUST SOMETHING DEEPER. 1 of 82 lessons
 * is published. A link built from the course alone would happily point at a
 * `coming_soon` lesson, and the student would arrive at "We're organising this
 * lesson now" with a disabled Notify me button — a worse outcome than the
 * catalogue root, because it looks like their course is empty rather than like
 * they took a wrong turn. So the lesson slug is passed in only when a LIVE
 * lesson exists, and the fallback is the lessons index, which is a real page
 * that lists what is there.
 *
 * ⚠ AND IT DEGRADES, NEVER GUESSES. The route is
 * /learn/<subject>/<pathway>/<course>/<lesson> — four segments, and pathway is
 * nullable on the courses row. A missing segment means the URL cannot be built
 * correctly, so it falls back rather than emitting a 404 that looks like a
 * broken account.
 */

export type ContinueTarget = {
  readonly subjectSlug: string | null;
  readonly pathway: string | null;
  readonly courseSlug: string | null;
  /** Slug of a lesson whose status is 'live'. Null when none is published. */
  readonly liveLessonSlug: string | null;
};

/** The catalogue root — the honest destination when nothing better can be built. */
export const CATALOGUE_ROOT = "/learn";

export function continueHref(t: ContinueTarget): string {
  const { subjectSlug, pathway, courseSlug, liveLessonSlug } = t;
  if (!subjectSlug || !pathway || !courseSlug) return CATALOGUE_ROOT;
  const course = `${CATALOGUE_ROOT}/${subjectSlug}/${pathway}/${courseSlug}`;
  return liveLessonSlug ? `${course}/${liveLessonSlug}` : `${course}/lessons`;
}

/**
 * Whether a href is a real destination rather than the catalogue root.
 *
 * ⚠ EXPORTED FOR THE GUARD. The test asserts the profile no longer emits the
 * bare root for a student who has a course — a check that would be impossible
 * to write against a hardcoded string in JSX.
 */
export function isDeepLink(href: string): boolean {
  return href.startsWith(`${CATALOGUE_ROOT}/`) && href.split("/").length >= 5;
}
