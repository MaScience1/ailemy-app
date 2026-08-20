import "server-only";

import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * What this student has been told (§47) — the reading half of 0053.
 *
 * ============================================================================
 * ⚠ READ AS THE STUDENT, SO 0053's POLICIES DECIDE, NOT THIS FILE
 * ============================================================================
 * Every row comes back through the session client, so
 * notification_deliveries_read_own and notification_events_read_own are the
 * boundary. A service-role read filtered by user_id in application code would
 * behave identically right up until the filter was wrong, and then it would
 * hand one student another's messages. Both policies were exercised against a
 * real session on 2026-08-20; this relies on that, rather than re-implementing
 * it.
 *
 * ⚠ ONLY channel='in_app'. An email delivery row is a record of what the
 * SENDER did; it is not a message in the panel, and rendering it would show a
 * student the same fact twice.
 */

export type InboxItem = {
  deliveryId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  readAt: Date | null;
};

export type Inbox = {
  items: InboxItem[];
  unread: number;
  /** Present when the panel could not be read — never a silent empty list. */
  note: string | null;
};

const MIGRATION_ABSENT = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);

export async function loadInbox(limit = 20): Promise<Inbox> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], unread: 0, note: null };

  /**
   * ⚠ ONE QUERY, EMBEDDING THE EVENT. The kind and payload live on the event
   * and the read state lives on the delivery, so the panel needs both. Two
   * round trips joined in application code would also work and would be one
   * more place for the join to be wrong.
   */
  const res = await supabase
    .from("notification_deliveries")
    .select("id,read_at,created_at,notification_events(kind,payload,created_at)")
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error) {
    // A missing table is the honest "not switched on yet" and says nothing to
    // the student; anything else is a fault they should not have to guess at.
    return {
      items: [], unread: 0,
      note: MIGRATION_ABSENT.has(res.error.code ?? "")
        ? null
        : `We could not load your updates just now (${res.error.code}).`,
    };
  }

  const items: InboxItem[] = [];
  for (const raw of (res.data ?? []) as unknown as Record<string, unknown>[]) {
    const id = typeof raw.id === "string" ? raw.id : null;
    // PostgREST returns an embedded to-one as an object; older shapes gave an
    // array. Both are handled because guessing wrong renders an empty panel.
    const evRaw = Array.isArray(raw.notification_events)
      ? raw.notification_events[0]
      : raw.notification_events;
    const ev = (evRaw ?? null) as Record<string, unknown> | null;
    const kind = ev && typeof ev.kind === "string" ? ev.kind : null;
    const created = typeof raw.created_at === "string" ? new Date(raw.created_at) : null;
    // ⚠ A ROW WE CANNOT READ IS DROPPED, NOT DEFAULTED. A message with no kind
    // would render as the unknown-kind fallback and tell a student to ask us
    // about something that does not exist.
    if (!id || !kind || !created || Number.isNaN(created.getTime())) continue;

    items.push({
      deliveryId: id,
      kind,
      payload: (ev?.payload ?? {}) as Record<string, unknown>,
      createdAt: created,
      readAt: typeof raw.read_at === "string" ? new Date(raw.read_at) : null,
    });
  }

  return { items, unread: items.filter((i) => i.readAt === null).length, note: null };
}
