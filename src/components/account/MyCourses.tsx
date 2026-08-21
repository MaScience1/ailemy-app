import Link from "next/link";

import { completionLabel, completionCaveat } from "@/lib/account/course-state";
import type { CourseAcademics, ProfileCourse } from "@/lib/account/profile-reader";

/**
 * My Courses (§10) and Academic Overview (§12), as one section.
 *
 * ============================================================================
 * ⚠ EVERY NUMBER ON THIS CARD IS ABSENT OR ZERO FOR EVERY STUDENT TODAY
 * ============================================================================
 * No student has submitted an attempt, and content stands at roughly one
 * published lesson of 375. §12 says "do not show values if data is
 * insufficient", so a figure that cannot be computed renders as a SENTENCE
 * explaining why, never as a dash, a zero or a greyed-out number — all three
 * read as a measurement that came back low.
 *
 * ⚠ AND THE SENTENCES NEVER SAY "YOU". "No lessons are published on this course
 * yet" is about the library. "0% complete" is about the student. The difference
 * is the whole point, and it is decided in the read model so the mobile app
 * cannot phrase it differently (§92).
 *
 * ⚠ NO RAW IDS ANYWHERE (§8). Slugs are used for links because they are the
 * public route vocabulary; course ids never leave the reader.
 */

export function MyCourses({
  courses,
  academics,
}: {
  courses: ProfileCourse[];
  academics: Map<string, CourseAcademics> | null;
}) {
  if (courses.length === 0) {
    return (
      <div className="mt-5 rounded border border-ink/10 bg-white/50 px-5 py-6">
        <p className="text-sm leading-relaxed text-ink/70">
          You are not studying any courses yet. Adding one lets Ailemy track what you have
          covered and what is left.
        </p>
        <Link
          href="/learn"
          className="mt-3 inline-block text-sm underline underline-offset-2 hover:text-ink"
        >
          Browse courses →
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-5 grid gap-4 sm:grid-cols-2">
      {courses.map((c) => (
        <li key={c.courseSlug} className="rounded border border-ink/10 bg-white/50 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-display text-lg font-medium tracking-tight">
              {c.subject ?? c.courseName}
            </h3>
            {/* ⚠ ONLY IF SET. §38 keeps a target a CHOICE — never derived from
                performance, and never invented so the card looks complete. */}
            {c.targetGrade && (
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
                Target {c.targetGrade}
              </span>
            )}
          </div>

          {/* The qualification line — as much of it as is known (§8). */}
          <p className="mt-1 text-sm text-ink/60">
            {[c.curriculum, c.level, c.yearGroup].filter(Boolean).join(" · ") || c.courseName}
          </p>

          <dl className="mt-4 space-y-2.5 text-sm">
            <Figure
              label="Course completion"
              value={completionLabel(c.completion)}
              /* A refusal is prose, and prose must not be typeset as a number. */
              muted={!c.completion.available}
              caveat={completionCaveat(c.completion)}
            />

            {academics && <CourseFigures a={academics.get(c.courseSlug)} />}
          </dl>

          {/**
           * ⚠ THE CTA WORDING TRACKS ENTITLEMENT, NOT ENROLMENT (§11). "Continue"
           * implies the content opens. A student who is enrolled but not entitled
           * gets "Open" — the course page then explains what is locked, which is
           * its job and not this card's.
           */}
          <Link
            href={`/learn`}
            className="mt-4 inline-block text-sm underline underline-offset-2 hover:text-ink"
          >
            {c.access.entitled ? "Continue course →" : "Open course →"}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CourseFigures({ a }: { a: CourseAcademics | undefined }) {
  if (!a) return null;
  return (
    <>
      <Figure
        label="Assessed performance"
        value={a.assessed.available ? `${a.assessed.percent}%` : a.assessed.reason}
        muted={!a.assessed.available}
        /* ⚠ THE MARKS TRAVEL WITH THE PERCENTAGE. "74%" alone hides whether it
           came from 8 marks or 800, and §95 is about weighting by marks. */
        caveat={a.assessed.available ? `${a.assessed.awarded} of ${a.assessed.outOf} marks` : null}
      />
      {/* ⚠ SHOWN ONLY ONCE NON-ZERO. "0 past papers" and "0 questions" are
          technically true and read as a rebuke; their absence reads as "not
          started", which is what is actually true. */}
      {a.papersCompleted > 0 && (
        <Figure label="Past papers completed" value={String(a.papersCompleted)} />
      )}
      {a.questionsAnswered > 0 && (
        <Figure label="Questions answered" value={String(a.questionsAnswered)} />
      )}
    </>
  );
}

function Figure({
  label, value, muted = false, caveat = null,
}: {
  label: string; value: string; muted?: boolean; caveat?: string | null;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">{label}</dt>
      <dd
        className={
          muted
            ? "mt-0.5 text-[13px] leading-relaxed text-ink/55"
            : "mt-0.5 text-base font-medium tabular-nums"
        }
      >
        {value}
      </dd>
      {caveat && (
        <p className="mt-0.5 font-mono text-[10px] tracking-wide text-ink/40">{caveat}</p>
      )}
    </div>
  );
}
