/**
 * The shape of a course roadmap, and the one relationship it needs wiring.
 *
 * ============================================================================
 * ⚠ A ROADMAP OWNS NO CONTENT. IT IS AN ARRANGEMENT OF THINGS THAT EXIST.
 * ============================================================================
 * The brief lists thirty-six lesson titles inline. None of them appears in
 * this codebase's roadmap layer, and the guard fails if one ever does: those
 * titles are rows in `lessons`, with `lesson_number` and `sort_order` already
 * defining the sequence. Copying them here would be a second representation of
 * a table — the identical defect as the slug→window map that told two live
 * programmes their dates were unpublished.
 *
 * So a roadmap session carries a lesson ID and nothing else about the lesson.
 * The title renders from the row. Rename a lesson and the roadmap renames.
 *
 * ⚠ AND IT INVENTS NO DATES. Teaching dates come from `cohort_schedules`
 * through the same expandSchedule the calendar uses, so a roadmap week exists
 * only where a real session does. A cohort with no schedule rows gets no
 * weeks — not a guessed Tuesday, not "TBC" (§39).
 */

import type { Pathway } from "@/lib/catalogue/pathways";

/** A week's character. Drives a restrained visual treatment, never colour alone. */
export type WeekKind = "core" | "consolidation" | "revision" | "assessment" | "mock" | "exam_prep";

export const WEEK_KIND_LABEL: Record<WeekKind, string> = {
  core: "Core teaching",
  consolidation: "Consolidation",
  revision: "Revision",
  assessment: "Assessment",
  mock: "Mock exam",
  exam_prep: "Exam preparation",
};

export type RoadmapSession = {
  /** ISO day, from a real scheduled occurrence. */
  dayISO: string;
  /** "Tuesday" — derived from the date, not from prose. */
  weekday: string;
  /** Canonical-zone clock, e.g. "7:00 PM". Null if the occurrence carries none. */
  time: string | null;
  /**
   * ⚠ THE ONLY THING A SESSION KNOWS ABOUT A LESSON. Null when the sequence
   * has run past the lessons that exist — a scheduled date with no lesson yet
   * is a real state and renders as a date with no title, never as a guess.
   */
  lessonId: string | null;
  /** Rendered FROM THE ROW at read time. Never stored, never typed. */
  lessonTitle: string | null;
  /** Where the lesson can be opened, when it is published and readable. */
  lessonHref: string | null;
};

export type RoadmapWeek = {
  weekNumber: number;
  startISO: string;
  endISO: string;
  kind: WeekKind;
  sessions: RoadmapSession[];
};

export type RoadmapPhase = {
  /** The unit's id — phases ARE units, not a parallel structure. */
  id: string;
  /** "WCH11" — the unit's own code, when it has one. */
  code: string | null;
  title: string;
  weeks: RoadmapWeek[];
};

export type CourseRoadmap = {
  cohortSlug: string;
  courseSlug: string | null;
  courseName: string | null;
  subject: string;
  phases: RoadmapPhase[];
  /** Teaching dates found, before pairing. Zero means no schedule exists. */
  sessionCount: number;
  lessonCount: number;
  /**
   * Why a roadmap is thin or absent, in the page's own words. Null when the
   * roadmap is complete. §39: show what exists, say what does not.
   */
  gap: string | null;
  /** Non-null when a read failed — never rendered as "no content". */
  error: string | null;
};

/**
 * Cohort qualification → the course it teaches.
 *
 * ============================================================================
 * ⚠ THIS IS A RELATIONSHIP, NOT A COPY OF ROW DATA — AND THE DISTINCTION IS
 * THE WHOLE POINT OF §2.
 * ============================================================================
 * `cohorts` has no course_id. Something has to say that the "ial-as" cohort
 * teaches the International A-Level AS course, and no table currently does.
 * That is a missing FOREIGN KEY, and until one exists it is stated once, here,
 * as a pair of existing identifiers — a pathway slug and a stage.
 *
 * What it emphatically is NOT is a copy of anything: no lesson titles, no unit
 * names, no dates, no prices. Those all live in rows and are read from them.
 * CURRICULUM_BOARD in qualifications/model.ts is the same kind of wiring and
 * carries the same warning; this follows its precedent deliberately.
 *
 * ⚠ THE STAGE IS MATCHED THROUGH stageOf(), NOT A COURSE SLUG. Writing
 * "edexcel-ial-as-chemistry" here would pin one board's naming; matching on
 * the stage the course row's own name declares works for any board that
 * distinguishes AS from A2.
 */
export const COHORT_COURSE: Record<string, { pathway: Pathway; stage: string | null }> = {
  "ial-as": { pathway: "international-a-level", stage: "AS" },
  "ial-a2": { pathway: "international-a-level", stage: "A2" },
  "gcse-y11": { pathway: "uk-gcse", stage: null },
  "gcse-y10": { pathway: "uk-gcse", stage: null },
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The weekday name for an ISO day, read as a UTC calendar date. */
export function weekdayOf(dayISO: string): string {
  const t = Date.parse(`${dayISO}T00:00:00Z`);
  return Number.isNaN(t) ? "" : WEEKDAYS[new Date(t).getUTCDay()];
}

/** Monday of the week containing an ISO day. */
export function mondayOf(dayISO: string): string {
  const t = Date.parse(`${dayISO}T00:00:00Z`);
  if (Number.isNaN(t)) return dayISO;
  const d = new Date(t);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
}

export function addDaysISO(dayISO: string, n: number): string {
  const t = Date.parse(`${dayISO}T00:00:00Z`);
  return Number.isNaN(t) ? dayISO : new Date(t + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Which teaching week contains "today", if any (§10).
 *
 * ⚠ RETURNS null BEFORE AND AFTER THE PROGRAMME, AND THE CALLER MUST SAY SO.
 * "This week" highlighting a week that has not started is worse than no
 * highlight: it tells a student teaching is under way when it is not.
 */
export function currentWeekNumber(weeks: readonly RoadmapWeek[], todayISO: string): number | null {
  for (const w of weeks) {
    if (todayISO >= w.startISO && todayISO <= w.endISO) return w.weekNumber;
  }
  return null;
}

/** Days until the first teaching week. Negative once it has begun. */
export function daysUntil(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`), b = Date.parse(`${toISO}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.round((b - a) / 86_400_000);
}

/**
 * How far through the programme the COHORT is (§12, §8 of the header).
 *
 * ⚠ COHORT POSITION, NEVER A STUDENT'S. The completion tables are parked and
 * unapplied, so there is no per-student progress to read. A bar claiming a
 * personal percentage would be invented, and §12 forbids exactly that. This is
 * "where the class has got to", which is true for everyone looking at it.
 */
export function cohortProgress(weeks: readonly RoadmapWeek[], todayISO: string): {
  taught: number; total: number; percent: number;
} {
  const total = weeks.length;
  if (total === 0) return { taught: 0, total: 0, percent: 0 };
  const taught = weeks.filter((w) => w.endISO < todayISO).length;
  return { taught, total, percent: Math.round((taught / total) * 100) };
}
