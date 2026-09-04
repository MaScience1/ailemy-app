import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { createClient } from "@/lib/supabase/server";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";
import { UNGROUPED_UNIT_ID } from "@/lib/specification/grouping";
import { buildCourseInsights } from "@/lib/specification/insights";
import { buildCourseMastery } from "@/lib/specification/mastery";
import {
  listCourseLessonIds,
  loadExamEvidence,
  loadPracticeEvidence,
  loadSpecificationTree,
} from "@/lib/specification/queries";
import { recommendNext } from "@/lib/specification/recommend";
import type { CourseInsights, CourseMastery } from "@/lib/specification/types";
import { NeedsAttention, RetrievalDue, StrongestAreas } from "@/components/specification/InsightRails";
import { MasterySummary, SignedOutMastery } from "@/components/specification/MasterySummary";
import { RecommendedNext } from "@/components/specification/RecommendedNext";
import { SpecificationExplorer } from "@/components/specification/SpecificationExplorer";

/**
 * The Specification Explorer + Mastery Map — the course, as the exam board
 * defines it, with the student's own evidence laid over it.
 *
 * ============================================================================
 * ⚠ TWO LAYERS, TWO TRUST LEVELS
 * ============================================================================
 * The TREE (units → topics → spec points → lessons) is public catalogue data,
 * readable signed out — the same tables the Resources page reads.
 *
 * The MASTERY layer exists only for the signed-in student, computed from their
 * OWN evidence — lesson-practice answers (0065) AND marked exam questions
 * (0028 + 0080's assessed_out_of) — both read with their own session client
 * and filtered by student_id explicitly. No service key is used anywhere on
 * this page, and no other student's data can appear on it.
 *
 * ⚠ EVERY STATE AND EVERY PERCENTAGE IS academic.ts's (§21/§22 as amended
 * 2026-09-03): the 12-mark floor, the three bands, masteryPercent() as the one
 * percentage function. Exam evidence enters through the same canonical
 * MasteryEvidenceRow contract as practice — awarded over assessed_out_of,
 * never over max_marks, so a student is never charged for marks the MARKER
 * could not reach. The two arms fail independently: a broken exam read is
 * reported beside a working practice map, never conflated with it.
 */

type Params = Promise<{ subject: string; course: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject, course } = await params;
  const tree = await loadSpecificationTree(subject, course);
  /* notFound() here as well as in the page, so an unknown course gets the
     not-found UI, title AND a real 404 status. cache() on the loader means
     this is not a second read.

     ⚠ THIS ROUTE HAS NO loading.tsx, DELIBERATELY — like every other
     /resources page. One was added and then removed: a leaf loading.tsx here
     suspends the WHOLE page (SiteNav included — there is no layout above it,
     unlike /learn), and that full-page swap plus streamed metadata left the
     browser with a parser-restructured DOM that React 19 could not hydrate —
     every control on the page rendered but silently did nothing. Verified
     both ways against a running server; do not reintroduce the file without
     re-verifying hydration (probe: elements carry __reactFiber$ keys and a
     filter chip toggles aria-pressed). */
  if (!tree) notFound();
  return {
    title: `${tree.courseName} specification · Ailemy`,
    description: `Every specification point of ${tree.courseName}, with your own mastery beside it.`,
  };
}

