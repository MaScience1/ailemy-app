import { CANONICAL_TZ, formatDay, formatTime } from "@/lib/schedule/timezone";
import { createAdminClient } from "@/lib/supabase/admin";

import { ResolveForm } from "./_forms";

/**
 * The cancellation queue (§54) — the other end of 0052.
 *
 * ============================================================================
 * ⚠ AN OPEN REQUEST IS A FAMILY WAITING FOR AN ANSWER
 * ============================================================================
 * The student was told the lesson stays booked until we reply. That promise is
 * only kept if somebody sees the request, so this screen sorts by oldest-first
 * and says how long each one has been waiting. A queue ordered newest-first
 * buries the person who has waited longest, which is exactly backwards.
 *
 * ⚠ SERVICE ROLE, AND THAT IS THE POINT. 0052 lets a student read their OWN
 * requests and nothing else; an admin needs all of them, with the booking they
 * refer to. Who may see this screen is decided by /admin/layout.tsx and the
 * proxy, and resolveRequest re-checks with assertAdmin().
 */
export const dynamic = "force-dynamic";

type Row = {
  id: string; booking_id: string; user_id: string | null;
  requested_by_email: string; reason: string | null; student_note: string | null;
  status: string; resolution: string | null; resolution_note: string | null;
  resolved_at: string | null; created_at: string;
};

const hoursSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);

export default async function AdminCancellationsPage() {
  const db = createAdminClient();

  const res = await db.from("cancellation_requests")
    .select("id,booking_id,user_id,requested_by_email,reason,student_note,status,resolution,resolution_note,resolved_at,created_at")
    .order("created_at", { ascending: true });

  const notMigrated = res.error && ["PGRST205", "42P01", "PGRST204", "42703"].includes(res.error.code ?? "");
  const rows = (res.data ?? []) as unknown as Row[];
  const open = rows.filter((r) => r.status === "open");
  const closed = rows.filter((r) => r.status !== "open").reverse();

  // The bookings these refer to, so a decision is made with the lesson in view.
  const ids = [...new Set(rows.map((r) => r.booking_id))];
  const bookings = ids.length
    ? await db.from("private_bookings")
        .select("id,booking_ref,starts_at,ends_at,subject,status,paid_with,email").in("id", ids)
    : { data: [], error: null };
  const byId = new Map(
    ((bookings.data ?? []) as unknown as Record<string, string>[]).map((b) => [String(b.id), b]),
  );

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium">Cancellation requests</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Cash refunds, and anything inside the notice period. A credit-paid lesson cancelled in good
        time never reaches this queue — that is self-service. Oldest first: the student was told the
        lesson stays booked until we reply.
      </p>

      {res.error && (
        <p role="alert" className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notMigrated
            ? "Migration 0052 is not applied on this deployment, so the table does not exist."
            : "Could not load the queue."}{" "}
          <span className="font-mono text-[11px]">{res.error.code}: {res.error.message}</span>
        </p>
      )}

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-display text-lg font-medium">
          Waiting {open.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{open.length}</span>}
        </h2>
        {open.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Nothing waiting. {rows.length === 0 ? "No request has ever been made." : "All caught up."}
          </p>
        ) : (
          <ul className="mt-5 space-y-5">
            {open.map((r) => {
              const b = byId.get(r.booking_id);
              const waited = hoursSince(r.created_at);
              return (
                <li key={r.id} className="rounded border border-slate-200 p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-sm font-medium text-slate-900">{r.requested_by_email}</p>
                    {/* ⚠ HOW LONG THEY HAVE WAITED, NOT WHEN THEY ASKED. "31h"
                        prompts an answer; "yesterday 14:02" needs arithmetic. */}
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                      waited >= 24 ? "bg-red-100 text-red-900" : "bg-slate-100 text-slate-600"
                    }`}>
                      waiting {waited}h
                    </span>
                    {b?.booking_ref && (
                      <span className="font-mono text-[11px] text-slate-500">{b.booking_ref}</span>
                    )}
                  </div>

                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    {b
                      ? `${formatDay(new Date(b.starts_at), CANONICAL_TZ)} ${formatTime(new Date(b.starts_at), CANONICAL_TZ)}–${formatTime(new Date(b.ends_at), CANONICAL_TZ)} Doha · ${b.subject ?? "1-to-1"} · paid with ${b.paid_with} · lesson is ${b.status}`
                      : "⚠ the booking this refers to could not be read"}
                  </p>

                  {r.reason && (
                    <p className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">“{r.reason}”</p>
                  )}
                  {r.student_note && (
                    <p className="mt-1 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">“{r.student_note}”</p>
                  )}

                  <div className="mt-4">
                    <ResolveForm id={r.id} paidWith={String(b?.paid_with ?? "")} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-display text-lg font-medium">Decided</h2>
          {/* ⚠ KEPT ON SCREEN, NOT ARCHIVED AWAY. "What did we tell them?" is the
              question this table exists to answer, and it is asked weeks later. */}
          <ul className="mt-5 space-y-2">
            {closed.slice(0, 40).map((r) => {
              const b = byId.get(r.booking_id);
              return (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded border border-slate-200 px-4 py-3 text-sm">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {r.resolution ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 text-slate-700">{r.requested_by_email}</span>
                  {b?.booking_ref && <span className="font-mono text-[11px] text-slate-400">{b.booking_ref}</span>}
                  <span className="font-mono text-[10px] text-slate-400">
                    {r.resolved_at ? formatDay(new Date(r.resolved_at), CANONICAL_TZ) : "—"}
                  </span>
                  {r.resolution_note && (
                    <span className="w-full text-xs text-slate-500">{r.resolution_note}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
