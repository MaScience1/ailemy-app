/**
 * Live verification for 0051–0055, run against production.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/booking-schema-0051-0055.ts
 *
 * ============================================================================
 * ⚠ THE OWNER'S CHECK, RUN WITH THE OWNER WATCHING. Same standing as
 * public-surface-sabotage.ts: production credentials on purpose, named targets,
 * not importable, not in `npm test`, never handed to a subagent.
 *
 * ============================================================================
 * ⚠ WHAT THIS FILE DELIBERATELY DOES NOT DO
 * ============================================================================
 * It creates NO auth.users row and it never calls erase_user() on a real
 * identity. Every 0055 probe block needs a person to erase, and creating and
 * deleting real identities in production is not something to start on my own
 * initiative — 0048 and 0049 both left probe users behind that could not be
 * removed, which is the history this restraint comes from. Those blocks are
 * handed over as founder pastes instead.
 *
 * There is also no psql and no DATABASE_URL on this machine, so PostgREST is
 * the only route. That rules out SET ROLE, information_schema, pg_catalog, DDL
 * and BEGIN/ROLLBACK — every block needing one of those is named in the summary
 * rather than silently skipped.
 *
 * ⚠ WHAT IT DOES INSTEAD OF `SET ROLE anon` IS BETTER, NOT WORSE. An
 * anon-keyed PostgREST client IS the anon role, over the same wire a visitor
 * uses. SET ROLE in the SQL editor tests the grant; this tests the path.
 *
 * ⚠ EVERY ROW IT CREATES IS DELETED BY THE ID CAPTURED AT CREATION. No sweep,
 * no delete-by-filter. It touches public.cohorts, which carries the live
 * commercial facts, so every value it changes there is captured first and
 * restored, and block 0054(a) re-reads the prices at the end to prove it.
 *
 * ============================================================================
 * ⚠⚠ NEVER PIPE THIS SCRIPT THROUGH `head`, `grep -m` OR ANYTHING THAT CLOSES
 * THE PIPE EARLY. REDIRECT TO A FILE AND READ THE FILE.
 * ============================================================================
 * That is not style advice. The first run of this file was piped through
 * `head -90`; head exited at line 90, node took SIGPIPE, and the process died
 * BEFORE its cleanup ran — leaving two probe bookings, two cancellation
 * requests and an event in production. Worse than untidy: private_bookings
 * .teacher_id is ON DELETE RESTRICT and 0055 refuses to erase anyone who is
 * the teacher on a booking, so a stranded probe row makes a real person
 * permanently un-erasable. They were found and removed by captured id.
 *
 * Two defences now, because "remember not to pipe it" is not one:
 *   · cleanup runs in a `finally`, so it survives a throw or an early return;
 *   · probe times are unique per run, so a leftover cannot collide with the
 *     next run's insert via 0046's exclusion constraint and silently skip
 *     every downstream block — which is exactly what run 2 did.
 */
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (!existsSync(".env.local")) {
  console.error("REFUSED — .env.local not found. This script talks to the live database.");
  process.exit(2);
}

const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t_ = line.trim();
  if (!t_ || t_.startsWith("#")) continue;
  const i = t_.indexOf("=");
  if (i < 0) continue;
  let v = t_.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env.set(t_.slice(0, i).trim(), v);
}