function one(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function SpecificationPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await getNavSession();
  const { subject: subjectSlug, course: courseSlug } = await params;
  const sp = await searchParams;

  const tree = await loadSpecificationTree(subjectSlug, courseSlug);
  if (!tree) notFound();

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  let mastery: CourseMastery | null = null;
  let insights: CourseInsights | null = null;
  let evidenceError: string | null = null;
  let examUnmapped = 0;
  let examNote: string | null = null;
  if (user && !tree.error) {
    const lessonIds = await listCourseLessonIds(tree.courseId);
    const [practice, exam] = await Promise.all([
      loadPracticeEvidence(user.id, lessonIds),
      loadExamEvidence(user.id, tree.courseId),
    ]);
    if (practice.ok) {
      // ⚠ THE TWO ARMS FAIL INDEPENDENTLY. A failed exam read must not blank
      // the practice map (or vice versa) — the map renders from what could be
      // read, and says what could not. missingSchema (0080 not applied) is
      // the expected pre-migration state, reported softly, not as an alarm.
      const rows = exam.ok ? [...practice.rows, ...exam.rows] : practice.rows;
      mastery = buildCourseMastery({ units: tree.units, evidence: rows });
      // Phase 2: every dimension — trend, retention, retrieval, rankings,
      // series — derived HERE, once, from the same rows. Components render.
      insights = buildCourseInsights({
        units: tree.units,
        mastery,
        evidence: rows,
        nowIso: new Date().toISOString(),
      });
      if (exam.ok) {
        examUnmapped = exam.unmappedQuestions;
      } else {
        examNote = exam.missingSchema
          ? "Marked exam papers aren't joined to this map yet."
          : "Your marked exam papers couldn't be read just now, so only practice evidence is shown.";
      }
    } else {
      evidenceError = practice.error;
    }
  }

  const recommended = mastery ? recommendNext({ units: tree.units, mastery, limit: 3 }) : [];

  const colour = subjectColour(subjectSlug);
  const specHref = `/resources/${subjectSlug}/${courseSlug}/specification`;
  const lessonBase = tree.coursePathway
    ? `/learn/${subjectSlug}/${tree.coursePathway}/${courseSlug}`
    : null;
  const pointsTotal = tree.units.reduce(
    (n, u) => n + u.topics.reduce((m, t) => m + t.points.length, 0),
    0,
  );
  const hasSpec = tree.units.some((u) => u.topics.some((t) => t.points.length > 0));
  /* The header counts what the hierarchy actually has: units where the course
     has units (IAL), topics where it does not (IGCSE — one synthetic group,
     which is not a unit and must not be counted as one). */
  const realUnitCount = tree.units.filter((u) => u.id !== UNGROUPED_UNIT_ID).length;
  const topicsTotal = tree.units.reduce((n, u) => n + u.topics.length, 0);

  return (
    <div style={subjectVars(colour)}>
      <SiteNav session={session} />
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
          <Breadcrumb
            crumbs={[
              { label: "Resources", href: "/resources" },
              { label: tree.subjectName, href: `/resources/${subjectSlug}` },
              { label: tree.courseName, href: `/resources/${subjectSlug}/${courseSlug}` },
              { label: "Specification" },
            ]}
          />

          <header className="mt-10 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--subject-text)]">
              {tree.curriculumName}
            </p>
            <h1 className="font-display mt-4 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
              {tree.courseName} specification.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink/65">
              What the course asks of you, point by point — and where your own
              practice says you stand.
            </p>
            {hasSpec && (
              <p className="font-mono mt-5 text-xs tracking-wide text-ink/55">
                {pointsTotal} specification point{pointsTotal === 1 ? "" : "s"} ·{" "}
                {realUnitCount > 0
                  ? `${realUnitCount} unit${realUnitCount === 1 ? "" : "s"}`
                  : `${topicsTotal} topic${topicsTotal === 1 ? "" : "s"}`}
              </p>
            )}
          </header>

          {/* ⚠ A FAILED READ IS SAID OUT LOUD, NEVER RENDERED AS AN EMPTY
              SPECIFICATION (taxonomy.ts doctrine). */}
          {tree.error && (
            <p role="alert" className="mt-8 rounded-lg border border-ink/15 bg-snow px-4 py-3 text-sm text-ink/75">
              Some of the specification could not be loaded — {tree.error}
            </p>
          )}

          {!tree.error && !hasSpec ? (
            /* Genuinely empty: the catalogue has no mapped spec points yet. */
            <div className="mt-10 rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] px-5 py-4">
              <p className="text-sm text-ink/70">
                The specification for this course hasn&apos;t been mapped into
                Ailemy yet.
              </p>
              <p className="mt-2 text-sm">
                <Link
                  href={`/resources/${subjectSlug}/${courseSlug}`}
                  className="underline underline-offset-4 hover:text-ink"
                >
                  Back to {tree.courseName} resources →
                </Link>
              </p>
            </div>
          ) : !tree.error ? (
            <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
              {/* Rail first in DOM: on a phone the student's position comes
                  before the full tree; on desktop it sits to the side. */}
              <aside className="grid gap-6 lg:sticky lg:top-6 lg:order-2">
                {evidenceError ? (
                  <p role="alert" className="rounded-lg border border-ink/15 bg-snow px-4 py-3 text-sm text-ink/75">
                    Your practice history could not be loaded just now, so no
                    mastery is shown — the specification itself is unaffected.
                  </p>
                ) : mastery ? (
                  <MasterySummary
                    mastery={mastery}
                    examUnmapped={examUnmapped}
                    series={insights?.series ?? []}
                  />
                ) : (
                  <SignedOutMastery signInHref={`/login?next=${encodeURIComponent(specHref)}`} />
                )}

                {examNote && mastery && (
                  <p className="px-1 text-xs leading-relaxed text-ink/50">{examNote}</p>
                )}

                {insights && (
                  <RetrievalDue
                    items={insights.queue}
                    units={tree.units}
                    lessonBase={lessonBase}
                    specHref={specHref}
                  />
                )}

                {insights && (
                  <NeedsAttention
                    items={insights.weaknesses}
                    units={tree.units}
                    lessonBase={lessonBase}
                    specHref={specHref}
                  />
                )}

                {insights && (
                  <StrongestAreas
                    items={insights.strengths}
                    units={tree.units}
                    specHref={specHref}
                  />
                )}

                {recommended.length > 0 && (
                  <RecommendedNext
                    items={recommended}
                    units={tree.units}
                    lessonBase={lessonBase}
                    specHref={specHref}
                  />
                )}

                {/* §45 — where the states come from. Honesty about the map's
                    own limits. */}
                <p className="px-1 text-xs leading-relaxed text-ink/50">
                  Mastery comes from your recorded lesson practice and your
                  marked exam questions, needing at least 12 marks of evidence
                  per point before anything is rated.
                </p>
              </aside>

              <section aria-label="Specification explorer" className="mt-8 lg:order-1 lg:mt-0">
                <SpecificationExplorer
                  units={tree.units}
                  mastery={mastery}
                  insights={
                    insights
                      ? {
                          trendByCode: insights.trendByCode,
                          retentionByCode: insights.retentionByCode,
                          evidenceByCode: insights.evidenceByCode,
                        }
                      : null
                  }
                  lessonBase={lessonBase}
                  initial={{
                    q: one(sp.q),
                    unit: one(sp.unit),
                    state: one(sp.state),
                    point: one(sp.point),
                  }}
                />
              </section>
            </div>
          ) : null}

          <p className="mt-12 text-sm">
            <Link
              href={`/resources/${subjectSlug}/${courseSlug}`}
              className="text-ink/60 underline underline-offset-4 transition-colors hover:text-ink"
            >
              ← {tree.courseName} resources
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
