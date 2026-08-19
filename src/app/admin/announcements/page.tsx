import { isLiveNow } from "@/lib/admin/announcement-form";
import { createAdminClient } from "@/lib/supabase/admin";

import { AnnouncementForm, type EditableAnnouncement } from "./_form";
import { RowActions } from "./_row-actions";

/**
 * Announcements (spec §5) — create, edit, switch on/off, schedule, CTA, priority.
 *
 * ⚠ THE LIST IS READ WITH THE SERVICE ROLE, AND THAT IS THE POINT OF AN ADMIN
 * SCREEN: it must show drafts, expired rows and disabled ones — everything the
 * public policy hides. What it must NOT do is decide who may see it, and it
 * does not: /admin/layout.tsx redirects a non-admin before this renders, the
 * proxy gates /admin/*, and every action re-checks with assertAdmin().
 *
 * ⚠ "LIVE NOW" IS COMPUTED, NOT STORED. The badge runs the same window rule the
 * public bar runs. A row that says On but is outside its window says so, rather
 * than leaving the admin to work out why nothing is showing.
 */
export const dynamic = "force-dynamic";

const COLUMNS =
  "id,title,body,category,status,cta_label,link_url,starts_at,ends_at,priority,enabled,created_at";

export default async function AnnouncementsPage() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("announcements")
    .select(COLUMNS)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as (EditableAnnouncement & { created_at: string })[];
  const now = new Date();
  const notMigrated =
    error && (error.code === "PGRST204" || error.code === "42703" || error.code === "PGRST205");

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium">Announcements</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        The site-wide bar shows exactly one announcement: the highest-priority row that is
        switched on and inside its window. Everything else here is invisible to visitors.
      </p>

      {error && (
        // ⚠ THE ERROR IS THE SCREEN, NOT A CONSOLE LINE. An admin looking at an
        // empty list has no way to tell "nothing written yet" from "the query
        // failed", and those need opposite actions.
        <p role="alert" className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notMigrated
            ? "Migration 0039 has not been applied yet, so the scheduling columns do not exist. Nothing on this screen can be saved until it is run."
            : "Could not load announcements."}{" "}
          <span className="font-mono text-[11px]">{error.code}: {error.message}</span>
        </p>
      )}

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-display text-lg font-medium">New announcement</h2>
        <div className="mt-4">
          <AnnouncementForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-medium">
          All announcements{rows.length > 0 && <span className="ml-2 font-mono text-xs text-slate-500">{rows.length}</span>}
        </h2>

        {!error && rows.length === 0 && (
          <p className="mt-3 text-sm text-slate-600">None written yet.</p>
        )}

        <ul className="mt-4 space-y-3">
          {rows.map((a) => {
            const live = isLiveNow(
              { enabled: a.enabled, startsAt: a.starts_at, endsAt: a.ends_at },
              now,
            );
            return (
              <li key={a.id} className="rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{a.title}</p>
                    {a.body && <p className="mt-0.5 text-sm text-slate-600">{a.body}</p>}
                    <p className="mt-1 font-mono text-[11px] text-slate-500">
                      {a.category} · {a.status} · priority {a.priority}
                      {a.starts_at && ` · from ${new Date(a.starts_at).toLocaleString()}`}
                      {a.ends_at && ` · until ${new Date(a.ends_at).toLocaleString()}`}
                      {a.cta_label && a.link_url && ` · CTA “${a.cta_label}” → ${a.link_url}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                      live ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {live ? "on the site now" : a.enabled ? "on, outside window" : "off"}
                  </span>
                </div>
                <div className="border-t border-slate-100 px-5 py-3">
                  <RowActions id={a.id} enabled={a.enabled} title={a.title} />
                </div>
                <details className="border-t border-slate-100">
                  <summary className="cursor-pointer px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    Edit
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <AnnouncementForm existing={a} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
