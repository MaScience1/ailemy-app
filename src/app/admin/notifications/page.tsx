import { CANONICAL_TZ, formatDay, formatTime } from "@/lib/schedule/timezone";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The outbox, as an operator sees it (§47, §50) — 0053's queue.
 *
 * ============================================================================
 * ⚠ THERE IS NO SENDER. THIS SCREEN EXISTS BECAUSE OF THAT, NOT DESPITE IT.
 * ============================================================================
 * Every booking, cancellation and resolution writes a notification_events row
 * and its deliveries. in_app is delivered by being written — the student's
 * panel reads the table directly. `email` is written 'pending' and NOTHING
 * PICKS IT UP: no provider is configured and no sender exists.
 *
 * That is a deliberate stage, and it is only safe while somebody can SEE it.
 * A queue nobody can look at is indistinguishable from a queue that is being
 * drained, and the difference is a family who was never told their lesson
 * moved. So the pending count is the headline number on this page and the age
 * of the oldest one sits beside it.
 *
 * ⚠ THE PANEL SHOWS WHAT WAS SENT, NOT WHAT WAS WRITTEN AS COPY. payload holds
 * FACTS; the sentence is rendered from a template at read time. An operator
 * asking "what did we tell them?" is answered by the student's own panel
 * rendering the same row — not by a second copy stored here.
 */
export const dynamic = "force-dynamic";

type Delivery = {
  id: string; event_id: string; channel: string; status: string;
  attempts: number; error: string | null;
  scheduled_for: string; sent_at: string | null; read_at: string | null;
};
type Event = {
  id: string; kind: string; email: string | null; user_id: string | null;
  created_at: string; idempotency_key: string;
};

const ageHours = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);

export default async function AdminNotificationsPage() {
  const db = createAdminClient();

  const [evRes, dlRes] = await Promise.all([
    db.from("notification_events")
      .select("id,kind,email,user_id,created_at,idempotency_key")
      .order("created_at", { ascending: false }).limit(60),
    db.from("notification_deliveries")
      .select("id,event_id,channel,status,attempts,error,scheduled_for,sent_at,read_at")
      .order("scheduled_for", { ascending: true }).limit(400),
  ]);

  const error = evRes.error ?? dlRes.error;
  const notMigrated = error && ["PGRST205", "42P01", "PGRST204", "42703"].includes(error.code ?? "");
  const events = (evRes.data ?? []) as unknown as Event[];
  const deliveries = (dlRes.data ?? []) as unknown as Delivery[];

  const byEvent = new Map<string, Delivery[]>();
  for (const d of deliveries) byEvent.set(d.event_id, [...(byEvent.get(d.event_id) ?? []), d]);

  const pending = deliveries.filter((d) => d.status === "pending");
  const failed = deliveries.filter((d) => d.status === "failed");
  // ⚠ OLDEST, NOT NEWEST. A queue's health is the age of the thing that has
  // been waiting longest; an average hides exactly the row that matters.
  const oldest = pending.length
    ? pending.reduce((a, b) => (a.scheduled_for <= b.scheduled_for ? a : b))
    : null;

  const unreadInApp = deliveries.filter((d) => d.channel === "in_app" && d.read_at === null).length;

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium">Notifications</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Every message the system has decided to send. One event row per real-world fact, one
        delivery row per channel.
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notMigrated
            ? "Migration 0053 is not applied on this deployment."
            : "Could not load the outbox."}{" "}
          <span className="font-mono text-[11px]">{error.code}: {error.message}</span>
        </p>
      )}

      {/* ⚠ THE HONEST BANNER, NOT A WARNING. This is the current truth, and it
          is the first thing on the page because the pending count below is
          meaningless without it. */}
      <p className="mt-6 rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <strong>No email sender is running.</strong> In-app messages are delivered by being
        written — a student sees them immediately in Schedule updates. Email rows stay{" "}
        <span className="font-mono text-[11px]">pending</span> and nothing picks them up yet, so the
        count below is what a sender would find waiting on its first run — not a backlog anybody is
        working through.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Pending" value={String(pending.length)}
          hint={oldest ? `oldest ${ageHours(oldest.scheduled_for)}h` : "nothing waiting"}
          alarm={oldest !== null && ageHours(oldest.scheduled_for) >= 48} />
        <Stat label="Failed" value={String(failed.length)}
          hint={failed.length ? "needs a look" : "none"} alarm={failed.length > 0} />
        <Stat label="Events" value={String(events.length)} hint="most recent 60" />
        <Stat label="Unread in-app" value={String(unreadInApp)} hint="students have not opened" />
      </div>

      {failed.length > 0 && (
        <section className="mt-8 rounded-lg border border-red-300 bg-red-50 p-5">
          <h2 className="font-display text-lg font-medium text-red-900">Failed deliveries</h2>
          <ul className="mt-4 space-y-2 text-sm text-red-900">
            {failed.slice(0, 20).map((d) => (
              <li key={d.id} className="font-mono text-[11px]">
                {d.channel} · {d.attempts} attempt(s) · {d.error ?? "no error recorded"}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-display text-lg font-medium">Recent events</h2>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Nothing yet. A booking, a cancellation or a resolution writes one.
          </p>
        ) : (
          <ul className="mt-5 space-y-2">
            {events.map((e) => {
              const ds = byEvent.get(e.id) ?? [];
              return (
                <li key={e.id} className="rounded border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{e.kind}</span>
                    {/* ⚠ THE RECIPIENT, AND WHICH KIND IT IS. A user_id row is
                        reachable in-app; an email-only row is a parent with no
                        account, and ONLY email can reach them. */}
                    <span className="min-w-0 flex-1 text-sm text-slate-700">
                      {e.user_id ? "account holder" : e.email ?? "⚠ no recipient"}
                      {!e.user_id && e.email && (
                        <span className="ml-2 font-mono text-[10px] text-slate-400">no account — email only</span>
                      )}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {formatDay(new Date(e.created_at), CANONICAL_TZ)}{" "}
                      {formatTime(new Date(e.created_at), CANONICAL_TZ)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {ds.length === 0 ? (
                      // ⚠ AN EVENT WITH NO DELIVERIES IS A REAL FAULT: something
                      // decided to tell somebody and then queued no way to do it.
                      <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px] text-red-900">
                        no deliveries — nothing will ever send this
                      </span>
                    ) : ds.map((d) => (
                      <span key={d.id} className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                        d.status === "sent" ? "bg-emerald-100 text-emerald-900"
                        : d.status === "failed" ? "bg-red-100 text-red-900"
                        : "bg-slate-100 text-slate-600"
                      }`}>
                        {d.channel} {d.status}
                        {d.channel === "in_app" && d.read_at ? " · read" : ""}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{e.idempotency_key}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint, alarm }: {
  label: string; value: string; hint?: string; alarm?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-5 ${alarm ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`font-display mt-2 text-2xl ${alarm ? "text-red-900" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
