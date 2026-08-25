/**
 * WHAT A LESSON MUST HAVE BEFORE IT MAY GO LIVE.
 *
 * ============================================================================
 * ⚠ TODAY NOTHING LOOKS BROKEN, AND THAT IS THE TRAP.
 * ============================================================================
 * There are 7 lesson_spec_points rows in the whole database and they belong to
 * the five lessons that were mapped by seed and by one repair script. Exactly
 * one lesson is published — and it is one of those five. So the single page a
 * student can open renders its spec pills and its "This lesson covers" rail
 * completely, and the emptiness behind the other 76 lessons is invisible.
 *
 * The moment a second lesson is published without mapping, a student gets:
 *   - the spec pills under the title silently absent, no gap, no explanation;
 *   - a confident "THIS LESSON COVERS" heading with "Spec point mapping coming
 *     soon." underneath it — a heading with an apology under it;
 *   - and a live-looking "Start practice →" button whose engine will refuse,
 *     because practice questions are selected BY spec point.
 *
 * ⚠ SO THE CHECK REFUSES, AND SAYS WHY. It does not silently no-op and it does
 * not publish-and-warn. `StatusToggle` already surfaces `result.error` in an
 * alert, so a refusal with a real sentence in it reaches the person pressing
 * the button. Blocking without explaining would be the worst of both.
 *
 * ⚠ THIS IS NOT A CONTENT RULE ABOUT QUALITY. It is the minimum that makes the
 * rendered page coherent. A lesson with a deck, a video and no spec points
 * still renders as half-built.
 */

/** The reason a lesson may not go live, or null when it may. */
export function publishBlocker(args: {
  specPointCount: number;
  lessonTitle?: string | null;
}): string | null {
  if (args.specPointCount > 0) return null;
  const which = args.lessonTitle ? `"${args.lessonTitle}"` : "This lesson";
  return (
    `${which} has no specification points mapped, so publishing it would show ` +
    `students a "This lesson covers" panel reading "Spec point mapping coming soon", ` +
    `and a "Start practice" button that cannot serve a question — practice is ` +
    `selected by spec point. Map at least one spec point on the lesson form first, ` +
    `then publish. (Unpublishing is never blocked.)`
  );
}

/**
 * ⚠ ONLY PUBLISHING IS GATED. Moving a lesson back to draft must always be
 * possible — the first thing anyone does with a page that looks wrong is take
 * it down, and a guard that prevented that would be actively harmful.
 */
export function needsSpecPointCheck(status: string): boolean {
  return status === "live";
}
