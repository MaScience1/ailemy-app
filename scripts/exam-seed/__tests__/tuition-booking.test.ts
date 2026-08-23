/**
 * 1-to-1 booking: one availability rule, no invented slots, and an honest
 * account of what this suite cannot prove.
 *
 * ============================================================================
 * ⚠ SOME OF THIS IS PENDING, AND PENDING IS NOT PASSING
 * ============================================================================
 * The atomicity guarantee, the double-booking race and the RLS policies live
 * in SQL that has not been applied. A test that asserts them here would be
 * asserting the contents of a text file, not the behaviour of a database, and
 * would go green while the guarantee did not exist. They are printed as PENDING
 * with the exact query that settles each one, and they are excluded from the
 * pass count — the same channel schema-probe.test.ts uses when it has no
 * database.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { nextAvailableSlot, nextAvailableSlots, nextGroupSession } from "../../../src/lib/booking/next-available.ts";

let pass = 0, fail = 0, pending = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
/** ⚠ NOT A PASS. Printed, counted separately, and named in the report. */
const todo = (n: string, why: string) => {
  pending++; console.log("  ⏳ PENDING " + n + "\n      " + why);
};

const APP = "src/app";
const SERVICE = readFileSync("src/lib/booking/next-available.ts", "utf8");
const MIGRATION = existsSync("supabase/migrations/PROPOSED_tuition_booking.sql")
  ? readFileSync("supabase/migrations/PROPOSED_tuition_booking.sql", "utf8") : "";
const ACTIONS = readFileSync("src/lib/booking/actions.ts", "utf8");

const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
  .replace(/^\s*--.*$/gm, " ");

/**
 * ⚠ STRIPPED COPIES, NAMED UP FRONT — THE SIXTH TIME THIS TRAP HAS BEEN SPRUNG.
 * The parked migration explains that there is no `remaining_credits` integer,
 * and a raw scan for that word found the explanation. Every content check below
 * reads a *_C constant; the raw text is used only where the literal formatting
 * is what is being asserted.
 */
const MIGRATION_C = code(MIGRATION);
const ACTIONS_C = code(ACTIONS);
const SERVICE_C = code(SERVICE);

const ev = (over: Partial<{ key: string; type: string; status: string; startsAt: Date; subject: string | null; bookable: boolean }> = {}) => ({
  key: "k", type: "private_open", status: "scheduled",
  startsAt: new Date("2026-09-15T16:00:00Z"), endsAt: new Date("2026-09-15T17:00:00Z"),
  title: "1-to-1 Chemistry", subject: "chemistry", qualification: null, yearGroup: null,
  cohortSlug: null, teacherName: null, cancelledReason: null, ...over,
}) as never;

const NOW = new Date("2026-09-01T00:00:00Z");

// ============================================================================
console.log("\n=== 1. ⚠ §24 — ONE next-available rule, not five ===");
// ============================================================================
{
  /**
   * ⚠ FIVE SURFACES EACH DERIVED THIS SEPARATELY, OVER DIFFERENT EVENT SETS.
   * They agreed only because teacher_availability has no rows. The first
   * published slot would have made them disagree about which one is "next",
   * each defensibly.
   */
  const SURFACES = [
    "src/app/page.tsx", "src/app/calendar/page.tsx", "src/app/tuition/page.tsx",
    "src/components/home/HeroAvailability.tsx", "src/components/calendar/CalendarShortcuts.tsx",
  ];
  for (const f of SURFACES) {
    const src = readFileSync(f, "utf8");
    t(`§24 — ${f.split("/").pop()} uses the service`, /nextAvailableSlot\(/.test(src));
    t(`§24 — …and derives no rule of its own`,
      !/nextOf\([^)]*private_open/.test(code(src)), code(src).match(/nextOf\([^)]*private_open[^)]*\)/)?.[0]);
  }
  t("§24 — the rule lives in exactly one module",
    existsSync("src/lib/booking/next-available.ts"));

  // The rule itself, exercised.
  t("a future open slot is available", nextAvailableSlot([ev()], { now: NOW }) !== null);
  t("⚠ §66 — a slot that has already started is not",
    nextAvailableSlot([ev({ startsAt: new Date("2026-08-01T00:00:00Z") })], { now: NOW }) === null);
  t("a cancelled slot is not", nextAvailableSlot([ev({ status: "cancelled" })], { now: NOW }) === null);
  t("a group session is not a 1-to-1 slot",
    nextAvailableSlot([ev({ type: "group" })], { now: NOW }) === null);
  t("soonest first", (nextAvailableSlots([
    ev({ key: "b", startsAt: new Date("2026-09-20T16:00:00Z") }),
    ev({ key: "a", startsAt: new Date("2026-09-16T16:00:00Z") }),
  ], { now: NOW })[0] as unknown as { key: string }).key === "a");
  t("§21 — eligibility filters by subject",
    nextAvailableSlot([ev({ subject: "biology" })], { now: NOW, eligibility: { subject: "chemistry" } }) === null);
  t("§21 — and a viewer with no entitlement sees everything published",
    nextAvailableSlot([ev({ subject: "biology" })], { now: NOW }) !== null);

  // §46/§91 — the two models must not merge.
  t("⚠ §46 — group has its OWN function, not a shared 'next session'",
    /export function nextGroupSession/.test(SERVICE));
  t("§46 — and it never returns a 1-to-1 slot",
    nextGroupSession([ev()], { now: NOW }) === null);
  t("§46 — nor the reverse", nextAvailableSlot([ev({ type: "group" })], { now: NOW }) === null);
}

