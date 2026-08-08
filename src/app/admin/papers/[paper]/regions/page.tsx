import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RegionMapper } from "@/components/admin/RegionMapper";
import { getPaperMapping } from "@/lib/exam/regions";

/**
 * The paper-mapping tool.
 *
 * ============================================================================
 * WHY question_regions BEING EMPTY BLOCKS TEACHER MODE
 * ============================================================================
 * Teacher Mode's whole premise is clicking a question on the page and having
 * the app know which question that is. Nothing else in the schema records
 * where a question sits on the paper — paper_questions has the text and the
 * tariff, but no geometry — so with question_regions empty there is no mapping
 * from a point on a rendered page to a row. This page is how that table stops
 * being empty.
 *
 * ============================================================================
 * ⚠ GATED ON ROLES, NOT ON ADMIN_EMAIL
 * ============================================================================
 * getPaperMapping calls getStaffStatus, which reads user_roles through the
 * caller's own session. That is the same fact 0028's `question_regions_write`
 * policy checks — `has_role('marker') OR has_role('admin')` — so the page and
 * the database agree on who may write. A page gated on anything else would
 * render for someone whose writes the database then refuses.
 *
 * It does NOT call is_staff(), which still carries 0027's temporary
 * ADMIN_EMAIL fallback; dropping that arm is proposed as 0033.
 *
 * ⚠ This route sits under /admin, whose layout ALSO gates on ADMIN_EMAIL via
 * getAdminStatus(). The two checks are ANDed, so this page is currently
 * reachable only by someone who satisfies both. That env-var gate is
 * pre-existing and out of scope here; migrating the whole admin area to roles
 * is a separate change, and this page is written so that it needs no edit when
 * that happens.
 *
 * ⚠ NOT a 404 on failure. `not_found` is a claim about the catalogue;
 * `unavailable` is a claim about us, and a 404 for a paper that exists would
 * send someone looking for a data problem that isn't there.
 */
export const metadata: Metadata = {
  title: "Map question regions · Ailemy Admin",
  robots: { index: false, follow: false },
};

export default async function RegionsPage({
  params,
}: {
  params: Promise<{ paper: string }>;
}) {
  const { paper: paperSlug } = await params;
  const result = await getPaperMapping(paperSlug);

  if (!result.ok) {
    if (result.reason === "not_found") notFound();
    return (
      <Shell slug={paperSlug}>
        <div className="rounded-lg border border-red-300 bg-red-50 p-6">
          <p className="font-medium text-red-900">
            {result.reason === "not_staff"
              ? "Not authorised"
              : "We couldn't load this paper"}
          </p>
          <p className="mt-2 text-sm text-red-800">
            {result.reason === "not_staff"
              ? "Mapping regions needs a marker or admin role. Your session doesn't hold one."
              : "Something went wrong reading the paper, so nothing is being shown — rather than an empty page that would look like a paper with no questions."}
          </p>
        </div>
      </Shell>
    );
  }

  const { data } = result;

  return (
    <Shell slug={paperSlug}>
      <header className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
          {data.paperCode ?? "Paper"} · region mapping
        </p>
        <h1 className="font-display mt-1 text-2xl font-medium tracking-tight">
          {data.paperName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Pick a question, then drag a box around it on the page. Boxes are
          stored in pdf.js viewport points (top-left origin, y downward) and
          drawn as percentages, so they stay put at any zoom. Export the fixture
          and let the seeder write it — dry-run first.
        </p>
      </header>

      {data.questions.length === 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
          <p className="font-medium text-amber-900">This paper has no questions seeded</p>
          <p className="mt-2 text-sm text-amber-800">
            Regions attach to existing paper_questions rows, so there is nothing
            to attach one to yet. Seed the question set first.
          </p>
        </div>
      ) : (
        <RegionMapper mapping={data} />
      )}
    </Shell>
  );
}

function Shell({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <div>
      <Link href="/admin/past-papers" className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900">
        ← Past papers
      </Link>
      <p className="font-mono mt-1 mb-4 text-[10px] text-slate-400">{slug}</p>
      {children}
    </div>
  );
}
