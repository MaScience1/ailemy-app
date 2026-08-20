import "server-only";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { loadCalendar } from "@/lib/schedule/readers";
import { balance, ledgerLines, type CreditTx } from "./credits.ts";

/**
 * What one student sees on My Tuition (§35).
 *
 * ⚠ READ AS THE STUDENT, NOT AS THE SERVICE ROLE. Every query here goes through
 * the session client, so 0046's private_bookings_read_own and 0047's
 * lesson_credit_transactions_read_own are what decide the rows. A service-role
 * read filtered by user_id in application code would work identically until the
 * day the filter is wrong — and then it would return somebody else's lessons.
 * The policy is the boundary; this code is not.
 *
 * ⚠ EVERY SECTION DEGRADES TO AN HONEST EMPTY. 0045–0047 are unapplied, so
 * bookings and credits do not exist yet; the page says "no private lessons"
 * rather than erroring, and enrolled group lessons still render.
 */

export type MyBooking = {
  id: string; startsAt: Date; endsAt: Date; subject: string | null;
  status: string; paidWith: string;
  /** 0051's AIL- handle. Nullable: a row could predate the backfill. */
  bookingRef: string | null;
};

export type MyTuition = {
  signedIn: boolean;
  /**
   * ⚠ THE SESSION'S OWN id, SO A CALLER NEVER HAS TO RE-ASK auth FOR IT.
   * Every row below came back through an own-row policy, so this is already
   * the owner of all of them — it is exported so a policy decision (can this
   * be cancelled?) can be made without a second round trip and without
   * matching on email, which is not an identity.
   */
  userId: string | null;
  email: string | null;
  /** Group sessions for cohorts this student is enrolled on. */
  groupSessions: Awaited<ReturnType<typeof loadCalendar>>["sessions"];
  enrolledCohortSlugs: string[];
  upcomingPrivate: MyBooking[];
  pastPrivate: MyBooking[];
  creditBalance: number;
  ledger: CreditTx[];
  /** Present when a section could not be read — never silently empty. */
  notes: string[];
};

const NOT_MIGRATED = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

export async function loadMyTuition(now = new Date()): Promise<MyTuition> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const base: MyTuition = {
    signedIn: Boolean(user), userId: user?.id ?? null, email: user?.email ?? null,
    groupSessions: [], enrolledCohortSlugs: [],
    upcomingPrivate: [], pastPrivate: [],
    creditBalance: 0, ledger: [], notes: [],
  };
  if (!user) return base;

  const notes: string[] = [];

  // ── group lessons, for cohorts this student is actually enrolled on ──────
  let slugs: string[] = [];
  const enrol = await supabase
    .from("cohort_enrolments")
    .select("cohort_id,status")
    .eq("user_id", user.id)
    .in("status", ["paid", "active"]);
  if (enrol.error) {
    notes.push(`Could not read your enrolments (${enrol.error.code}).`);
  } else if ((enrol.data ?? []).length > 0) {
    const ids = (enrol.data as { cohort_id: string }[]).map((r) => r.cohort_id);
    const cohorts = await supabase.from("cohorts").select("id,slug").in("id", ids);
    slugs = ((cohorts.data ?? []) as { slug: string }[]).map((c) => c.slug);
  }

  const iso = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString().slice(0, 10);
  const groupSessions: MyTuition["groupSessions"] = [];
  for (const slug of slugs) {
    const cal = await loadCalendar({ from: iso(0), to: iso(56), cohortSlug: slug, includeCancelled: true });
    groupSessions.push(...cal.sessions);
  }
  groupSessions.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  // ── private bookings ────────────────────────────────────────────────────
  const upcoming: MyBooking[] = [];
  const past: MyBooking[] = [];
  const bookings = await supabase
    .from("private_bookings")
    .select("id,starts_at,ends_at,subject,status,paid_with,booking_ref")
    .order("starts_at", { ascending: true });
  if (bookings.error) {
    if (!NOT_MIGRATED.has(bookings.error.code ?? "")) {
      notes.push(`Could not read your private bookings (${bookings.error.code}).`);
    }
  } else {
    for (const r of (bookings.data ?? []) as unknown as Record<string, unknown>[]) {
      const s = str(r.starts_at), e = str(r.ends_at), id = str(r.id);
      if (!s || !e || !id) continue;
      const b: MyBooking = {
        id, startsAt: new Date(s), endsAt: new Date(e),
        subject: str(r.subject), status: str(r.status) ?? "confirmed",
        paidWith: str(r.paid_with) ?? "single",
        bookingRef: str(r.booking_ref),
      };
      // A cancelled lesson is history the moment it is cancelled, whatever
      // its date — showing it under "upcoming" would read as still happening.
      (b.endsAt.getTime() > now.getTime() && b.status === "confirmed" ? upcoming : past).push(b);
    }
    past.reverse();
  }

  // ── credits ─────────────────────────────────────────────────────────────
  let ledger: CreditTx[] = [];
  const credits = await supabase
    .from("lesson_credit_transactions")
    .select("id,user_id,delta,reason,booking_id,idempotency_key,expires_at,created_at");
  if (credits.error) {
    if (!NOT_MIGRATED.has(credits.error.code ?? "")) {
      notes.push(`Could not read your lesson credits (${credits.error.code}).`);
    }
  } else {
    ledger = ((credits.data ?? []) as unknown as Record<string, unknown>[]).flatMap((r) => {
      const id = str(r.id), uid = str(r.user_id), created = str(r.created_at);
      const delta = Number(r.delta);
      if (!id || !uid || !created || !Number.isFinite(delta)) return [];
      return [{
        id, userId: uid, delta, reason: (str(r.reason) ?? "admin_adjustment") as CreditTx["reason"],
        bookingId: str(r.booking_id), idempotencyKey: str(r.idempotency_key),
        expiresAt: str(r.expires_at), createdAt: created,
      }];
    });
  }

  return {
    ...base,
    groupSessions, enrolledCohortSlugs: slugs,
    upcomingPrivate: upcoming, pastPrivate: past,
    // ⚠ DERIVED FROM THE LEDGER, NEVER READ FROM A COLUMN (§61).
    creditBalance: balance(ledger, now),
    ledger: ledgerLines(ledger),
    notes,
  };
}
