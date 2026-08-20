/**
 * The Profile page's data, read once (§92).
 *
 * ============================================================================
 * ⚠ FOUR TRAPS ARE ENCODED HERE. EACH IS A REAL ROW SHAPE, NOT A PRECAUTION.
 * ============================================================================
 *
 * 1. exam_attempts_select IS `student_id = auth.uid() OR public.is_staff()`
 *    (0028:599). A reader that trusts RLS to scope "my attempts" returns EVERY
 *    student's the moment a staff member opens their own profile — another
 *    person's work rendered as this person's. Every query below names
 *    student_id explicitly; RLS is the floor, not the filter.
 *
 * 2. exam_attempts.started_at IS STAMPED WHEN A PAPER IS OPENED (0028:361), by
 *    create_exam_attempt, before a single answer. Keying activity on it renders
 *    an accidental page-open as "sat a past paper". Everything here gates on
 *    submitted_at IS NOT NULL.
 *
 * 3. THERE IS NO marked_at. Marking re-runs on every results-page render
 *    (marking.ts:513) and rewrites total_awarded, so "marked on <date>" is a
 *    figure that does not exist. The only honest date is submitted_at.
 *
 * 4. announcements_read_live (0022:131) checks status and published_at and
 *    IGNORES enabled, starts_at and ends_at — while the public bar's policy
 *    (0039:97) checks the opposite pair. A signed-in student can therefore read
 *    rows the founder has SWITCHED OFF. The bar avoids this by reading through
 *    the anon client; a session-client reader cannot, so the window rule is
 *    re-applied here in code.
 *
 * ⚠ AND AN ERROR IS NEVER AN EMPTY LIST. Every section returns either data or a
 * stated refusal. "No announcements" and "we could not read announcements" look
 * identical on screen and mean opposite things; §121's no-fake-data rule is
 * broken just as thoroughly by a confident empty state as by a made-up number.
 */
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { courseCompletion, type CourseAccess, type CourseCompletion } from "./course-state";
import type { Unavailable } from "@/lib/exam/results-insights";

// ============================================================================
// SHAPES
// ============================================================================

export type ProfileCourse = {
  courseSlug: string;
  courseName: string;
  level: string;
  /** "Pearson Edexcel IAL" — the short name, for the header line (§8). */
  curriculum: string | null;
  subject: string | null;
  subjectSlug: string | null;
  /** Enrolment context from student_courses (0017). Any may be absent. */
  yearGroup: string | null;
  examSession: string | null;
  academicYear: string | null;
  enrollmentStatus: string;
  /** ⚠ A CHOICE, never derived from performance (§37, §38). */
  targetGrade: string | null;
  access: CourseAccess;
  completion: CourseCompletion;
};

export type CoursesLoad =
  | Unavailable
  | { available: true; courses: ProfileCourse[] };

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

// ============================================================================
// MY COURSES (§10) + the completion half of ACADEMIC OVERVIEW (§12)
// ============================================================================

/**
 * ⚠ ENROLMENT IS student_courses AND NOTHING ELSE (§10). Not "courses they
 * opened", not "courses in their curriculum", not "courses their cohort slug
 * looks like". §10 is explicit: do not infer ownership merely because a student
 * visited a course page.
 *
 * ⚠ THE LESSON DENOMINATOR IS lessons.course_id, ADDED BY 0004. 0001's lessons
 * table had no course linkage at all, which is why the tempting path looks like
 * topics → spec_points → lesson_spec_points → lessons. That chain is a TAGGING
 * relation: lesson_spec_points exists so a card can render spec-point pills,
 * and counting through it silently drops every lesson nobody has tagged yet.
 *
 * ⚠ 'live' IS THE ONLY STATUS A STUDENT CAN OPEN. content_status is
 * ('draft','live','in_progress','coming_soon','archived') and the lesson page
 * refuses everything but 'live'. A denominator counting drafts would tell a
 * student they are 4% through a course whose content they cannot reach.
 */
