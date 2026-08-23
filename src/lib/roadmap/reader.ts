import { createClient } from "@/lib/supabase/server";
import { loadCalendarEvents } from "@/lib/calendar/readers";
import { dayKeyOf } from "@/lib/calendar/grid";
import { stageOf } from "@/lib/qualifications/derive";
import { CANONICAL_TZ, formatTime } from "@/lib/schedule/timezone";
import type { Cohort } from "@/lib/public/catalogue";

import {
  COHORT_COURSE, addDaysISO, mondayOf, weekdayOf,
  type CourseRoadmap, type RoadmapPhase, type RoadmapSession, type RoadmapWeek, type WeekKind,
} from "./model.ts";

/**
 * Assembling a roadmap out of rows that already exist.
 *
 * ============================================================================
 * ⚠ NOTHING HERE AUTHORS CONTENT. IT JOINS FOUR THINGS THE DATABASE HOLDS:
 * ============================================================================
 *   units    → the phases, in their own sort order, with their own names
 *   lessons  → the sequence, by lesson_number/sort_order, with their own titles
 *   cohort_schedules → the real teaching dates, through the calendar's engine
 *   cohorts  → the window those dates are bounded by
 *
 * The only thing this file decides is the PAIRING: the nth teaching date gets
 * the nth lesson. That is a derivation from two real sequences, not invented
 * data — and the UI labels it as the planned order rather than promising a
 * lesson will fall on a particular evening.
 *
 * ⚠ A COHORT WITH NO SCHEDULE GETS NO WEEKS. igcse-chemistry-y11 and -y10 have
 * teaching windows but no schedule rows, so expandSchedule yields nothing and
 * this returns zero weeks with a `gap` explaining why. §39: show what exists,
 * omit what does not, never "TBC" and never a guessed weekday.
 *
 * ⚠ AND IT READS AS THE VIEWER (§6 of the header). createClient() is the
 * session client, so a logged-out request sees exactly what anon may see.
 * `paper_questions` refuses anon with 42501 and deck sources are protected —
 * neither is touched here. The only lesson columns read are id, title, slug
 * and status, all of which a public lesson listing already exposes.
 */

const EMPTY = (cohortSlug: string, subject: string): CourseRoadmap => ({
  cohortSlug, courseSlug: null, courseName: null, subject,
  phases: [], sessionCount: 0, lessonCount: 0, gap: null, error: null,
});

/**
 * Which week a date belongs to, and what kind of week it is.
 *
 * ⚠ EVERY WEEK IS "core" TODAY, AND THAT IS HONEST RATHER THAN LAZY.
 * §8 asks for consolidation, revision, assessment and mock weeks. Nothing in
 * the database marks a week as any of those: there is no revision flag on a
 * unit, no assessment row, no mock schedule. Assigning them by a rule of thumb
 * — "every sixth week is revision" — would be invented structure presented as
 * a plan, which is precisely what §9 forbids for exam dates and what §3 of the
 * header forbids for phase boundaries.
 *
 * The type system carries all six kinds so that the day a schedule marks them,
 * the UI already renders them. Until then a week says what it is.
 */
function kindFor(): WeekKind {
  return "core";
}

