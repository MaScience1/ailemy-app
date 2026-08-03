import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { DeleteConfirm } from "@/app/admin/_components/DeleteConfirm";
import { StatusToggle } from "@/app/admin/_components/StatusToggle";

import { deletePastPaper, setPastPaperStatus } from "./actions";

export const metadata = { title: "Past papers · Admin · Ailemy" };
export const dynamic = "force-dynamic";

export default async function PastPapersListPage() {
  const supabase = createAdminClient();
  const { data: rows = [] } = await supabase
    .from("past_papers")
    .select(
      "id, paper_name, slug, year, session, paper_code, status, sort_order, course_id, unit_id",
    )
    .order("year", { ascending: false })
    .order("sort_order");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium">Past papers</h1>
          <p className="mt-1 text-sm text-slate-600">
            {(rows ?? []).length} total
          </p>
        </div>
        <Link
          href="/admin/past-papers/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New past paper
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Paper name</th>
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 font-medium">Session · year</th>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Course</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">
                  {r.paper_name}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">
                  {r.slug}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {r.session} {r.year}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">
                  {r.paper_code ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                  {r.course_id?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <StatusToggle
                    currentStatus={r.status ?? "draft"}
                    action={setPastPaperStatus.bind(null, r.id)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/past-papers/${r.id}`}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                    <DeleteConfirm
                      small
                      entityLabel="past paper"
                      confirmText={r.paper_name}
                      action={deletePastPaper.bind(null, r.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                  No past papers yet. Create your first with “+ New past paper”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
