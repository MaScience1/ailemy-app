import "server-only";

import { createClient } from "@supabase/supabase-js";

import { loadCalendar } from "@/lib/schedule/readers";
import { holdsAsBusy, type Hold } from "./holds.ts";
import { openSlots, type AvailabilityRule, type Busy, type Slot } from "./slots.ts";
import type { IsoWeekday } from "@/lib/schedule/recurrence";

/**
 * Open 1-to-1 slots, and the packages that pay for them.
 *
 * ============================================================================
 * ⚠ SLOTS ARE COMPUTED HERE AND THE BROWSER RECEIVES ONLY THE OPEN ONES
 * ============================================================================
 * §62: the public may see available slots and must NOT see booking ownership.
 * The obvious shape is to let anon read private_bookings behind a column grant
 * covering only the times. This does not do that. anon has NO access to
 * bookings or holds at all (0046) — the subtraction happens server-side with
 * the service role and the page is handed a list of free times.
 *
 * That means there is no column list to get wrong in a later migration, and no
 * row policy standing between a student's name and the internet.
 *
 * ⚠ GROUP LESSONS COME FROM THE SAME READER EVERY PAGE USES. §25 requires that
 * a private slot never overlaps a group lesson; loadCalendar() is the one
 * schedule source, so a lesson moved in /admin/calendar removes the colliding
 * private slot on the next read with no second system to update.
 */

const NOT_MIGRATED = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TuitionPackage = {
  id: string; slug: string; name: string; description: string | null;
  subject: string | null; credits: number; slotMinutes: number;
  priceMinor: number; currency: string;
  /** ⚠ NULL MEANS IT CANNOT BE BOUGHT. No Buy button, ever. */
  stripePriceId: string | null;
  validityMonths: number | null;
};