export async function loadCourseRoadmap(cohort: Cohort): Promise<CourseRoadmap> {
  const base = EMPTY(cohort.slug, cohort.subject);
  const fail = (error: string): CourseRoadmap => ({ ...base, error });

  const wiring = COHORT_COURSE[cohort.qualification ?? ""];
  if (!wiring) {
    return { ...base, gap: "This cohort is not yet linked to a course in the catalogue." };
  }

  const db = await createClient();

  // ── the course this cohort teaches ────────────────────────────────────────
  const { data: subjectRow, error: sErr } = await db
    .from("subjects").select("id").eq("slug", cohort.subject).maybeSingle();
  if (sErr) return fail(`subject lookup failed: ${sErr.message}`);
  if (!subjectRow) return { ...base, gap: "No course catalogue exists for this subject yet." };

  const { data: courseRows, error: cErr } = await db
    .from("courses").select("id, slug, name, pathway").eq("subject_id", subjectRow.id);
  if (cErr) return fail(`course lookup failed: ${cErr.message}`);

  const candidates = (courseRows ?? []).filter((c) => c.pathway === wiring.pathway);
  // ⚠ THE STAGE IS READ OFF THE COURSE'S OWN NAME, not matched to a slug this
  // file would otherwise have to know. See COHORT_COURSE.
  /**
   * ⚠ AN AMBIGUOUS MATCH IS NOT A MATCH. Taking candidates[0] named "Edexcel
   * GCSE Chemistry" on the Year 11 card, which teaches GCSE and International
   * GCSE across boards — an arbitrary pick rendered as a fact. A cohort that
   * does not identify one course gets none, and says so.
   */
  const course = wiring.stage
    ? candidates.find((c) => stageOf(String(c.name)) === wiring.stage)
    : candidates.length === 1 ? candidates[0] : undefined;
  if (!course) {
    return {
      ...base,
      gap: candidates.length > 1
        ? "This cohort covers more than one course, so a single teaching sequence cannot be shown."
        : "The course for this cohort is not in the catalogue yet.",
    };
  }

  const courseSlug = String(course.slug);
  const courseName = String(course.name);
  const withCourse = { ...base, courseSlug, courseName };

  // ── phases are units; the sequence is lessons ─────────────────────────────
  const [unitsRes, lessonsRes] = await Promise.all([
    db.from("units").select("id, code, name, sort_order").eq("course_id", course.id).order("sort_order"),
    db.from("lessons")
      .select("id, title, slug, unit_id, lesson_number, sort_order, status")
      .eq("course_id", course.id).neq("status", "archived")
      /**
       * ⚠ lesson_number FIRST, AND ORDERING BY sort_order ALONE WAS WRONG.
       * It put "Balancing Equations" before "Definitions, formulae and the
       * mole", so Week 1 taught lesson 2 on the Tuesday and lesson 1 on the
       * Saturday — visible on the page, invisible to typecheck. sort_order is
       * a display ordering; lesson_number is the teaching sequence, which is
       * what a roadmap arranges dates against. It stays as the tiebreak for
       * lessons that carry no number.
       */
      .order("lesson_number", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true }),
  ]);
  if (unitsRes.error) return fail(`unit lookup failed: ${unitsRes.error.message}`);
  if (lessonsRes.error) return fail(`lesson lookup failed: ${lessonsRes.error.message}`);

  const units = unitsRes.data ?? [];
  const lessons = lessonsRes.data ?? [];

  // ── the real teaching dates ───────────────────────────────────────────────
  if (!cohort.firstClassOn || !cohort.lastClassOn) {
    return { ...withCourse, lessonCount: lessons.length,
      gap: "This cohort's teaching window is not published yet, so its weeks cannot be shown." };
  }

  const { events, reason } = await loadCalendarEvents({
    from: cohort.firstClassOn, to: cohort.lastClassOn, mode: "public", type: "group",
  });
  if (reason) return fail(`schedule read failed: ${reason}`);

  const mine = events
    .filter((e) => e.cohortSlug === cohort.slug && e.status === "scheduled")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  if (mine.length === 0) {
    return {
      ...withCourse,
      lessonCount: lessons.length,
      /**
       * ⚠ THE HONEST STATE FOR Y11 AND Y10. They have windows and they have a
       * price; what they do not have is a published weekly schedule, so there
       * are no dates to arrange lessons against. Saying so is the whole of
       * §39 — the alternative is a guessed Tuesday.
       */
      gap: "A weekly timetable has not been published for this cohort yet, so week dates cannot be shown.",
    };
  }

  // ── pair dates with lessons, then group into weeks and phases ─────────────
  const sessions: (RoadmapSession & { unitId: string | null })[] = mine.map((ev, i) => {
    const lesson = lessons[i];
    const dayISO = dayKeyOf(ev.startsAt);
    return {
      dayISO,
      weekday: weekdayOf(dayISO),
      time: formatTime(ev.startsAt, CANONICAL_TZ),
      lessonId: lesson ? String(lesson.id) : null,
      // ⚠ FROM THE ROW. Never stored on the roadmap, never typed anywhere.
      lessonTitle: lesson ? String(lesson.title) : null,
      lessonHref: lesson && lesson.status === "live" && courseSlug
        ? `/resources/${cohort.subject}/${courseSlug}`
        : null,
      unitId: lesson ? (lesson.unit_id ? String(lesson.unit_id) : null) : null,
    };
  });

  const byWeek = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const wk = mondayOf(s.dayISO);
    byWeek.set(wk, [...(byWeek.get(wk) ?? []), s]);
  }

  const weeks: (RoadmapWeek & { unitId: string | null })[] = [...byWeek.keys()].sort().map((wk, i) => {
    const list = byWeek.get(wk)!;
    return {
      weekNumber: i + 1,
      startISO: wk,
      endISO: addDaysISO(wk, 6),
      kind: kindFor(),
      sessions: list.map(({ unitId: _u, ...rest }) => rest),
      // A week belongs to the unit its first lesson does.
      unitId: list.find((s) => s.unitId)?.unitId ?? null,
    };
  });

  const phases: RoadmapPhase[] = [];
  for (const u of units) {
    const mineWeeks = weeks.filter((w) => w.unitId === String(u.id));
    if (mineWeeks.length === 0) continue;
    phases.push({
      id: String(u.id),
      code: u.code ? String(u.code) : null,
      title: String(u.name),
      weeks: mineWeeks.map(({ unitId: _u, ...rest }) => rest),
    });
  }

  // Weeks whose lessons have no unit — real, and not silently dropped.
  const orphans = weeks.filter((w) => !w.unitId || !units.some((u) => String(u.id) === w.unitId));
  if (orphans.length > 0) {
    phases.push({
      id: "unscheduled",
      code: null,
      title: "Further teaching",
      weeks: orphans.map(({ unitId: _u, ...rest }) => rest),
    });
  }

  const lessonsPlaced = sessions.filter((s) => s.lessonId).length;
  return {
    ...withCourse,
    phases,
    sessionCount: sessions.length,
    lessonCount: lessons.length,
    /**
     * ⚠ SAID OUT LOUD WHEN THE SEQUENCE RUNS OUT. More teaching dates than
     * lessons is a real state — the roadmap shows the dates and admits it has
     * no lesson for them, rather than repeating the last one or inventing.
     */
    gap: lessonsPlaced < sessions.length
      ? `${sessions.length - lessonsPlaced} scheduled sessions do not have a lesson mapped yet.`
      : null,
    error: null,
  };
}
