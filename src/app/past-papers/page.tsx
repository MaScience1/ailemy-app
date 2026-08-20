import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { getEditContext } from "@/lib/admin/edit-mode";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPaperFormOptions } from "@/lib/admin/paper-form-options";
import {
  buildFilterOptions,
  filtersToQueryString,
  getCascadeData,
  hasActiveFilters,
  listFilteredPastPapers,
  sanitiseFilters,
  type PaperFilters,
  type PaperResult,
} from "@/lib/catalogue/past-paper-filters";
import type { PaperInitial } from "@/app/admin/past-papers/_form";

import { FilterBar } from "./_filter-bar";
import { AddPaperButton, PaperRowControls } from "./_admin-controls";
import { PaperDocLinks } from "./_doc-links";
import {
  SinglePaperView,
  formatDuration,
  formatUnitLabel,
} from "./_single-paper";

export const metadata: Metadata = {
  // ⚠ §57 — was "IB, IGCSE, A-Level".
  title: "Past Exam Papers · GCSE, International GCSE, IAL · Ailemy",
  description:
    "Browse and filter past papers by subject, exam board, level, year and document type. Question papers, mark schemes, examiner reports and walkthroughs.",
};

/**
 * Filters live in the query string and the result set is user-specific for the
 * admin (drafts included), so this page is always rendered per request.
 */
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

