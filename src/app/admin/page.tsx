import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin · Ailemy" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();

  const [
    { count: lessonsTotal },
    { count: lessonsLive },
    { count: papersTotal },
    { count: papersLive },
  ] = await Promise.all([
    supabase.from("lessons").select("*", { count: "exact", head: true }),
    supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("status", "live"),
    supabase.from("past_papers").select("*", { count: "exact", head: true }),
    supabase
      .from("past_papers")
      .select("*", { count: "exact", head: true })
      .eq("status", "live"),
  ]);

  const stats = [
    {
      label: "Lessons",
      total: lessonsTotal ?? 0,
      live: lessonsLive ?? 0,
      href: "/admin/lessons",
    },
    {
      label: "Past papers",
      total: papersTotal ?? 0,
      live: papersLive ?? 0,
      href: "/admin/past-papers",
    },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-medium">Admin</h1>
      <p className="mt-2 text-sm text-slate-600">
        Content management for lessons and past papers.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group rounded-lg border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-sm"
          >
            <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
              {s.label}
            </p>
            <p className="mt-3 text-4xl font-medium tabular-nums">{s.total}</p>
            <p className="mt-2 text-sm text-slate-600">
              {s.live} live · {(s.total ?? 0) - (s.live ?? 0)} draft/other
            </p>
            <p className="mt-4 text-sm text-slate-500 group-hover:text-slate-900">
              Manage →
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="font-display text-xl font-medium">Reference</h2>
        <p className="mt-1 text-sm text-slate-600">
          Read-only views for linking lessons.
        </p>
        <div className="mt-3">
          <Link
            href="/admin/catalogue"
            className="text-sm text-blue-700 hover:underline"
          >
            Catalogue browser →
          </Link>
        </div>
      </div>
    </div>
  );
}