const URL_ = env.get("NEXT_PUBLIC_SUPABASE_URL");
const ANON = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE = env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!URL_ || !ANON || !SERVICE) {
  console.error("REFUSED — need URL, anon key and service-role key.");
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon: SupabaseClient = createClient(URL_, ANON, opts);
const svc: SupabaseClient = createClient(URL_, SERVICE, opts);

let pass = 0, fail = 0;
const skipped: string[] = [];
const t = (name: string, cond: boolean, observed: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${name}\n      observed: ${fmt(observed)}`); }
  else { fail++; console.log(`  ✗ ${name}\n      observed: ${fmt(observed)}`); }
};
const skip = (name: string, why: string) => {
  skipped.push(`${name} — ${why}`);
  console.log(`  ⊘ ${name}\n      NOT RUN: ${why}`);
};
const fmt = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
const err = (e: { code?: string; message?: string } | null) =>
  e ? `${e.code ?? "?"}: ${(e.message ?? "").slice(0, 160)}` : "no error";

const created = { bookings: [] as string[], cancels: [] as string[], events: [] as string[] };
let cohortBackup: { slug: string; year_group: string | null }[] = [];

/**
 * ⚠ UNIQUE PER RUN. A fixed probe time collides with a leftover from a previous
 * run through 0046's exclusion constraint, the INSERT fails, and every block
 * that needs a booking is skipped — reporting "not run" for a reason that is
 * really "the last run leaked".
 */
/**
 * ⚠ THE LOCKED COMMERCIAL FACTS, AT MODULE SCOPE SO CLEANUP CAN RE-CHECK THEM.
 * This script UPDATEs public.cohorts, so "the prices survived" has to be
 * asserted AFTER the restore, not only before it. Keeping this list inside
 * main() put it out of scope for the post-cleanup re-read and threw there —
 * the check that mattered most was the one that could not run.
 */
const EXPECTED = [
  { slug: "ial-chemistry-as-sep-2026", price_pence: 16900, price_qar: 800, status: "interest", seat_cap: 20 },
  { slug: "igcse-chemistry-y11", price_pence: 14900, price_qar: 700, status: "interest", seat_cap: 20 },
  { slug: "igcse-chemistry-y10", price_pence: 13900, price_qar: 650, status: "interest", seat_cap: 20 },
];

const RUN = Date.now();
const probeStart = (n: number) => new Date(RUN + (400 + n) * 86_400_000);

async function main() {
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 0051 · booking_ref ═══════════════════════════════════════");

  // (a) every existing booking has a reference
  const allRefs = await svc.from("private_bookings").select("id,booking_ref,payment_ref");
  const rows = (allRefs.data ?? []) as { id: string; booking_ref: string | null }[];
  t("(a) bookings with a NULL booking_ref",
    allRefs.error === null && rows.every((r) => r.booking_ref !== null),
    allRefs.error ? err(allRefs.error) : `${rows.filter((r) => r.booking_ref === null).length} NULL of ${rows.length} row(s)`);

  // A teacher to hang probe bookings from. READ ONLY — no account is created.
  const users = await svc.auth.admin.listUsers({ page: 1, perPage: 50 });
  const teacherId = users.data?.users?.[0]?.id ?? null;
  if (!teacherId) {
    skip("(b)(b2)(c)(d) 0051 write probes", "no auth user exists to use as teacher_id; nothing is created to make one");
  } else {
    // (b2) ⚠ AS service_role — the DEFAULT firing under the role that actually
    // creates bookings. This client IS service_role; (b) and (b2) are the same
    // statement here, which is why they are reported together.
    const mk = async (tag: string, n: number) => {
      const s0 = probeStart(n);
      const e0 = new Date(s0.getTime() + 3_600_000);
      return svc.from("private_bookings").insert({
        teacher_id: teacherId, email: `probe-0051-${tag}-${RUN}@example.test`,
        starts_at: s0.toISOString(), ends_at: e0.toISOString(),
        paid_with: "single", payment_ref: `pi_probe_${tag}_${RUN}`,
      }).select("id,booking_ref").single();
    };

    const one = await mk("a", 0);
    if (one.error) {
      t("(b)+(b2) service_role INSERT receives a booking_ref", false, err(one.error));
    } else {
      const row = one.data as { id: string; booking_ref: string };
      created.bookings.push(row.id);
      t("(b)+(b2) service_role INSERT receives a booking_ref from the DEFAULT",
        typeof row.booking_ref === "string" && row.booking_ref.startsWith("AIL-"),
        row.booking_ref);
      t("(c) shape AIL- + 8 chars from the unambiguous alphabet",
        /^AIL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(row.booking_ref),
        `${row.booking_ref} (len ${row.booking_ref.length})`);
    }

    const two = await mk("b", 1);
    if (!two.error) created.bookings.push((two.data as { id: string }).id);

    // (c) across EVERY row, not just the probe
    const after = await svc.from("private_bookings").select("booking_ref");
    const refs = ((after.data ?? []) as { booking_ref: string }[]).map((r) => r.booking_ref);
    t("(c) every booking_ref in the table matches the alphabet",
      refs.length > 0 && refs.every((r) => /^AIL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(r)),
      `${refs.length} row(s), ${refs.filter((r) => !/^AIL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(r)).length} malformed`);
    t("(d-read) no duplicate references exist",
      refs.length === new Set(refs).size,
      `${refs.length} rows, ${new Set(refs).size} distinct`);

    // (d) ⚠ NEEDS TWO ROWS TO MEAN ANYTHING — with one booking the UPDATE
    // silently does nothing and looks like a pass.
    if (created.bookings.length >= 2 && refs.length >= 2) {
      const target = created.bookings[0];
      const other = ((after.data ?? []) as { booking_ref: string }[]).find(
        (r) => r.booking_ref !== rows.find((x) => x.id === target)?.booking_ref,
      );
      const dup = await svc.from("private_bookings")
        .update({ booking_ref: refs.find((r) => r !== null) })
        .eq("id", created.bookings[1]).select("id");
      t("(d) a duplicate booking_ref is refused by the unique index",
        dup.error !== null && dup.error.code === "23505",
        dup.error ? err(dup.error) : `NO ERROR — duplicate accepted (other=${other?.booking_ref})`);
    } else {
      skip("(d) duplicate refused", "fewer than two bookings exist; the UPDATE would be a silent no-op and a false pass");
    }
  }

  // (e) anon cannot read the table at all. ⚠ AN EMPTY RESULT WOULD BE A FAILURE.
  {
    const { data, error } = await anon.from("private_bookings").select("booking_ref").limit(1);
    t("(e) anon SELECT on private_bookings is REFUSED (0 rows would be a failure)",
      error !== null && error.code === "42501",
      error ? err(error) : `NO ERROR — ${(data ?? []).length} row(s); a SELECT grant exists`);
  }

  // (f) anon cannot call the generator
  {
    const { error } = await anon.rpc("generate_booking_ref");
    t("(f) anon cannot EXECUTE generate_booking_ref",
      error !== null,
      error ? err(error) : "NO ERROR — anon called the generator");
  }
  // …and the positive half: service_role CAN, which is what the DEFAULT needs.
  {
    const { data, error } = await svc.rpc("generate_booking_ref");
    t("(f-positive) service_role CAN call it — the grant added in §3",
      error === null && typeof data === "string" && String(data).startsWith("AIL-"),
      error ? err(error) : String(data));
  }

  skip("(h) 0051 three-privileges check", "information_schema is not exposed through PostgREST and there is no psql — founder paste below");

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 0052 · cancellation_requests ═════════════════════════════");

  const bookingForCancel = created.bookings[0] ?? null;
  if (!bookingForCancel) {
    skip("(a)(b)(c) 0052 constraint probes", "no probe booking to reference (booking_id is NOT NULL)");
  } else {
    // (a) a resolved request must carry an outcome
    {
      const { error } = await svc.from("cancellation_requests").insert({
        booking_id: bookingForCancel, requested_by_email: "probe-0052@example.test",
        status: "resolved",
      });
      t("(a) resolved with no outcome is refused",
        error !== null && error.code === "23514",
        error ? err(error) : "NO ERROR — a resolved request with no outcome was accepted");
    }
    // …and the positive half
    {
      const { data, error } = await svc.from("cancellation_requests").insert({
        booking_id: bookingForCancel, requested_by_email: "probe-0052@example.test",
        status: "resolved", resolution: "refunded", resolved_at: new Date().toISOString(),
      }).select("id").single();
      if (!error) created.cancels.push((data as { id: string }).id);
      t("(a-positive) …with resolution + resolved_at it inserts",
        error === null, error ? err(error) : "inserted");
    }
    // (b) one OPEN request per booking
    {
      const first = await svc.from("cancellation_requests").insert({
        booking_id: bookingForCancel, requested_by_email: "probe-0052@example.test",
      }).select("id").single();
      if (!first.error) created.cancels.push((first.data as { id: string }).id);
      t("(b-setup) an open request inserts", first.error === null, first.error ? err(first.error) : "inserted");

      const second = await svc.from("cancellation_requests").insert({
        booking_id: bookingForCancel, requested_by_email: "probe-0052b@example.test",
      }).select("id").single();
      if (!second.error) created.cancels.push((second.data as { id: string }).id);
      t("(b) a SECOND open request for the same booking is refused",
        second.error !== null && second.error.code === "23505",
        second.error ? err(second.error) : "NO ERROR — two open requests for one lesson");
      // ⚠ THE OTHER HALF: the index is PARTIAL, so a resolved one does not block.
      t("(b-partial) the earlier RESOLVED row did not block it — the index is partial, not table-wide",
        created.cancels.length >= 2, `${created.cancels.length} probe row(s) created`);
    }
    // (c) an off-list resolution
    {
      const { error } = await svc.from("cancellation_requests").insert({
        booking_id: bookingForCancel, requested_by_email: "probe-0052c@example.test",
        status: "resolved", resolution: "vibes", resolved_at: new Date().toISOString(),
      });
      t("(c) resolution='vibes' is refused",
        error !== null && error.code === "23514",
        error ? err(error) : "NO ERROR — an off-list resolution was accepted");
    }
  }

  // (d) anon refused OUTRIGHT
  {
    const { data, error } = await anon.from("cancellation_requests").select("id").limit(1);
    t("(d) anon SELECT is REFUSED (a 0 would be a failure — it would mean a grant exists)",
      error !== null && error.code === "42501",
      error ? err(error) : `NO ERROR — ${(data ?? []).length} row(s)`);
  }
  {
    const { error } = await anon.from("cancellation_requests").insert({
      booking_id: "00000000-0000-0000-0000-000000000000", requested_by_email: "probe@example.test",
    });
    t("(d2) anon INSERT is refused", error !== null, error ? err(error) : "NO ERROR — anon inserted");
  }

  skip("(e)(f)(f2)(f3)(g) 0052 student-session blocks",
    "need a real authenticated student session; service_role BYPASSRLS so it cannot exercise a policy or a column grant — founder paste below");
  skip("(i) 0052 three-privileges check", "information_schema not reachable — founder paste below");

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 0053 · notification ledger ═══════════════════════════════");

  // ⚠ NO auth USER NEEDED. notification_events accepts an email-only row by
  // design, which is exactly what makes these four constraints testable here.
  const key = `probe:0051-55:${new Date().toISOString()}`;
  {
    const first = await svc.from("notification_events").insert({
      email: "probe-0053@example.test", kind: "announcement", idempotency_key: key,
    }).select("id").single();
    if (!first.error) created.events.push((first.data as { id: string }).id);
    t("(a-setup) an event inserts", first.error === null, first.error ? err(first.error) : "inserted");

    const dup = await svc.from("notification_events").insert({
      email: "probe-0053@example.test", kind: "announcement", idempotency_key: key,
    }).select("id").single();
    if (!dup.error) created.events.push((dup.data as { id: string }).id);
    t("(a) ⚠ THE IDEMPOTENCY KEY — the identical key is refused",
      dup.error !== null && dup.error.code === "23505",
      dup.error ? err(dup.error) : "NO ERROR — a retried action would email twice");
  }

  const eventId = created.events[0] ?? null;
  if (!eventId) {
    skip("(b)(d) delivery constraints", "no probe event to attach deliveries to");
  } else {
    // (b) one delivery per channel per event — and the other half, three channels
    const d1 = await svc.from("notification_deliveries").insert({ event_id: eventId, channel: "email" }).select("id").single();
    t("(b-setup) an email delivery inserts", d1.error === null, d1.error ? err(d1.error) : "inserted");
    const d2 = await svc.from("notification_deliveries").insert({ event_id: eventId, channel: "email" }).select("id").single();
    t("(b) a SECOND email delivery for the same event is refused",
      d2.error !== null && d2.error.code === "23505",
      d2.error ? err(d2.error) : "NO ERROR — one event could send two emails");
    const d3 = await svc.from("notification_deliveries").insert({ event_id: eventId, channel: "in_app" }).select("id").single();
    const d4 = await svc.from("notification_deliveries").insert({ event_id: eventId, channel: "push" }).select("id").single();
    t("(b-other-half) in_app AND push for the SAME event both insert — three channels, one fact",
      d3.error === null && d4.error === null,
      `in_app: ${d3.error ? err(d3.error) : "ok"} · push: ${d4.error ? err(d4.error) : "ok"}`);

    // (d) a 'sent' delivery must carry sent_at
    const d5 = await svc.from("notification_deliveries")
      .update({ status: "sent" }).eq("event_id", eventId).eq("channel", "in_app").select("id");
    t("(d) status='sent' with no sent_at is refused",
      d5.error !== null && d5.error.code === "23514",
      d5.error ? err(d5.error) : "NO ERROR — 'did we tell them?' would be unanswerable");
  }

  // (c) a row addressed to nobody
  {
    const { error } = await svc.from("notification_events").insert({
      kind: "announcement", idempotency_key: `${key}:nobody`,
    });
    t("(c) an event with neither user_id nor email is refused",
      error !== null && error.code === "23514",
      error ? err(error) : "NO ERROR — an unsendable row was accepted");
  }

  // (e) anon refused outright on all three
  for (const tbl of ["notification_events", "notification_deliveries", "push_tokens"]) {
    const { data, error } = await anon.from(tbl).select("id").limit(1);
    t(`(e) anon SELECT on ${tbl} is REFUSED (0 rows would be a failure)`,
      error !== null && error.code === "42501",
      error ? err(error) : `NO ERROR — ${(data ?? []).length} row(s)`);
  }
  // (h) no INSERT for any client
  {
    const { error } = await anon.from("notification_events").insert({
      email: "probe@example.test", kind: "announcement", idempotency_key: `${key}:anon`,
    });
    t("(h) anon cannot INSERT an event — no grant at all",
      error !== null, error ? err(error) : "NO ERROR — anon forged a notification");
  }

  skip("(f)(g)(i) 0053 student-session blocks",
    "need an authenticated student session to exercise read-own, the in_app read_at column grant and push_tokens own-row — founder paste below");
  skip("(k)(l) 0053 privilege checks", "information_schema not reachable — founder paste below");

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 0054 · cohorts.year_group ════════════════════════════════");

  // (a) ⚠ RUN FIRST. The live commercial facts must be untouched.
  const facts = await svc.from("cohorts")
    .select("slug,price_pence,price_qar,status,is_public,seat_cap,qualification,year_group,display_order")
    .eq("is_public", true).order("display_order");
  const pub = (facts.data ?? []) as Record<string, unknown>[];
  cohortBackup = ((await svc.from("cohorts").select("slug,year_group")).data ?? []) as typeof cohortBackup;

  t("(a) THE LIVE COMMERCIAL FACTS ARE UNCHANGED",
    facts.error === null && pub.length === EXPECTED.length &&
    EXPECTED.every((e) => {
      const r = pub.find((x) => x.slug === e.slug);
      return r && r.price_pence === e.price_pence && r.price_qar === e.price_qar &&
        r.status === e.status && r.seat_cap === e.seat_cap && r.is_public === true;
    }),
    facts.error ? err(facts.error) : pub.map((r) => `${r.slug} ${r.price_pence} ${r.price_qar} ${r.status} cap${r.seat_cap}`).join(" | "));

  // (b) the backfill landed and the AS cohort is correctly NULL
  {
    const all = ((await svc.from("cohorts").select("slug,qualification,year_group")).data ?? []) as Record<string, unknown>[];
    const y11 = all.filter((r) => r.qualification === "gcse-y11");
    const y10 = all.filter((r) => r.qualification === "gcse-y10");
    const as_ = all.filter((r) => r.qualification === "ial-as");
    t("(b) gcse-y11 → Year 11, gcse-y10 → Year 10, ial-as → NULL",
      y11.every((r) => r.year_group === "Year 11") && y10.every((r) => r.year_group === "Year 10") &&
      as_.every((r) => r.year_group === null),
      all.map((r) => `${r.qualification ?? "(null)"}→${r.year_group ?? "NULL"}`).join(" | "));
    t("(b2) no gcse-% row was missed",
      all.filter((r) => String(r.qualification ?? "").startsWith("gcse-") && r.year_group === null).length === 0,
      `${all.filter((r) => String(r.qualification ?? "").startsWith("gcse-") && r.year_group === null).length} missed`);
  }

  // (c) the constraint refuses nonsense · (d) accepts a real one · (e) NULL ok
  {
    const c = await svc.from("cohorts").update({ year_group: "Sixth Form" }).eq("slug", "igcse-chemistry-y11").select("slug");
    t("(c) year_group='Sixth Form' is refused by the CHECK",
      c.error !== null && c.error.code === "23514",
      c.error ? err(c.error) : "NO ERROR — the constraint is not enforcing");

    const d = await svc.from("cohorts").update({ year_group: "Year 11" }).eq("slug", "igcse-chemistry-y11").select("slug");
    t("(d) …and 'Year 11' is accepted, so (c) is not a column refusing everything",
      d.error === null && (d.data ?? []).length === 1,
      d.error ? err(d.error) : `${(d.data ?? []).length} row(s) updated`);

    const e = await svc.from("cohorts").update({ year_group: null }).eq("slug", "ial-chemistry-as-sep-2026").select("slug");
    t("(e) NULL is still allowed — a future A2 cohort has no year group",
      e.error === null && (e.data ?? []).length === 1,
      e.error ? err(e.error) : `${(e.data ?? []).length} row(s) updated`);
  }

  // (g) anon can read the new column with no new grant
  {
    const { data, error } = await anon.from("cohorts").select("slug,year_group").eq("is_public", true);
    const got = (data ?? []) as { slug: string; year_group: string | null }[];
    t("(g) anon reads year_group on the three public cohorts, no new grant",
      error === null && got.length === 3,
      error ? err(error) : got.map((r) => `${r.slug}=${r.year_group ?? "NULL"}`).join(" | "));
  }
  // (h) anon still cannot write it
  {
    const { data, error } = await anon.from("cohorts").update({ year_group: "Year 9" }).eq("is_public", true).select("slug");
    t("(h) anon UPDATE on cohorts is refused",
      error !== null || (data ?? []).length === 0,
      error ? err(error) : `NO ERROR — ${(data ?? []).length} row(s) updated by anon`);
  }

  skip("(f) convalidated check", "pg_constraint is not reachable through PostgREST — founder confirmed true in the sanity check; paste below to re-prove");
  skip("(i) 0054 three-privileges check", "information_schema not reachable — founder paste below");

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n══ 0055 · erase_user v2 ═════════════════════════════════════");

  // 0049 (a) — the most dangerous object in the schema must be unreachable.
  {
    const { error } = await anon.rpc("erase_user", { target: "00000000-0000-0000-0000-000000000000" });
    t("0049(a) anon CANNOT call erase_user",
      error !== null, error ? err(error) : "NO ERROR — ⚠⚠ anon can delete any user by id");
  }
  // 0049 (b) — an unknown id is refused rather than silently succeeding, and
  // the message proves the function is REACHABLE and reaches its first guard.
  {
    const { error } = await svc.rpc("erase_user", { target: "00000000-0000-0000-0000-000000000000" });
    t("0049(b) an unknown id raises 'no such user' (P0002)",
      error !== null && /no such user/i.test(error.message ?? ""),
      error ? err(error) : "NO ERROR — a nonexistent user reported success");
  }

  skip("0049(c)(d)(e)(f)(g) + 0055 probe receipt, both sabotage halves, marker pre-check, storage_purge_required",
    "every one needs an auth.users identity to create and then erase; this script creates none — founder pastes below");

  await cleanup();
}

/**
 * ⚠ CALLED FROM A `finally`, SO IT RUNS EVEN IF A CHECK THROWS. A verification
 * script that leaves rows behind when it fails is worse than one that does not
 * run: the failure is loud, the residue is silent.
 */
async function cleanup() {
  console.log("\n── CLEANUP — by captured id only, never a filter sweep ───────");

  for (const id of created.cancels) {
    const { error } = await svc.from("cancellation_requests").delete().eq("id", id).select("id");
    t(`cleanup cancellation_requests ${id.slice(0, 8)}`, error === null, error ? err(error) : "deleted");
  }
  for (const id of created.events) {
    const { error } = await svc.from("notification_events").delete().eq("id", id).select("id");
    t(`cleanup notification_events ${id.slice(0, 8)} (deliveries cascade)`, error === null, error ? err(error) : "deleted");
  }
  for (const id of created.bookings) {
    const { error } = await svc.from("private_bookings").delete().eq("id", id).select("id");
    // ⚠ A LEFT-BEHIND PROBE BOOKING WOULD BLOCK THAT TEACHER'S ERASURE FOREVER
    // (0046 teacher_id is ON DELETE RESTRICT, and 0055 refuses on it).
    t(`cleanup private_bookings ${id.slice(0, 8)}`, error === null, error ? err(error) : "deleted");
  }
  // Restore every year_group this run touched.
  for (const row of cohortBackup) {
    await svc.from("cohorts").update({ year_group: row.year_group }).eq("slug", row.slug);
  }
  const restored = ((await svc.from("cohorts").select("slug,year_group")).data ?? []) as typeof cohortBackup;
  t("cohorts.year_group restored to exactly what it was before this run",
    cohortBackup.every((b) => restored.find((r) => r.slug === b.slug)?.year_group === b.year_group),
    restored.map((r) => `${r.slug}=${r.year_group ?? "NULL"}`).join(" | "));

  // ⚠ RE-READ THE COMMERCIAL FACTS AFTER EVERYTHING. This script UPDATEs the
  // live cohorts table; proving the prices survived is not optional.
  {
    const again = await svc.from("cohorts").select("slug,price_pence,price_qar,status,seat_cap").eq("is_public", true).order("display_order");
    const p = (again.data ?? []) as Record<string, unknown>[];
    t("⚠ (a) RE-RUN AFTER CLEANUP — prices, status and cap are still exactly right",
      EXPECTED.every((e) => {
        const r = p.find((x) => x.slug === e.slug);
        return r && r.price_pence === e.price_pence && r.price_qar === e.price_qar &&
          r.status === e.status && r.seat_cap === e.seat_cap;
      }),
      p.map((r) => `${r.slug} ${r.price_pence} ${r.price_qar} ${r.status} cap${r.seat_cap}`).join(" | "));
  }
  // ⚠ A COUNT, ON EVERY TABLE THIS SCRIPT CAN WRITE TO. Checking only the rows
  // it remembers creating would miss exactly the case that already happened —
  // a previous run dying before its own cleanup.
  for (const tbl of ["private_bookings", "cancellation_requests", "notification_events",
                     "notification_deliveries", "booking_holds", "push_tokens"]) {
    const r = await svc.from(tbl).select("id");
    t(`${tbl} is empty after cleanup`, (r.data ?? []).length === 0 && !r.error,
      r.error ? err(r.error) : `${(r.data ?? []).length} row(s)`);
  }
}

async function run() {
  try {
    await main();
  } catch (e) {
    fail++;
    console.error("SCRIPT ERROR", e);
    await cleanup().catch((c) => console.error("CLEANUP ALSO FAILED", c));
  }
  console.log(`\n${fail === 0 ? "ALL RUN BLOCKS PASS" : "FAILURES"} — ${pass} passed, ${fail} failed, ${skipped.length} NOT RUN`);
  if (skipped.length) {
    console.log("\n⚠ NOT RUN — named, not counted as passes:");
    for (const s of skipped) console.log(`   · ${s}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

run();