export default async function PastPapersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const requested: PaperFilters = {
    subject: one(sp.subject),
    board: one(sp.board),
    course: one(sp.course),
    year: one(sp.year),
    doc: one(sp.doc),
  };

  // The cascade is the single source of truth for which combinations exist.
  const cascade = await getCascadeData();
  const filters = sanitiseFilters(cascade, requested);

  // If a selection was impossible (stale link, hand-edited URL, catalogue
  // changed under a shared link), bounce to the canonical URL so what the user
  // sees and what the address bar says can never disagree.
  const canonical = filtersToQueryString(filters);
  if (canonical !== filtersToQueryString(requested)) {
    redirect(canonical ? `/past-papers?${canonical}` : "/past-papers");
  }

  const options = buildFilterOptions(cascade, filters);
  // MERGE RECONCILIATION: main gated these controls on getAdminStatus() alone,
  // so an admin always saw them. This branch's defining behaviour is the
  // edit-mode toggle — with it OFF every page must be byte-identical to the
  // student view. Gating on editMode keeps /past-papers consistent with every
  // other surface in the inline-editing system.
  const [papers, { editMode: isAdmin }, session] = await Promise.all([
    listFilteredPastPapers(filters),
    getEditContext(),
    getNavSession(),
  ]);

  // Form option lists and full editable rows are fetched ONLY for the admin,
  // so a student's request never pays for them.
  const adminData = isAdmin ? await loadAdminFormData(papers) : null;

  // Admin props for one paper, shared by the single-result view and the list.
  const adminPropsFor = (paper: PaperResult) =>
    adminData
      ? {
          initial: adminData.rows[paper.id],
          courses: adminData.courses,
          units: adminData.units,
          optionsError: adminData.error,
        }
      : null;

  return (
    <>
      <SiteNav session={session} />
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
          <Breadcrumb crumbs={[{ label: "Past Papers" }]} />

          <header className="mt-10 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
              Exam Archive
            </p>
            <h1 className="font-display mt-5 text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
              Past papers.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
              Narrow by subject, then board, then course — each choice filters
              the next. Download question papers and mark schemes, or watch an
              examiner-style walkthrough.
            </p>
          </header>

          {isAdmin && adminData && (
            <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-ink/25 bg-snow/70 p-3">
              <AddPaperButton
                courses={adminData.courses}
                units={adminData.units}
                optionsError={adminData.error}
              />
              <span className="text-xs text-ink/55">
                Edit mode is on — drafts are listed for you and hidden from
                everyone else.
              </span>
            </div>
          )}

          <div className="mt-8">
            {/* FilterBar reads useSearchParams(), which needs a boundary. */}
            <Suspense
              fallback={
                <div className="h-[150px] rounded-lg border border-ink/10 bg-snow" />
              }
            >
              <FilterBar options={options} />
            </Suspense>
          </div>

          <p className="font-mono mt-6 text-xs uppercase tracking-[0.2em] text-ink/55">
            {papers.length} {papers.length === 1 ? "paper" : "papers"}
          </p>

          {/* Zero results keep the empty state, two-or-more keep the list; a
              single result is shown inline with its PDF instead of as a
              one-item list, since there is nothing left to choose between. */}
          {papers.length === 0 ? (
            <EmptyState filtered={hasActiveFilters(filters)} />
          ) : papers.length === 1 ? (
            <SinglePaperView
              paper={papers[0]}
              admin={adminPropsFor(papers[0])}
            />
          ) : (
            <ul className="mt-4 divide-y divide-ink/10 rounded-lg border border-ink/10 bg-snow">
              {papers.map((paper) => (
                <li key={paper.id} className="p-5 sm:p-6">
                  <PaperRow paper={paper} admin={adminPropsFor(paper)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function PaperRow({
  paper,
  admin,
}: {
  paper: PaperResult;
  admin: {
    initial: PaperInitial | undefined;
    courses: { id: string; label: string }[];
    units: { id: string; label: string; parentId: string }[];
    optionsError: string | null;
  } | null;
}) {
  const isDraft = paper.status !== "live";
  const meta = [
    formatUnitLabel(paper.unitName),
    formatDuration(paper.durationMinutes),
    paper.totalMarks != null
      ? `${paper.totalMarks} mark${paper.totalMarks === 1 ? "" : "s"}`
      : null,
  ].filter((v): v is string => Boolean(v));

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {paper.boardName} · {paper.subjectName} · {paper.courseLevel}
          </p>
          {paper.paperCode && (
            <span className="font-mono rounded bg-ink/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-ink/70">
              {paper.paperCode}
            </span>
          )}
          {isDraft && (
            <span className="font-mono rounded bg-flask/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-flask">
              {paper.status}
            </span>
          )}
        </div>

        <h2 className="font-display mt-2 text-xl font-medium tracking-tight">
          {paper.session} {paper.year}
          <span className="ml-2 text-base font-normal text-ink/55">
            {paper.courseName}
          </span>
        </h2>

        {/* Unit, duration and marks — one metadata line, each item only when
            its field is non-null, separated by the same middle dot the eyebrow
            above uses.

            The unit is the SHORT form ("Unit 1"), parsed from units.name: the
            full title runs past the card width, and units.code is a paper code
            ("WCH11") rather than a unit number, so it cannot supply this. All
            of it comes from the units row the list query already left-joins —
            no extra fetch per card.

            duration_minutes and total_marks arrived in migration 0015 and stay
            null until recorded, so a partly-filled paper shows a shorter line
            and a paper with none of the three shows no line at all. */}
        {meta.length > 0 && (
          <p className="font-mono mt-1.5 truncate text-xs text-ink/60">
            {meta.map((item, i) => (
              <span key={item}>
                {i > 0 && (
                  <span className="mx-2 text-ink/30" aria-hidden="true">
                    ·
                  </span>
                )}
                {item}
              </span>
            ))}
          </p>
        )}

        <PaperDocLinks paper={paper} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {paper.detailHref && (
          <Link
            href={paper.detailHref}
            className="rounded-md border border-ink/15 bg-parchment px-3 py-1.5 text-sm font-medium text-ink transition hover:border-ink/35"
          >
            Open →
          </Link>
        )}
        {admin?.initial && (
          <PaperRowControls
            paper={admin.initial}
            courses={admin.courses}
            units={admin.units}
            optionsError={admin.optionsError}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="mt-4 rounded-lg border border-ink/10 bg-snow p-10 text-center">
      <p className="font-display text-2xl font-medium tracking-tight">
        No papers match these filters yet.
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink/60">
        {filtered
          ? "Try widening or clearing a filter — an exam board is selectable before any of its papers are uploaded."
          : "Papers will appear here as they are added."}
      </p>
      {filtered && (
        <Link
          href="/past-papers"
          className="mt-5 inline-flex rounded-md border border-ink/20 bg-parchment px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/40"
        >
          Clear all filters
        </Link>
      )}
    </div>
  );
}

/**
 * Course/unit option lists plus the full editable row for each visible paper,
 * shaped for the existing PastPaperForm. Admin-only.
 */
async function loadAdminFormData(papers: PaperResult[]) {
  // Option lists come from the shared loader, which reports credential
  // failures instead of yielding an empty courses array.
  const { courses, units, error } = await loadPaperFormOptions();

  const ids = papers.map((p) => p.id);
  let rows: Record<string, PaperInitial> = {};

  if (ids.length) {
    try {
      const db = createAdminClient();
      const { data, error: rowsError } = await db
        .from("past_papers")
        // select("*") deliberately: this row feeds PastPaperForm's `initial`,
        // so it must carry examiner_report_pdf_path once migration 0012 is
        // applied — while still working before it is. Naming the column
        // explicitly would 400 the whole query on an un-migrated database and
        // silently drop the Edit controls from every row.
        .select("*")
        .in("id", ids);
      if (rowsError) {
        console.error("[past-papers] editable rows fetch failed:", rowsError);
      }
      for (const r of (data ?? []) as PaperInitial[]) rows[r.id] = r;
    } catch (e) {
      console.error("[past-papers] admin client unavailable:", e);
    }
  }

  return { courses, units, rows, error };
}