export async function loadProfileCourses(studentId: string): Promise<CoursesLoad> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("student_courses")
    .select(
      "course_id, year_group, exam_session, academic_year, enrollment_status, target_grade, " +
      "courses!inner(id, slug, name, level, curricula(short_name), subjects(name, slug))",
    )
    .eq("student_id", studentId);

  if (error) {
    // ⚠ A REFUSAL, NOT []. See the header.
    return {
      available: false,
      reason: `Your courses could not be loaded (${error.code ?? "unknown error"}). Nothing is missing from your account — this is a read problem.`,
    };
  }
  /**
   * ⚠ THROUGH `unknown`, DELIBERATELY. supabase-js infers a GenericStringError[]
   * arm for an embedded select it cannot resolve at type level, and a direct
   * cast is rejected. Casting through unknown is the honest admission that
   * these rows are untyped at the boundary — which is why every field below
   * goes through str() rather than being read straight off the object.
   */
  const list = (rows ?? []) as unknown as Record<string, unknown>[];
  if (list.length === 0) {
    return { available: true, courses: [] }; // a genuine empty, handled by the UI
  }

  const courseIds = list
    .map((r) => str((r.courses as Record<string, unknown> | null)?.id))
    .filter((v): v is string => v !== null);

  const [lessonCounts, completed, entitled] = await Promise.all([
    liveLessonsByCourse(supabase, courseIds),
    completedLessonsByCourse(supabase, studentId, courseIds),
    entitledCourseSlugs(supabase, studentId),
  ]);

  const courses: ProfileCourse[] = [];
  for (const r of list) {
    const c = r.courses as Record<string, unknown> | null;
    const id = str(c?.id);
    const slug = str(c?.slug);
    if (!id || !slug) continue; // an enrolment whose course vanished — skip, do not invent
    const curriculum = c?.curricula as Record<string, unknown> | null;
    const subject = c?.subjects as Record<string, unknown> | null;

    courses.push({
      courseSlug: slug,
      courseName: str(c?.name) ?? slug,
      level: str(c?.level) ?? "",
      curriculum: str(curriculum?.short_name),
      subject: str(subject?.name),
      subjectSlug: str(subject?.slug),
      yearGroup: str(r.year_group),
      examSession: str(r.exam_session),
      academicYear: str(r.academic_year),
      enrollmentStatus: str(r.enrollment_status) ?? "active",
      targetGrade: str(r.target_grade),
      access: {
        enrolled: true, // they are in student_courses; that IS this state
        entitled: entitled.has(slug),
      },
      completion: courseCompletion({
        completed: completed.get(id) ?? 0,
        published: lessonCounts.get(id) ?? 0,
      }),
    });
  }
  return { available: true, courses };
}

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * ⚠ SELECTS ROWS, NOT `count: exact, head: true`. A HEAD request swallows
 * PGRST205 — a missing table or a stale schema cache — and hands back a count
 * of null that `?? 0` turns into a confident zero. A zero denominator then
 * renders as "no lessons published", which is indistinguishable from the truth.
 */
async function liveLessonsByCourse(db: Db, courseIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (courseIds.length === 0) return out;
  const { data, error } = await db
    .from("lessons")
    .select("id, course_id, status")
    .in("course_id", courseIds);
  if (error) return out; // every completion becomes Unavailable — the honest fallback
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    if (row.status !== "live") continue;
    const cid = str(row.course_id);
    if (cid) out.set(cid, (out.get(cid) ?? 0) + 1);
  }
  return out;
}

/**
 * ⚠ progress HAS NO course_id, so the scope comes from an !inner embed on
 * lessons. And the denominator counted only 'live' lessons, so the numerator
 * must too — otherwise a student who completed a lesson that was later
 * unpublished shows more completed than exist.
 *
 * ⚠ student_id IS NAMED EXPLICITLY even though progress_student_read_own would
 * scope it. 0023 widened the visible set for a confirmed parent, so "my rows"
 * is no longer the same question as "rows I may read".
 */