export type SlotsLoad = {
  slots: Slot[];
  packages: TuitionPackage[];
  /** True once availability exists; false is an honest "nothing published". */
  hasAvailability: boolean;
  reason?: string;
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
const hhmm = (v: unknown): string | null => {
  const s = str(v); const m = s && /^(\d{2}):(\d{2})/.exec(s);
  return m ? `${m[1]}:${m[2]}` : null;
};

export async function loadOpenSlots(args: {
  from: string; to: string; now: Date; subject?: string;
}): Promise<SlotsLoad> {
  const empty: SlotsLoad = { slots: [], packages: [], hasAvailability: false };
  const db = admin();
  if (!db) return { ...empty, reason: "supabase env vars absent" };

  const [avail, blocks, bookings, holds, packages] = await Promise.all([
    db.from("teacher_availability").select(
      "id,teacher_id,subject,weekday,specific_date,start_time,end_time,timezone," +
      "slot_minutes,buffer_minutes,valid_from,valid_until,booking_horizon_days,booking_cutoff_hours,is_active",
    ).eq("is_active", true),
    db.from("availability_blocks").select("id,teacher_id,starts_at,ends_at"),
    // ⚠ ONLY LIVE BOOKINGS BLOCK A SLOT. A cancelled lesson frees its time —
    // the same rule 0046's exclusion constraint applies in the database.
    db.from("private_bookings").select("starts_at,ends_at,status").in("status", ["confirmed", "completed"]),
    db.from("booking_holds").select("id,teacher_id,user_id,email,starts_at,ends_at,expires_at,checkout_ref"),
    db.from("tuition_packages").select(
      "id,slug,name,description,subject,credits,slot_minutes,price_minor,currency,stripe_price_id,validity_months,display_order",
    ).eq("is_active", true).order("display_order"),
  ]);

  const failed = [avail.error, blocks.error, bookings.error, holds.error, packages.error].find(Boolean);
  if (failed) {
    return {
      ...empty,
      reason: NOT_MIGRATED.has(failed.code ?? "")
        ? `0045–0047 not applied (${failed.code}: ${failed.message})`
        : `${failed.code}: ${failed.message}`,
    };
  }

  const rules: AvailabilityRule[] = [];
  for (const r of (avail.data ?? []) as unknown as Record<string, unknown>[]) {
    const id = str(r.id), teacherId = str(r.teacher_id);
    const start = hhmm(r.start_time), end = hhmm(r.end_time);
    // ⚠ A ROW WE CANNOT READ IS DROPPED, NEVER DEFAULTED. Defaulting a missing
    // start time would publish a slot at midnight.
    if (!id || !teacherId || !start || !end) continue;
    rules.push({
      id, teacherId, subject: str(r.subject),
      weekday: r.weekday === null || r.weekday === undefined ? null : (Number(r.weekday) as IsoWeekday),
      specificDate: str(r.specific_date),
      startTime: start, endTime: end,
      timezone: str(r.timezone) ?? "Asia/Qatar",
      slotMinutes: Number(r.slot_minutes) || 60,
      bufferMinutes: Number(r.buffer_minutes) || 0,
      validFrom: str(r.valid_from), validUntil: str(r.valid_until),
      bookingHorizonDays: Number(r.booking_horizon_days) || 42,
      bookingCutoffHours: Number(r.booking_cutoff_hours) || 0,
      isActive: r.is_active !== false,
    });
  }

  if (rules.length === 0) return { ...empty, packages: mapPackages(packages.data) };

  const busy: Busy[] = [];
  for (const b of (blocks.data ?? []) as unknown as Record<string, unknown>[]) {
    const s = str(b.starts_at), e = str(b.ends_at);
    if (s && e) busy.push({ startsAt: new Date(s), endsAt: new Date(e), kind: "block" });
  }
  for (const b of (bookings.data ?? []) as unknown as Record<string, unknown>[]) {
    const s = str(b.starts_at), e = str(b.ends_at);
    if (s && e) busy.push({ startsAt: new Date(s), endsAt: new Date(e), kind: "booking" });
  }
  const liveHoldRows: Hold[] = [];
  for (const h of (holds.data ?? []) as unknown as Record<string, unknown>[]) {
    const s = str(h.starts_at), e = str(h.ends_at), x = str(h.expires_at), tid = str(h.teacher_id);
    if (s && e && x && tid) {
      liveHoldRows.push({
        id: str(h.id) ?? "", teacherId: tid, userId: str(h.user_id), email: str(h.email) ?? "",
        startsAt: new Date(s), endsAt: new Date(e), expiresAt: new Date(x), checkoutRef: str(h.checkout_ref),
      });
    }
  }
  // ⚠ EXPIRY IS APPLIED HERE, ON READ. No sweep job is required for the slot
  // to come back; an abandoned checkout releases itself.
  busy.push(...holdsAsBusy(liveHoldRows, args.now));

  // ⚠ THE GROUP TIMETABLE, FROM THE ONE SCHEDULE SOURCE (§25).
  const cal = await loadCalendar({ from: args.from, to: args.to, includeCancelled: false });
  for (const s of cal.sessions) {
    busy.push({ startsAt: s.startsAt, endsAt: s.endsAt, kind: "group" });
  }

  return {
    slots: openSlots({ rules, busy, from: args.from, to: args.to, now: args.now, subject: args.subject }),
    packages: mapPackages(packages.data),
    hasAvailability: true,
  };
}

function mapPackages(rows: unknown): TuitionPackage[] {
  const out: TuitionPackage[] = [];
  for (const r of (rows ?? []) as Record<string, unknown>[]) {
    const id = str(r.id), slug = str(r.slug), name = str(r.name);
    if (!id || !slug || !name) continue;
    const credits = Number(r.credits), priceMinor = Number(r.price_minor);
    if (!Number.isInteger(credits) || credits < 1 || !Number.isFinite(priceMinor)) continue;
    out.push({
      id, slug, name, description: str(r.description), subject: str(r.subject),
      credits, slotMinutes: Number(r.slot_minutes) || 60,
      priceMinor, currency: str(r.currency) ?? "GBP",
      stripePriceId: str(r.stripe_price_id),
      validityMonths: r.validity_months === null ? null : Number(r.validity_months),
    });
  }
  return out;
}
