import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { DeleteConfirm } from "@/app/admin/_components/DeleteConfirm";
import { StatusToggle } from "@/app/admin/_components/StatusToggle";

import { deleteLesson, setLessonStatus } from "./actions";

export const metadata = { title: "Lessons · Admin · Ailemy" };
export const dynamic = "force-dynamic";

export default async function LessonsListPage() {
  const supabase = createAdminClient();
  const { data: rows = [] } = await supabase
    .from("lessons")
    .select(
      "id, title, slug, status, access, sort_order, lesson_number, course_id, unit_id",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium">Lessons</h1>
          <p className="mt-1 text-sm text-slate-600">
            {(rows ?? []).length} total
          </p>
        </div>
        <Link
          href="/admin/lessons/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New lesson
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 font-medium">Course · unit</th>
              <th className="px-3 py-2 font-medium">Access</th>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">
                  {r.title}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">
                  {r.slug}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                  {r.course_id ? r.course_id.slice(0, 8) : "—"} ·{" "}
                  {r.unit_id ? r.unit_id.slice(0, 8) : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700">{r.access ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums text-slate-700">
                  {r.sort_order ?? 0}
                </td>
                <td className="px-3 py-2">
                  <StatusToggle
                    currentStatus={r.status ?? "draft"}
                    action={setLessonStatus.bind(null, r.id)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/lessons/${r.id}`}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                    <DeleteConfirm
                      small
                      entityLabel="lesson"
                      confirmText={r.title}
                      action={deleteLesson.bind(null, r.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                  No lessons yet. Create your first with “+ New lesson”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
