import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkSchemeReview } from "@/components/admin/MarkSchemeReview";
import { getMarkSchemeReview } from "@/lib/exam/markscheme-review";

/**
 * Rule on extracted mark-scheme proposals.
 *
 * ============================================================================
 * WHY THIS IS THE BOTTLENECK
 * ============================================================================
 * The extractor reads a paper in seconds and scores 100% on every field against
 * the five questions transcribed by hand — but that is evidence about five
 * questions, not about the paper. It also refuses to classify 68 lines that
 * carry an examiner ruling, and until today there was nowhere to make one.
 * Extraction is solved; review is what stands between this and every remaining
 * paper.
 *
 * ============================================================================
 * ⚠ GATED ON ROLES, NOT ON ADMIN_EMAIL
 * ============================================================================
 * getMarkSchemeReview calls getStaffStatus, which reads user_roles through the
 * caller's own session — the same fact 0028's write policies check. It does not
 * call is_staff(); 0033 removed that function's email arm.
 *
 * ⚠ This route sits under /admin, whose layout ALSO gates on ADMIN_EMAIL. The
 * two are ANDed, so today only someone satisfying both reaches it. That env-var
 * gate is pre-existing; migrating the admin area to roles is a separate change
 * and this page needs no edit when it happens.
 *
 * ⚠ FOUR FAILURE REASONS, NOT ONE. not_found is a claim about the catalogue,
 * unavailable is a claim about us, not_staff is a claim about the caller, and
 * no_proposals means nobody has run the extractor yet. Collapsing them sends
 * someone hunting for the wrong problem — a 404 for a paper that exists is the
 * one that wastes the most time.
 */
export const metadata: Metadata = {
  title: "Review mark scheme · Ailemy Admin",
  robots: { index: false, follow: false },
};

export default async function MarkSchemePage({
  params,
}: {
  params: Promise<{ paper: string }>;
}) {
  const { paper: paperSlug } = await params;
  const result = await getMarkSchemeReview(paperSlug);

  if (!result.ok) {
    if (result.reason === "not_found") notFound();

    // ⚠ AMBIGUITY IS ANSWERED WITH THE CANDIDATES, NOT A CHOICE.
    //
    // The loader used to pick one when a slug matched several papers. It
    // offered a Chemistry reviewer Emit on WPH11/01 under the paper name they
    // expected, and emitting there would have written a Chemistry mark scheme
    // into a Physics paper's fixture. There is no safe way to choose between
    // two real papers, so the refusal hands over the ids as links — the id in
    // the URL is the thing that cannot be ambiguous.
    if (result.reason === "ambiguous") {
      return (
        <Shell slug={paperSlug}>
          <div className="rounded-lg border border-amber-400 bg-amber-50 p-6">
            <p className="font-medium text-amber-950">
              {result.candidates.length} papers share the slug{" "}
              <span className="font-mono">{result.slug}</span>
            </p>
            <p className="mt-2 text-sm text-amber-900">
              A slug is unique only within a course, so this one does not identify a paper.
              Nothing is being shown rather than picking one — reviewing the wrong subject&apos;s
              mark scheme is worse than an extra click. Open the one you meant:
            </p>
            <ul className="mt-3 space-y-1.5">
              {result.candidates.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/papers/${c.id}/markscheme`}
                    className="font-mono text-sm text-amber-950 underline"
                  >
                    {c.paperCode ?? "(no paper code)"} · {c.paperName}
                  </Link>
                  <span className="ml-2 font-mono text-[11px] text-amber-800">{c.id}</span>
                </li>
              ))}
            </ul>
          </div>
        </Shell>
      );
    }
    const copy = {
      not_staff: {
        title: "Not authorised",
        body: "Reviewing a mark scheme needs a marker or admin role. Your session doesn't hold one.",
      },
      no_proposals: {
        title: "No proposals for this paper yet",
        body:
          "The extractor hasn't been run against this paper's mark scheme. Run " +
          "scripts/exam-seed/extract-markscheme.py over it first — this page reviews proposals, it does not create them.",
      },
      unavailable: {
        title: "We couldn't load this paper",
        body:
          "Something went wrong reading it, so nothing is being shown — rather than an empty page that would look like a paper with no proposals.",
      },
    }[result.reason];

    return (
      <Shell slug={paperSlug}>
        <div className="rounded-lg border border-red-300 bg-red-50 p-6">
          <p className="font-medium text-red-900">{copy.title}</p>
          <p className="mt-2 text-sm text-red-800">{copy.body}</p>
          {"detail" in result && result.detail && (
            <p className="mt-2 font-mono text-xs text-red-700">{result.detail}</p>
          )}
        </div>
      </Shell>
    );
  }

  const { data } = result;

  return (
    <Shell slug={paperSlug}>
      <header className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
          {data.paperCode ?? "Paper"} · mark-scheme review
        </p>
        <h1 className="font-display mt-1 text-2xl font-medium tracking-tight">
          {data.paperName}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Every proposal below was read off the published mark scheme and carries
          the page, the line it came from and how it was derived. Nothing here is
          in the database. Approving a question emits a fixture; the seeder does
          the writing, dry-run first.
        </p>
      </header>

      <MarkSchemeReview data={data} />
    </Shell>
  );
}

function Shell({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[110rem] px-6 py-8">
      <nav className="mb-4 flex gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
        <Link href="/admin" className="hover:text-slate-800">
          Admin
        </Link>
        <span>/</span>
        <Link href={`/admin/papers/${slug}/regions`} className="hover:text-slate-800">
          Regions
        </Link>
        <span>/</span>
        <span className="text-slate-800">Mark scheme</span>
      </nav>
      {children}
    </main>
  );
}
