import { redirect } from "next/navigation";
import Link from "next/link";

import { getAdminStatus } from "@/lib/admin/auth";

/**
 * Admin section shell. Re-checks admin status server-side on every render —
 * the proxy in src/proxy.ts already gates /admin/*, but layouts render on
 * every child navigation, so this second check keeps the guarantee local to
 * the layout tree. Server actions do their own assertAdmin() check.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ok } = await getAdminStatus();
  if (!ok) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
          <div className="mb-6 px-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
              Ailemy
            </p>
            <p className="font-display text-lg font-medium">Admin</p>
          </div>
          <nav className="flex flex-col gap-1 text-sm">
            <NavLink href="/admin">Dashboard</NavLink>
            <NavLink href="/admin/lessons">Lessons</NavLink>
            <NavLink href="/admin/past-papers">Past papers</NavLink>
            <NavLink href="/admin/announcements">Announcements</NavLink>
            <NavLink href="/admin/interest">Tuition demand</NavLink>
            <div className="mt-6 mb-2 px-3 text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Read-only
            </div>
            <NavLink href="/admin/catalogue">Catalogue</NavLink>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}
