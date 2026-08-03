import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ClipboardCheck, FileText, PlayCircle, ScrollText } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { getAdminStatus } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
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

export const metadata: Metadata = {
  title: "Past Exam Papers · IB, IGCSE, A-Level · Ailemy",
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
  const [papers, { ok: isAdmin }] = await Promise.all([
    listFilteredPastPapers(filters),
    getAdminStatus().catch(() => ({ ok: false as const })),
  ]);

  // Form option lists and full editable rows are fetched ONLY for the admin,
  // so a student's request never pays for them.
  const adminData = isAdmin ? await loadAdminFormData(papers) : null;

  return (
    <>
      <SiteNav />
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
              examiner walkthrough.
            </p>
          </header>

          {isAdmin && adminData && (
            <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-ink/25 bg-snow/70 p-3">
              <AddPaperButton
                courses={adminData.courses}
                units={adminData.units}
              />
              <span className="text-xs text-ink/55">
                Signed in as admin — drafts are listed for you and hidden from
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

          {papers.length === 0 ? (
            <EmptyState filtered={hasActiveFilters(filters)} />
          ) : (
            <ul className="mt-4 divide-y divide-ink/10 rounded-lg border border-ink/10 bg-snow">
              {papers.map((paper) => (
                <li key={paper.id} className="p-5 sm:p-6">
                  <PaperRow
                    paper={paper}
                    admin={
                      adminData
                        ? {
                            initial: adminData.rows[paper.id],
                            courses: adminData.courses,
                            units: adminData.units,
                          }
                        : null
                    }
                  />
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
  } | null;
}) {
  const isDraft = paper.status !== "live";

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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {paper.questionPaperUrl && (
            <DocLink
              href={paper.questionPaperUrl}
              icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Question paper"
            />
          )}
          {paper.markSchemeUrl && (
            <DocLink
              href={paper.markSchemeUrl}
              icon={<ScrollText className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Mark scheme"
            />
          )}
          {paper.examinerReportUrl && (
            <DocLink
              href={paper.examinerReportUrl}
              icon={<ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Examiner report"
            />
          )}
          {paper.walkthroughPlaybackId && paper.detailHref && (
            <DocLink
              href={paper.detailHref}
              external={false}
              icon={<PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />}
              label={
                paper.walkthroughMinutes
                  ? `Walkthrough · ${paper.walkthroughMinutes} min`
                  : "Walkthrough"
              }
            />
          )}
          {!paper.questionPaperUrl &&
            !paper.markSchemeUrl &&
            !paper.examinerReportUrl &&
            !paper.walkthroughPlaybackId && (
              <span className="text-xs text-ink/45">
                No documents attached yet.
              </span>
            )}
        </div>
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
          />
        )}
      </div>
    </div>
  );
}

function DocLink({
  href,
  label,
  icon,
  external = true,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-parchment px-2.5 py-1 text-xs font-medium text-ink transition hover:border-flask hover:text-flask";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {icon}
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {icon}
      {label}
    </Link>
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
  const db = createAdminClient();
  const ids = papers.map((p) => p.id);

  const [coursesRes, unitsRes, subjectsRes, curriculaRes, rowsRes] =
    await Promise.all([
      db
        .from("courses")
        .select("id, name, level, subject_id, curriculum_id")
        .order("sort_order"),
      db.from("units").select("*").order("sort_order"),
      db.from("subjects").select("id, name"),
      db.from("curricula").select("id, short_name, name"),
      ids.length
        ? db
            .from("past_papers")
            .select(
              "id, course_id, unit_id, slug, year, session, paper_code, paper_name, paper_pdf_path, markscheme_pdf_path, walkthrough_mux_playback_id, walkthrough_duration_minutes, sort_order, status",
            )
            .in("id", ids)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

  const subjectName = new Map(
    ((subjectsRes.data ?? []) as { id: string; name: string }[]).map((s) => [
      s.id,
      s.name,
    ]),
  );
  const currName = new Map(
    (
      (curriculaRes.data ?? []) as {
        id: string;
        short_name: string | null;
        name: string;
      }[]
    ).map((c) => [c.id, c.short_name || c.name]),
  );

  const rows: Record<string, PaperInitial> = {};
  for (const r of (rowsRes.data ?? []) as PaperInitial[]) {
    rows[r.id] = r;
  }

  return {
    courses: (
      (coursesRes.data ?? []) as {
        id: string;
        name: string;
        level: string;
        subject_id: string;
        curriculum_id: string;
      }[]
    ).map((c) => ({
      id: c.id,
      label: `${currName.get(c.curriculum_id) ?? "?"} · ${
        subjectName.get(c.subject_id) ?? "?"
      } · ${c.name} (${c.level})`,
    })),
    units: (
      (unitsRes.data ?? []) as {
        id: string;
        course_id: string;
        name: string;
        code: string | null;
      }[]
    ).map((u) => ({
      id: u.id,
      label: u.code ? `${u.code} · ${u.name}` : u.name,
      parentId: u.course_id,
    })),
    rows,
  };
}