// ============================================================================
console.log("\n=== 2. ⚠ §79 — no fabricated availability, on THIS feature ===");
// ============================================================================
{
  /**
   * ⚠ THE GUARD FOLLOWS THE FEATURE, NOT A DIRECTORY. A sabotage run walked
   * past the §66 check this morning because it scanned the calendar folder
   * while the fabrication went into a hero component. Every surface that can
   * render a 1-to-1 time is listed here by name.
   */
  const SURFACES = [
    "src/lib/booking/next-available.ts",
    "src/components/home/HeroAvailability.tsx",
    "src/components/calendar/CalendarShortcuts.tsx",
    "src/app/tuition/one-to-one/page.tsx",
  ];
  const TIME = /["'>]\s*\d{1,2}[:.]\d{2}\s*(?:–|-|—)?\s*(?:\d{1,2}[:.]\d{2})?\s*(?:AM|PM|am|pm)?\s*["'<]/;
  const DATE = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/;
  for (const f of SURFACES) {
    const c = code(readFileSync(f, "utf8"));
    t(`⚠ §79 — ${f.split("/").pop()} hardcodes no clock time`, !TIME.test(c), c.match(TIME)?.[0]);
    t(`⚠ §79 — …and no example date`, !DATE.test(c), c.match(DATE)?.[0]);
  }
  t("⚠ §79 — no seed slot array ships in src/",
    !/(SEED|DEMO|SAMPLE|FAKE)_(SLOTS|AVAILABILITY)/i.test(SURFACES.map(f=>code(readFileSync(f,"utf8"))).join("")));
  t("§79 — availability comes from the reader, never a literal",
    /loadOpenSlots/.test(readFileSync("src/lib/calendar/readers.ts", "utf8")));
}

// ============================================================================
console.log("\n=== 3. §2/§4 — the parked migration says what it is ===");
// ============================================================================
{
  t("the parked file exists", MIGRATION.length > 0);
  t("⚠ it is named PROPOSED and states it is unapplied",
    /NOT APPLIED/.test(MIGRATION) && /UNVERIFIED/.test(MIGRATION));
  t("§28 — it carries the transactional RPC",
    /CREATE OR REPLACE FUNCTION public\.book_slot_with_credit/.test(MIGRATION));
  t("⚠ §28 — booking and debit are in ONE function body",
    /INSERT INTO public\.private_bookings[\s\S]*INSERT INTO public\.lesson_credit_transactions/.test(MIGRATION));
  t("⚠ the student comes from auth.uid(), never an argument",
    /v_user\s+uuid\s*:=\s*auth\.uid\(\)/.test(MIGRATION)
      && !/p_user_id|p_student_id/.test(MIGRATION_C));
  t("§66 — it refuses a slot that has already started, by server clock",
    /p_starts_at <= now\(\)/.test(MIGRATION));
  t("§27 — the balance is summed from the ledger, not read from a column",
    /SUM\(delta\)/.test(MIGRATION_C) && !/remaining_credits/.test(MIGRATION_C));
  t("search_path is pinned", /SET search_path = public, pg_temp/.test(MIGRATION));
  t("execute is granted to authenticated only",
    /GRANT EXECUTE[\s\S]{0,120}TO authenticated/.test(MIGRATION) && /REVOKE ALL ON FUNCTION/.test(MIGRATION));

  // ⚠ §29 IS ALREADY APPLIED — the parked file must not redeclare it.
  const M0046 = readFileSync("supabase/migrations/0046_private_bookings.sql", "utf8");
  t("§29 — the overlap constraint exists and is APPLIED in 0046",
    /private_bookings_no_overlap/.test(M0046) && /EXCLUDE USING gist/.test(M0046));
  t("⚠ §29 — and the parked file does NOT redefine it",
    !/ADD CONSTRAINT private_bookings_no_overlap/.test(MIGRATION_C));

  // erase_user coupling — nothing new is owed, and the file says why.
  // ⚠ NO _PROPOSED_ PREFIX — v5 is applied and live, which is what makes the
  // parked file's claim (its tables are already erased) true rather than hopeful.
  const V5 = readFileSync("supabase/migrations/0067_erase_user_v5.sql", "utf8");
  t("the RPC's tables are already erased by v5",
    /private_bookings/.test(V5) && /lesson_credit_transactions/.test(V5));
  t("⚠ and the parked file states that rather than duplicating the deletes",
    /ERASE_USER COUPLING/.test(MIGRATION) && !/DELETE FROM public\.private_bookings/.test(MIGRATION_C));
  t("§1 — no new table is created", !/CREATE TABLE/.test(MIGRATION_C));
}

// ============================================================================
console.log("\n=== 4. §3 — Stripe seams are unwired, and named as such ===");
// ============================================================================
{
  const c = code(ACTIONS);
  t("§3 — no second checkout was written",
    !existsSync("src/lib/booking/checkout.ts") && !/stripe\.checkout\.sessions\.create/.test(c));
  t("⚠ §3 — no webhook grant is simulated",
    !/grantCredits\(|fakeWebhook|simulateWebhook/.test(c));
  t("⚠ §3 — no credit balance is fabricated in the client",
    !/creditBalance\s*=\s*\d/.test(c));
  t("§39 — idempotency exists for when a webhook does arrive",
    /alreadyProcessed/.test(readFileSync("src/lib/booking/credits.ts", "utf8")));
  t("§41 — credit-holder booking needs no checkout and exists today",
    /export async function bookWithCredit/.test(ACTIONS));
  t("§10/§40 — the pay-as-you-go hold architecture exists",
    existsSync("src/lib/booking/holds.ts"));
}

// ============================================================================
console.log("\n=== 5. §10/§35/§67/§68 — policies stay unpopulated ===");
// ============================================================================
{
  const CONFIG = readFileSync("src/lib/booking/config.ts", "utf8");
  t("§35 — CHECKOUT_BUILT is still false", /CHECKOUT_BUILT = false/.test(CONFIG));
  // ⚠ NO INVENTED NUMBERS. A cancellation window or expiry with a value nobody
  // approved is a policy promise made by a developer.
  for (const re of [/cancellationHours\s*[:=]\s*\d/, /expiryMonths\s*[:=]\s*\d/,
                    /bookingCutoffHours\s*[:=]\s*\d/, /maxHorizonDays\s*[:=]\s*\d/]) {
    t(`⚠ no invented policy value: ${re.source}`, !re.test(code(CONFIG)));
  }
}

// ============================================================================
console.log("\n=== 6. §78 — nothing that worked was broken ===");
// ============================================================================
{
  function routes(dir: string, prefix: string[] = []): string[][] {
    const out: string[][] = [];
    for (const e of readdirSync(dir)) {
      const full = join(dir, e);
      if (!statSync(full).isDirectory() || e.startsWith("_")) continue;
      const next = e.startsWith("(") && e.endsWith(")") ? prefix : [...prefix, e];
      if (readdirSync(full).some((f) => /^page\.(tsx|ts|jsx|js)$/.test(f))) out.push(next);
      out.push(...routes(full, next));
    }
    return out;
  }
  const ROUTES = routes(APP);
  const has = (p: string) => {
    const want = p.split("/").filter(Boolean);
    return ROUTES.some((r) => r.length === want.length && r.every((s, i) => s.startsWith("[") || s === want[i]));
  };
  for (const p of ["/calendar", "/tuition", "/tuition/one-to-one", "/tuition/interest",
                   "/tuition/[cohort]/roadmap", "/admin/availability", "/profile", "/"]) {
    t(`§78 — ${p} still resolves`, p === "/" ? existsSync(join(APP, "page.tsx")) : has(p));
  }
  t("§78 — no URL moved, so nothing was owed a redirect",
    !/redirect\(|permanentRedirect/.test(code(readFileSync("src/app/calendar/page.tsx", "utf8"))));
}

// ============================================================================
console.log("\n=== 7. ⏳ WHAT THIS SUITE CANNOT PROVE ===");
// ============================================================================
{
  /**
   * ⚠ EACH OF THESE NEEDS THE MIGRATION APPLIED. Asserting them from the file
   * text would be asserting that SQL was TYPED, not that a database behaves —
   * exactly the false green this codebase has removed elsewhere.
   */
  todo("§28 atomicity: booking and debit succeed or fail together",
    "Needs the RPC applied. Force the booking insert to fail after the balance " +
    "check and confirm SUM(delta) is unchanged. Verification step 1 in the file.");
  todo("§29 double-booking race under real concurrency",
    "The EXCLUDE constraint IS applied (0046) and its header records 23P01 " +
    "verified. What is unproven is the RPC rolling the credit back on 23P01. " +
    "Verification step 2.");
  todo("§54/§55 RLS: a student cannot mutate their own balance",
    "Needs a real authenticated session. From the SQL editor auth.uid() is " +
    "NULL, so a refusal there proves nothing — see AGENTS.md on is_staff().");
  todo("§55 a booked slot is publicly indistinguishable from unavailable",
    "loadOpenSlots subtracts bookings before events are built, so this holds " +
    "in code today; proving it end to end needs a booking to exist.");
  todo("§88 webhook retry grants 5 credits, not 10",
    "Blocked on Stripe entirely — no keys in any environment. alreadyProcessed() " +
    "exists and is unit-tested; the delivery path it guards does not run.");
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed, ${pending} pending`);
process.exit(fail === 0 ? 0 : 1);
