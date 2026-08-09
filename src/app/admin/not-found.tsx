import Link from "next/link";

/**
 * The admin 404 — and specifically, the one the region mapper produces.
 *
 * A missing admin page is nearly always a wrong PARAMETER rather than a wrong
 * route, so this names the cause instead of leaving someone to guess whether
 * the route was deleted. The region mapper's `[paper]` segment is the live
 * example: it accepted only a slug, and an id — the thing anyone actually has
 * to hand — produced zero rows and a bare 404 indistinguishable from a route
 * that no longer exists.
 *
 * It takes both now. This page stays because "the id I used was for a
 * different paper" and "I mistyped the slug" still land here, and a 404 that
 * explains itself is worth more than one that does not.
 */
export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
        404 · admin
      </p>
      <h1 className="font-display mt-3 text-2xl font-medium tracking-tight">
        No admin page at that address.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        The route exists but nothing matched its parameters — usually a paper
        that isn&apos;t seeded, or an id from a different paper.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        The region mapper takes <strong>either</strong> a paper id or a slug:
      </p>
      <pre className="font-mono mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
        /admin/papers/&lt;paper-id&gt;/regions{"\n"}
        /admin/papers/&lt;slug&gt;/regions
      </pre>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Prefer the id. A slug is unique only within a course, so several papers
        can share one and the tool has to pick.
      </p>
      <div className="mt-8 flex gap-3 text-sm">
        <Link
          href="/admin/past-papers"
          className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700"
        >
          Past papers
        </Link>
        <Link
          href="/admin"
          className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:border-slate-400"
        >
          Admin home
        </Link>
      </div>
    </div>
  );
}