async function completedLessonsByCourse(
  db: Db, studentId: string, courseIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (courseIds.length === 0) return out;
  const { data, error } = await db
    .from("progress")
    .select("completed, lessons!inner(course_id, status)")
    .eq("student_id", studentId)
    .in("lessons.course_id", courseIds)
    .eq("lessons.status", "live");
  if (error) return out;
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    if (row.completed !== true) continue;
    const cid = str((row.lessons as Record<string, unknown> | null)?.course_id);
    if (cid) out.set(cid, (out.get(cid) ?? 0) + 1);
  }
  return out;
}

/**
 * ⚠ AN EMPTY SET IS THE CORRECT ANSWER FOR EVERY STUDENT TODAY, and does not
 * mean anything is broken. Stripe is keyless, so the only rows 0058 can hold
 * are admin grants. A UI must read `entitled: false` as "not purchased".
 */
async function entitledCourseSlugs(db: Db, studentId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const { data, error } = await db
    .from("entitlements")
    .select("subject_ref, kind, status, ends_at")
    .eq("user_id", studentId)
    .eq("kind", "course")
    .eq("status", "active");
  if (error) return out;
  const now = Date.now();
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    // ⚠ status='active' is not enough: a row may be active with a past end date
    // until something sweeps it. The window is the truth.
    const ends = str(row.ends_at);
    if (ends && new Date(ends).getTime() <= now) continue;
    const ref = str(row.subject_ref);
    if (ref) out.add(ref);
  }
  return out;
}

// ============================================================================
// ANNOUNCEMENTS (§17)
// ============================================================================

export type ProfileAnnouncement = {
  id: string;
  title: string;
  body: string;
  category: string;
  linkUrl: string | null;
  publishedAt: string | null;
};

export type AnnouncementsLoad =
  | Unavailable
  | { available: true; items: ProfileAnnouncement[] };

/**
 * ⚠ THE WINDOW RULE IS RE-APPLIED HERE BECAUSE THE STUDENT POLICY DOES NOT
 * CARRY IT. 0022's announcements_read_live tests status and published_at;
 * 0039's public-bar policy tests enabled and the window. They are two policies
 * checking disjoint column sets, so a row the founder has switched OFF is still
 * readable by a signed-in student. The public bar sidesteps this by reading
 * through the anon client (readers.ts:148); a session-client reader cannot, so
 * `enabled` and the window are filtered in the query.
 *
 * ⚠ AND §17'S "OPERATIONAL STAYS MORE PROMINENT" IS NOT REPRESENTABLE HERE.
 * announcements has no audience, severity or is_operational column — category
 * is a four-value topic vocabulary ('update','papers','content','cohort') and
 * priority is a global ordering with no class semantics. Operational prominence
 * comes from Schedule Updates, which reads the 0053 notification ledger and is
 * a different section on the page. This one is general news, and is placed
 * below it for that reason.
 */
export async function loadProfileAnnouncements(limit = 3): Promise<AnnouncementsLoad> {
  const supabase = await createClient();
  const nowISO = new Date().toISOString();

  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,body,category,link_url,published_at,priority,enabled,starts_at,ends_at")
    .eq("status", "live")
    .eq("enabled", true)
    .not("published_at", "is", null)
    .lte("published_at", nowISO)
    .order("priority", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit * 3);

  if (error) {
    return {
      available: false,
      reason: `Announcements could not be loaded (${error.code ?? "unknown error"}).`,
    };
  }

  const items: ProfileAnnouncement[] = [];
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    // The window, in code — .or() across two nullable bounds is easy to get
    // subtly wrong in PostgREST syntax, and this is legible.
    const starts = str(row.starts_at);
    const ends = str(row.ends_at);
    if (starts && new Date(starts).getTime() > Date.now()) continue;
    if (ends && new Date(ends).getTime() <= Date.now()) continue;
    const id = str(row.id), title = str(row.title), body = str(row.body);
    if (!id || !title || !body) continue;
    items.push({
      id, title, body,
      category: str(row.category) ?? "update",
      linkUrl: str(row.link_url),
      publishedAt: str(row.published_at),
    });
    if (items.length >= limit) break;
  }
  return { available: true, items };
}
