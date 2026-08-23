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
/**
 * ⚠ READ BY ITS REAL NUMBER, AND AN EMPTY READ IS NOW FATAL.
 *
 * This was `existsSync(PROPOSED_…) ? readFileSync(…) : ""`. When the file was
 * renamed to 0068 the fallback did what fallbacks do: MIGRATION became "", ten
 * assertions went red — AND TWO WENT GREEN. `!/CREATE TABLE/` and
 * `!/ADD CONSTRAINT private_bookings_no_overlap/` are both satisfied by the
 * empty string, so the rename would have "proved" that no table is created by
 * reading no file at all. That was demonstrated, not reasoned about.
 *
 * There is no fallback now: a missing migration stops the suite before any
 * assertion runs. The two negatives below are also anchored to a positive so
 * they cannot pass on absent input again.
 */
const MIGRATION_PATH = "supabase/migrations/0068_tuition_booking.sql";
if (!existsSync(MIGRATION_PATH)) {
  console.error(
    `  ✗ FATAL — ${MIGRATION_PATH} is missing.\n` +
    "      This suite's subject is that file. Passing without it is not an\n" +
    "      option; a green run here would be a green run against nothing.",
  );
  process.exit(1);
}
const MIGRATION = readFileSync(MIGRATION_PATH, "utf8");
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
console.log("\n=== 3. §2/§4 — the APPLIED migration says what it is ===");
// ============================================================================
{
  t("0068 — the migration carries its allocated number, not a PROPOSED prefix",
    /\/0068_tuition_booking\.sql$/.test(MIGRATION_PATH) && MIGRATION.length > 0);
  t("⚠ and no PROPOSED_tuition_booking.sql is left behind to be replayed twice",
    !existsSync("supabase/migrations/PROPOSED_tuition_booking.sql"));
  /**
   * ⚠ THIS IS A DOCUMENTATION-CONSISTENCY CHECK, NOT A CLAIM ABOUT THE
   * DATABASE. Matching the string "APPLIED" proves a person typed it. What it
   * genuinely enforces is that the FILENAME and the HEADER cannot disagree:
   * a file carrying a plain number must not read as parked. The negative is
   * anchored to the path, which cannot lie about itself, rather than to the
   * prose — `!/NOT APPLIED/` would have reddened on any future honest sentence
   * containing those two words.
   */
  t("⚠ the header does not contradict the filename",
    /⚠ APPLIED 20\d\d-\d\d-\d\d/.test(MIGRATION) && !/_PROPOSED_/.test(MIGRATION_PATH));
  /**
   * ⚠ THE HONESTY ASSERTION, AND THE POINT OF THIS WHOLE SECTION.
   * A header that says APPLIED must not be readable as "and therefore
   * verified". 0035 set the precedent: it records which checks were SKIPPED
   * and why. 0068 ran two of its six steps, so it must say two, and it must
   * name the four it did not run. If someone later quietly upgrades the header
   * to claim all six, this goes red.
   */
  t("⚠ it says how many steps actually ran, and names the ones that did not",
    /TWO OF SEVEN STEPS RAN/.test(MIGRATION) && /NOT RUN/.test(MIGRATION));
  /**
   * ⚠ THE DEFECT STAYS ON THE RECORD. The applied function raises on every
   * call — FOR UPDATE on an aggregate, and an ambiguous booking_ref — both
   * reproduced by execution. A later reader must not find a tidy header that
   * has quietly dropped it, so the two error strings are pinned here.
   */
  t("⚠ it records that the applied function does not work",
    /DOES NOT WORK/.test(MIGRATION)
      && /FOR UPDATE is not allowed with aggregate functions/.test(MIGRATION)
      && /column reference "booking_ref" is ambiguous/.test(MIGRATION));
  t("⚠ and it says the body is left exactly as applied, defects included",
    /LEFT EXACTLY AS APPLIED/.test(MIGRATION));
  t("⚠ and it does not claim the atomicity guarantee it cannot demonstrate",
    /§28 ATOMICITY IS NOT PROVEN/.test(MIGRATION));
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
  // ⚠ ANCHORED. The bare negative passed against an empty file; the positive
  // conjunct means an absent or truncated migration can no longer satisfy it.
  t("⚠ §29 — and 0068 names the constraint without redefining it",
    /private_bookings_no_overlap/.test(MIGRATION)
      && !/ADD CONSTRAINT private_bookings_no_overlap|EXCLUDE USING gist/.test(MIGRATION_C));

  // erase_user coupling — nothing new is owed, and the file says why.
  // ⚠ NO _PROPOSED_ PREFIX — v5 is applied and live, which is what makes the
  // parked file's claim (its tables are already erased) true rather than hopeful.
  const V5 = readFileSync("supabase/migrations/0067_erase_user_v5.sql", "utf8");
  t("the RPC's tables are already erased by v5",
    /private_bookings/.test(V5) && /lesson_credit_transactions/.test(V5));
  t("⚠ and the parked file states that rather than duplicating the deletes",
    /ERASE_USER COUPLING/.test(MIGRATION) && !/DELETE FROM public\.private_bookings/.test(MIGRATION_C));
  // ⚠ ANCHORED, for the same reason: the empty string creates no table either.
  t("§1 — no new table is created",
    /CREATE OR REPLACE FUNCTION/.test(MIGRATION_C) && !/CREATE TABLE/.test(MIGRATION_C));
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
console.log("\n=== 7. ⏳ WHAT THIS SUITE STILL CANNOT PROVE ===");
// ============================================================================
{
  /**
   * ⚠ THE MIGRATION IS APPLIED, AND THAT SETTLED FEWER OF THESE THAN IT LOOKS.
   *
   * "Needs the RPC applied" was the reason for three of the five. 0068 is live,
   * so that reason is gone — and the honest replacement is NOT a pass. Two
   * things still stand between these and green, and neither is fixed by SQL
   * having been run:
   *
   *   1. This suite is a bare-node program: no network, no database, no
   *      session. It reads files and imports pure modules. How a database
   *      behaves under concurrent writes cannot be asserted from here at all.
   *   2. auth.uid() is NULL for the postgres role, so the SQL Editor cannot
   *      settle them either — it answers 28000 'not signed in' whatever the
   *      function does. AGENTS.md records the same trap for is_staff().
   *
   * What WAS settled against production, with the public anon key: the live
   * function has no user_id parameter, and anon cannot execute it (42501).
   * Both are recorded in 0068's header. Neither belongs in this file — the
   * suite has no network, and re-asserting them from the migration TEXT would
   * be asserting that SQL was typed, which is the false green this whole
   * section exists to refuse.
   */

  // ── newly assertable, and it is a warning rather than a reassurance ───────
  /**
   * ⚠ §28 IS NOT MERELY UNPROVEN — IT IS NOT IN EFFECT.
   * Nothing calls book_slot_with_credit. bookWithCredit() still runs
   * insert → insert → compensate(). Exactly one of those two paths may be
   * live: wire the RPC and leave the saga in place and a single booking spends
   * two credits. That is a real invariant, it executes offline, and it goes
   * red the day someone wires the RPC without removing the saga.
   */
  /**
   * ⚠ THE WHOLE OF src/, NOT actions.ts. The first version of this scanned one
   * file, and that was a false green of its own making: this repo already
   * calls .rpc() from capacity.ts, enrolment.ts and attempts.ts, so "it will be
   * wired in actions.ts" is an assumption the repo's own history contradicts.
   * A route handler calling the RPC while the saga survived would have printed
   * a checkmark over a booking that spends two credits.
   *
   * ⚠ AND code(), NOT RAW TEXT. Eighth time this trap has been laid here: a
   * COMMENT reading `.rpc("book_slot_with_credit")` — such as the one in this
   * very docstring — must not flip it.
   */
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
    });
  const RPC_CALLERS = walk("src").filter((p) =>
    /\.rpc\(\s*["'`]book_slot_with_credit/.test(code(readFileSync(p, "utf8"))));
  const WIRED = RPC_CALLERS.length > 0;
  const SAGA = /async function compensate\(/.test(code(ACTIONS));
  /**
   * ⚠ ASSERT WHAT THE NAME SAYS. This was `WIRED ? !SAGA : SAGA`, which also
   * went red when BOTH were absent — a rename of compensate() would have
   * reported a defect that did not exist. The invariant that matters is that
   * the two are never live together.
   */
  t("⚠ §28 — the RPC and the compensating saga are never both live",
    !(WIRED && SAGA), `wired=[${RPC_CALLERS.join(", ")}] saga=${SAGA}`);
  t("§28 — and some credit-spending path exists at all",
    WIRED || SAGA, "neither an RPC call nor compensate() found in src/");
  t("⚠ §28 — and 0068 records that the saga, not the RPC, is the live path",
    /NOT IN EFFECT/.test(MIGRATION) && /NOTHING CALLS THIS FUNCTION/.test(MIGRATION));

  // ── §55, the code-level half, which DOES execute here ────────────────────
  /**
   * The end-to-end proof needs a booking to exist. The code-level fact does
   * not: the select list is read out of readers.ts and checked for identity
   * columns, rather than a hand-copied string being compared to itself. A
   * booked slot is subtracted server-side and is therefore ABSENT from a
   * public read — not flagged, not redacted — which is what "indistinguishable
   * from unavailable" has to mean.
   */
  const READERS = code(readFileSync("src/lib/booking/readers.ts", "utf8"));
  /**
   * ⚠ matchAll AND A COUNT, not .match(). Without /g, .match returns the FIRST
   * hit — so an admin-mode select added above this one would silently become
   * the subject of the assertion. Exactly one is the invariant.
   *
   * ⚠ AND IT IS NOT AN ANON READ. loadOpenSlots runs on the service-role
   * client and subtracts server-side; readers.ts:17 records rejecting the
   * anon-column-grant shape deliberately. The safety comes from the select
   * list and from only Slot objects leaving the function — not from RLS, which
   * this assertion does not test and must not be read as testing.
   */
  const PBS = [...READERS.matchAll(/from\("private_bookings"\)\s*\.select\("([^"]*)"\)/g)];
  t("§55 — the server-side slot read pulls no identity column from private_bookings",
    PBS.length === 1 && !/user_id|email|name|ref/.test(PBS[0][1]),
    PBS.length === 1 ? `select("${PBS[0][1]}")` : `${PBS.length} private_bookings selects found`);

  todo("§28 atomicity: booking and debit succeed or fail together",
    "0068 is APPLIED and this got WORSE, not better. The applied function " +
    "raises on entry — FOR UPDATE on an aggregate — so it cannot be atomic " +
    "about anything; and nothing calls it in any case. Repairing it needs a " +
    "DROP FUNCTION in a new numbered migration. Step 0 in 0068's footer.");
  todo("§29 double-booking race under real concurrency",
    "The EXCLUDE constraint IS applied (0046) and its header records 23P01 " +
    "verified. Two things remain unproven and one is now disproven: the RPC " +
    "cannot roll a credit back because it never reaches the INSERT, and its " +
    "FOR UPDATE would not have serialised a concurrent spend even if it " +
    "parsed — two callers, one credit, produced a balance of -1 on a replica. " +
    "The live path is still the saga. Step 2 in 0068's footer.");
  todo("§54/§55 RLS: a student cannot mutate their own balance",
    "Needs a real authenticated session. anon is refused at the FUNCTION " +
    "boundary — 42501, verified live — but that says nothing about table-level " +
    "RLS for a signed-in student, which is what this claims. From the SQL " +
    "Editor auth.uid() is NULL, so a refusal there proves nothing.");
  todo("§55 end to end: a booked slot is absent from a logged-out read",
    "The code-level half executes above. End to end still needs a booking to " +
    "exist and a logged-out fetch that demonstrably does not see it.");
  todo("§88 webhook retry grants 5 credits, not 10",
    "Unchanged by 0068 and blocked on Stripe entirely — no keys in any " +
    "environment. alreadyProcessed() exists and is unit-tested; the delivery " +
    "path it guards does not run.");
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed, ${pending} pending`);
process.exit(fail === 0 ? 0 : 1);
