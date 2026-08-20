/**
 * The blocks that need real identities: 0052/0053 policies, and 0055 erasure.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/erasure-and-policies-0052-0055.ts
 *
 * ============================================================================
 * ⚠ THIS ONE CREATES AND DELETES REAL auth IDENTITIES. RUN IT DELIBERATELY.
 * ============================================================================
 * Every other check in db-checks/ avoids that. This cannot: a row policy cannot
 * be exercised by service_role (BYPASSRLS makes it pass for the wrong reason),
 * and erase_user cannot be exercised without somebody to erase.
 *
 * ⚠ EVERY PROBE IDENTITY IS @example.test AND UNIQUE PER RUN. .test is reserved
 * by RFC 2606 and can never be a real address. No non-example.test identity is
 * read, written, or passed to erase_user anywhere in this file — every erase
 * target is a uuid captured from createUser() in this process, never resolved
 * from an email lookup that could match a real person.
 *
 * ⚠ CLEANUP RUNS FROM A `finally`, AND IF IT STILL FAILS THE LEFTOVER IDS ARE
 * PRINTED IN FULL. A previous run of the sibling script was killed by a closed
 * pipe before its cleanup; the two probe bookings it stranded would have made a
 * REAL PERSON permanently un-erasable, because private_bookings.teacher_id is
 * ON DELETE RESTRICT and 0055 refuses anyone who is a teacher on a booking.
 * Never pipe this through `head`. Redirect to a file.
 *
 * ============================================================================
 * ⚠ THREE IDENTITIES, AND THE ERASE ORDER IS ITSELF A TEST
 * ============================================================================
 *   A  a student: bookings, credits, requests, notifications, tokens, files
 *   B  a second student, so "A sees only their own" has something to not see
 *   T  the teacher on both students' bookings
 *
 * A and B erase while their lessons survive anonymised. T then REFUSES, naming
 * the booking count — that is 0049(d), and it falls out of the cleanup order
 * for free. The bookings are removed by captured id and T erases last.
 */
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (!existsSync(".env.local")) { console.error("REFUSED — .env.local not found."); process.exit(2); }
const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const l = line.trim();
  if (!l || l.startsWith("#")) continue;
  const i = l.indexOf("=");
  if (i < 0) continue;
  let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env.set(l.slice(0, i).trim(), v);
}
const URL_ = env.get("NEXT_PUBLIC_SUPABASE_URL");
const ANON = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE = env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!URL_ || !ANON || !SERVICE) { console.error("REFUSED — missing env."); process.exit(2); }

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc: SupabaseClient = createClient(URL_, SERVICE, opts);

let pass = 0, fail = 0;
const t = (n: string, c: boolean, observed: unknown) => {
  if (c) { pass++; console.log(`  OK  ${n}\n        ${fmt(observed)}`); }
  else { fail++; console.log(`  XX  ${n}\n        ${fmt(observed)}`); }
};
const fmt = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
const err = (e: { code?: string; message?: string } | null) =>
  e ? `${e.code ?? "?"}: ${(e.message ?? "").slice(0, 170)}` : "no error";

/**
 * ============================================================================
 * ⚠ POSTGRES REPORTS A COLUMN-PRIVILEGE FAILURE ON INSERT/UPDATE AS
 * "permission denied for TABLE", NOT "for column". THE FIRST RUN OF THIS FILE
 * MISLABELLED TWO BLOCKS BECAUSE OF IT.
 * ============================================================================
 * The per-column wording only appears for SELECT. For a write, the named
 * columns are checked and the failure is raised at table granularity — so an
 * RLS WITH CHECK, a missing table grant and a missing COLUMN grant can all
 * arrive as 42501, and two of the three word themselves identically.
 *
 * The message cannot disambiguate them. A CONTROL in the same session can:
 * if the identical statement MINUS the ungranted column succeeds on the same
 * table, a missing table grant is ruled out by construction and the only thing
 * left that refused is the column grant. That is why every column-grant check
 * below is written as a PAIR — the control is not decoration, it is the entire
 * evidence for the label.
 */
type Layer = "RLS_WITH_CHECK" | "RLS_NO_ROW" | "COLUMN_GRANT" | "TABLE_GRANT" | "NONE" | "OTHER";

const layer = (e: { code?: string; message?: string } | null): string => {
  if (!e) return "NOTHING REFUSED";
  const m = e.message ?? "";
  const col = /permission denied for column (\w+)/.exec(m);
  if (col) return `COLUMN GRANT -- ${e.code}, permission denied for column ${col[1]}`;
  if (/row-level security/i.test(m)) return `RLS POLICY (WITH CHECK) -- ${e.code}: ${m.slice(0, 90)}`;
  if (/permission denied for table/.test(m)) return `GRANT (table or column) -- ${e.code}: ${m.slice(0, 80)}`;
  return `${e.code}: ${m.slice(0, 110)}`;
};

/**
 * The verdict a control makes possible. `controlOk` is "the same session wrote
 * the SAME table successfully when no ungranted column was named".
 */
const verdict = (
  e: { code?: string; message?: string } | null,
  controlOk: boolean,
  ungranted: string,
): { layer: Layer; why: string } => {
  if (!e) return { layer: "NONE", why: "nothing refused" };
  const m = e.message ?? "";
  if (/row-level security/i.test(m)) {
    return { layer: "RLS_WITH_CHECK", why: `${e.code}: new row violates row-level security policy` };
  }
  if (/permission denied for table/.test(m)) {
    return controlOk
      ? { layer: "COLUMN_GRANT",
          why: `${e.code} permission denied for table — but the SAME session wrote this table fine ` +
               `without naming \`${ungranted}\`, so a table grant is ruled out. The COLUMN grant refused. ` +
               `Postgres words a write-side column-privilege failure at table granularity.` }
      : { layer: "TABLE_GRANT", why: `${e.code}: no control succeeded, so this may be the table grant` };
  }
  return { layer: "OTHER", why: `${e.code}: ${m.slice(0, 90)}` };
};

const RUN = Date.now();
const TAG = `probe-0055-${RUN}`;
const mail = (who: string) => `${TAG}-${who}@example.test`;

type Probe = { id: string; email: string; client: SupabaseClient };
const users: Probe[] = [];
const created = {
  bookings: [] as string[], cancels: [] as string[], events: [] as string[],
  ledger: [] as string[], weeks: [] as string[], submissions: [] as string[],
  feedback: [] as string[], enrolments: [] as string[], interest: [] as string[],
  waitlist: [] as string[], tokens: [] as string[],
};
let objects: string[] = [];

async function makeUser(who: string): Promise<Probe> {
  const email = mail(who);
  const password = `Px-${randomUUID()}`;
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser(${who}) failed: ${err(error)}`);
  const client = createClient(URL_!, ANON!, opts);
  const s = await client.auth.signInWithPassword({ email, password });
  if (s.error) throw new Error(`signIn(${who}) failed: ${err(s.error)}`);
  const p = { id: data.user.id, email, client };
  users.push(p);
  return p;
}

let A!: Probe, B!: Probe, T!: Probe;

async function main() {
  console.log(`\n=== SETUP -- three probe identities, all @example.test, run ${RUN} ===`);
  A = await makeUser("a"); B = await makeUser("b"); T = await makeUser("t");
  t("A, B and T created and signed in with the ANON key (real authenticated sessions)",
    users.length === 3, users.map((u) => `${u.email} ${u.id.slice(0, 8)}`).join(" | "));
  t("EVERY probe address is @example.test -- no real identity is in scope",
    users.every((u) => u.email.endsWith("@example.test")), users.map((u) => u.email).join(" | "));

  const cohort = await svc.from("cohorts").select("id,slug").limit(1).single();
  const cohortId = (cohort.data as { id: string }).id;

  const mkBooking = async (student: Probe, n: number) => {
    const s0 = new Date(RUN + (500 + n) * 86_400_000);
    const r = await svc.from("private_bookings").insert({
      teacher_id: T.id, user_id: student.id, email: student.email,
      starts_at: s0.toISOString(), ends_at: new Date(s0.getTime() + 3.6e6).toISOString(),
      paid_with: "credit", status: "confirmed", notes: "probe note -- must be scrubbed",
    }).select("id,booking_ref").single();
    if (r.error) throw new Error(`booking: ${err(r.error)}`);
    created.bookings.push((r.data as { id: string }).id);
    return r.data as { id: string; booking_ref: string };
  };
  const bookA = await mkBooking(A, 0);
  const bookB = await mkBooking(B, 1);
  t("seed: a booking each for A and B, teacher T", true, `A=${bookA.booking_ref} B=${bookB.booking_ref}`);

  for (const u of [A, B]) {
    const l = await svc.from("lesson_credit_transactions")
      .insert({ user_id: u.id, delta: 4, reason: "admin_adjustment" }).select("id").single();
    if (l.error) throw new Error(`ledger: ${err(l.error)}`);
    created.ledger.push((l.data as { id: string }).id);
  }

  const e1 = await svc.from("notification_events").insert({
    user_id: A.id, kind: "booking_confirmed", subject_type: "private_booking",
    subject_id: bookA.id, idempotency_key: `probe:${RUN}:linked`,
  }).select("id").single();
  if (e1.error) throw new Error(`event1: ${err(e1.error)}`);
  created.events.push((e1.data as { id: string }).id);
  for (const ch of ["email", "in_app", "push"]) {
    await svc.from("notification_deliveries").insert({
      event_id: (e1.data as { id: string }).id, channel: ch,
      status: ch === "in_app" ? "sent" : "pending",
      sent_at: ch === "in_app" ? new Date().toISOString() : null,
    });
  }
  // The email-only event -- user_id NULL. The row the CASCADE cannot reach.
  const e2 = await svc.from("notification_events").insert({
    email: A.email, kind: "announcement", idempotency_key: `probe:${RUN}:emailonly`,
  }).select("id").single();
  if (e2.error) throw new Error(`event2: ${err(e2.error)}`);
  created.events.push((e2.data as { id: string }).id);
  await svc.from("notification_deliveries").insert({ event_id: (e2.data as { id: string }).id, channel: "email" });

  for (const p of ["ios", "android"]) {
    const tk = await svc.from("push_tokens")
      .insert({ user_id: A.id, token: `probe-${RUN}-${p}`, platform: p }).select("id").single();
    if (!tk.error) created.tokens.push((tk.data as { id: string }).id);
  }
  const ir = await svc.from("interest_registrations").insert({
    subject: "chemistry", qualification: "ial-as", student_name: "probe student",
    email: A.email, consent_to_contact: true, consent_at: new Date().toISOString(),
  }).select("id").single();
  if (ir.error) throw new Error(`interest: ${err(ir.error)}`);
  created.interest.push((ir.data as { id: string }).id);

  const wl = await svc.from("waitlist").insert({ email: A.email, source: "probe" }).select("id").single();
  if (wl.error) throw new Error(`waitlist: ${err(wl.error)}`);
  created.waitlist.push((wl.data as { id: string }).id);

  const en = await svc.from("cohort_enrolments").insert({
    cohort_id: cohortId, user_id: A.id, email: A.email, status: "paid",
    amount_pence: 16900, stripe_ref: `probe_${RUN}`,
    parent_name: "probe parent", parent_contact: "+974 0000 0000",
  }).select("id").single();
  if (en.error) throw new Error(`enrolment: ${err(en.error)}`);
  created.enrolments.push((en.data as { id: string }).id);

  // ==========================================================================
  console.log("\n=== 0052 -- policy blocks, as REAL STUDENT SESSIONS ===");
  {
    const r = await A.client.from("cancellation_requests").insert({
      booking_id: bookA.id, user_id: A.id, requested_by_email: A.email, reason: "Exam clash",
    }).select("id,status,resolution,resolved_by,resolved_at").single();
    if (!r.error) created.cancels.push((r.data as { id: string }).id);
    const row = r.data as Record<string, unknown> | null;
    t("(f3) A opens an ordinary request on their OWN booking", r.error === null,
      r.error ? layer(r.error) : "inserted");
    t("(f3) ...and status/resolution/resolved_by/resolved_at are the DEFAULTS, not the client",
      row !== null && row.status === "open" && row.resolution === null &&
      row.resolved_by === null && row.resolved_at === null,
      row ? `status=${row.status} resolution=${row.resolution} by=${row.resolved_by} at=${row.resolved_at}` : "no row");
  }
  {
    const r = await B.client.from("cancellation_requests").insert({
      booking_id: bookB.id, user_id: B.id, requested_by_email: B.email, reason: "probe B",
    }).select("id").single();
    if (!r.error) created.cancels.push((r.data as { id: string }).id);
    t("seed: B opens one too", r.error === null, r.error ? layer(r.error) : "inserted");
  }
  {
    const mine = await A.client.from("cancellation_requests").select("id,user_id");
    const rows = (mine.data ?? []) as { user_id: string }[];
    t("(e) A sees ONLY their own requests -- B's is invisible",
      mine.error === null && rows.length === 1 && rows.every((r) => r.user_id === A.id),
      mine.error ? err(mine.error) : `${rows.length} row(s), all A: ${rows.every((r) => r.user_id === A.id)}`);
  }
  {
    const r = await A.client.from("cancellation_requests").insert({
      booking_id: bookB.id, user_id: A.id, requested_by_email: A.email, reason: "not mine",
    }).select("id");
    if (!r.error && (r.data ?? []).length) created.cancels.push((r.data as { id: string }[])[0].id);
    t("(f) A CANNOT open a request against B's booking", r.error !== null,
      r.error ? layer(r.error) : "NO ERROR -- a DoS on another family's booking");
    console.log(`        LAYER: ${layer(r.error)}`);
  }
  {
    // CONTROL: the same session, the same table, granted columns only.
    const control = await A.client.from("cancellation_requests").insert({
      booking_id: bookA.id, user_id: A.id, requested_by_email: A.email, student_note: "control",
    }).select("id");
    const controlOk = control.error === null;
    if (controlOk && (control.data ?? []).length) created.cancels.push((control.data as { id: string }[])[0].id);
    // (Refused by the partial index if one is already open — still proves the
    // grant let the statement THROUGH to a constraint, which is what matters.)
    const reachedConstraint = controlOk || control.error?.code === "23505";
    t("(f2-control) the same session CAN write this table when no ungranted column is named",
      reachedConstraint, control.error ? layer(control.error) : "inserted");

    const r = await A.client.from("cancellation_requests").insert({
      booking_id: bookA.id, user_id: A.id, requested_by_email: A.email,
      status: "resolved", resolution: "refunded", resolved_at: new Date().toISOString(),
    }).select("id");
    if (!r.error && (r.data ?? []).length) created.cancels.push((r.data as { id: string }[])[0].id);
    const v = verdict(r.error, reachedConstraint, "status");
    t("(f2) A CANNOT file their own refund", r.error !== null,
      r.error ? layer(r.error) : "NO ERROR -- a forged refund record");
    t("(f2-layer) ...and it was the COLUMN GRANT that refused, not the table grant",
      v.layer === "COLUMN_GRANT", `${v.layer} — ${v.why}`);
  }
  {
    const r = await A.client.from("cancellation_requests")
      .update({ status: "resolved", resolution: "refunded", resolved_at: new Date().toISOString() })
      .eq("user_id", A.id).select("id");
    t("(g) A cannot resolve their own request",
      r.error !== null || (r.data ?? []).length === 0,
      r.error ? layer(r.error) : `${(r.data ?? []).length} row(s) updated -- 0 means no student UPDATE policy admits it`);
    console.log(`        LAYER: ${r.error ? layer(r.error) : "RLS POLICY -- 0 rows, no student UPDATE policy exists"}`);
  }

  // ==========================================================================
  console.log("\n=== 0053 -- policy blocks, as REAL STUDENT SESSIONS ===");
  {
    const ev = await A.client.from("notification_events").select("id,user_id");
    const rows = (ev.data ?? []) as { user_id: string | null }[];
    t("(f) A sees only events whose user_id is A",
      ev.error === null && rows.length >= 1 && rows.every((r) => r.user_id === A.id),
      ev.error ? err(ev.error) : `${rows.length} row(s), all A: ${rows.every((r) => r.user_id === A.id)}`);
    t("(f2) ...and the email-only event (user_id NULL) is NOT among them",
      rows.every((r) => r.user_id !== null),
      `${rows.filter((r) => r.user_id === null).length} null-user rows visible`);
    const dl = await A.client.from("notification_deliveries").select("id,channel");
    t("(f3) A sees the deliveries hanging off their own event",
      dl.error === null && (dl.data ?? []).length === 3,
      dl.error ? err(dl.error) : `${(dl.data ?? []).length} delivery row(s)`);
  }
  {
    const ok = await A.client.from("notification_deliveries")
      .update({ read_at: new Date().toISOString() }).eq("channel", "in_app").select("id");
    t("(g1) A marks their in_app delivery read -- 1 row",
      ok.error === null && (ok.data ?? []).length === 1,
      ok.error ? layer(ok.error) : `${(ok.data ?? []).length} row(s) updated`);

    // (g1) IS the control: same session, same row, granted column, 1 row.
    const controlOk = ok.error === null && (ok.data ?? []).length === 1;
    const denied = await A.client.from("notification_deliveries")
      .update({ status: "sent" }).eq("channel", "in_app").select("id");
    t("(g2) ...but cannot write `status` on the SAME row", denied.error !== null,
      denied.error ? layer(denied.error) : "NO ERROR -- a student flipped a delivery to sent");
    const v = verdict(denied.error, controlOk, "status");
    t("(g2-layer) ...and it was the COLUMN GRANT, proven by (g1) succeeding on that very row",
      v.layer === "COLUMN_GRANT", `${v.layer} — ${v.why}`);

    const wrong = await A.client.from("notification_deliveries")
      .update({ read_at: new Date().toISOString() }).eq("channel", "email").select("id");
    t("(g3) ...and read_at on the EMAIL channel touches 0 rows",
      wrong.error === null && (wrong.data ?? []).length === 0,
      wrong.error ? layer(wrong.error) : `${(wrong.data ?? []).length} row(s)`);
    console.log("        LAYER: RLS POLICY -- the channel='in_app' scope in USING, not the grant");
  }
  {
    const bad = await A.client.from("push_tokens")
      .insert({ user_id: B.id, token: `probe-${RUN}-stolen`, platform: "ios" }).select("id");
    if (!bad.error && (bad.data ?? []).length) created.tokens.push((bad.data as { id: string }[])[0].id);
    t("(i) A cannot register a token against B's account", bad.error !== null,
      bad.error ? layer(bad.error) : "NO ERROR -- A registered a device for B");
    console.log(`        LAYER: ${layer(bad.error)}`);
    const good = await A.client.from("push_tokens")
      .insert({ user_id: A.id, token: `probe-${RUN}-own`, platform: "web" }).select("id").single();
    if (!good.error) created.tokens.push((good.data as { id: string }).id);
    t("(i2) ...and CAN register one for themselves -- so (i) is not a table refusing everything",
      good.error === null, good.error ? layer(good.error) : "inserted");
  }

  // ==========================================================================
  console.log("\n=== 0055 -- erasure ===");
  const week = await svc.from("cohort_weeks").insert({
    cohort_id: cohortId, week_number: 999, title: `probe ${RUN}`, release_at: new Date().toISOString(),
  }).select("id").single();
  if (week.error) throw new Error(`cohort_weeks: ${err(week.error)}`);
  created.weeks.push((week.data as { id: string }).id);

  const objPath = `${A.id}/probe-${RUN}.txt`;
  const sub = await svc.from("submissions").insert({
    cohort_week_id: (week.data as { id: string }).id, user_id: A.id,
    kind: "photo", storage_path: objPath,
  }).select("id").single();
  if (sub.error) throw new Error(`submissions: ${err(sub.error)}`);
  created.submissions.push((sub.data as { id: string }).id);

  const fb = await svc.from("submission_feedback").insert({
    submission_id: (sub.data as { id: string }).id, marker_id: A.id,
    marks_awarded: 5, marks_available: 6, comment: "probe marking",
  }).select("id").single();
  if (fb.error) throw new Error(`submission_feedback: ${err(fb.error)}`);
  created.feedback.push((fb.data as { id: string }).id);

  const evIds = ((await svc.from("notification_events").select("id")
    .or(`user_id.eq.${A.id},email.eq.${A.email}`)).data ?? []) as { id: string }[];
  const pre = {
    cancels: (await svc.from("cancellation_requests").select("id").eq("user_id", A.id)).data?.length ?? 0,
    events: evIds.length,
    deliveries: ((await svc.from("notification_deliveries").select("id").in("event_id", evIds.map((e) => e.id))).data ?? []).length,
    tokens: (await svc.from("push_tokens").select("id").eq("user_id", A.id)).data?.length ?? 0,
    interest: (await svc.from("interest_registrations").select("id").eq("email", A.email)).data?.length ?? 0,
    waitlist: (await svc.from("waitlist").select("id").eq("email", A.email)).data?.length ?? 0,
    bookings: (await svc.from("private_bookings").select("id").eq("email", A.email)).data?.length ?? 0,
    enrolments: (await svc.from("cohort_enrolments").select("id").eq("email", A.email)).data?.length ?? 0,
    ledger: (await svc.from("lesson_credit_transactions").select("id").eq("user_id", A.id)).data?.length ?? 0,
    submissions: (await svc.from("submissions").select("id").eq("user_id", A.id)).data?.length ?? 0,
  };
  console.log(`  PRE-COUNTS for A: ${JSON.stringify(pre)}`);
  t("EVERY pre-count is NON-ZERO -- a zero-row table cannot fail an erasure check",
    Object.values(pre).every((v) => v > 0), JSON.stringify(pre));

  {
    const up = await svc.storage.from("submissions")
      .upload(objPath, new Blob(["probe"], { type: "text/plain" }), { upsert: true });
    if (!up.error) objects.push(objPath);
    t("a storage object exists under A's uid folder", up.error === null, up.error ? up.error.message : objPath);
  }
  {
    const r = await svc.rpc("erase_user", { target: A.id });
    t("(f2) erase_user REFUSES while A has marked a submission, and NAMES it",
      r.error !== null && /has marked/.test(r.error.message ?? ""),
      r.error ? err(r.error) : "NO ERROR -- the marker FK would have raised a bare 23503");
    const still = await svc.auth.admin.getUserById(A.id);
    t("(f2b) ...and A is STILL THERE -- refused, not half-erased",
      Boolean(still.data?.user), still.data?.user ? "present" : "GONE");
  }
  {
    const d = await svc.from("submission_feedback").delete().eq("id", created.feedback[0]).select("id");
    if (!d.error && (d.data ?? []).length === 1) created.feedback = [];
    t("marker linkage removed by captured id", d.error === null && (d.data ?? []).length === 1,
      d.error ? err(d.error) : "deleted");
  }

  let receipt: Record<string, unknown> | null = null;
  {
    const r = await svc.rpc("erase_user", { target: A.id });
    receipt = (r.data ?? null) as Record<string, unknown> | null;
    t("erase_user(A) succeeds now the marker is gone", r.error === null && receipt !== null,
      r.error ? err(r.error) : JSON.stringify(receipt));
  }
  if (receipt) {
    const R = receipt as Record<string, unknown>;
    const check = (label: string, want: number) =>
      t(`receipt ${label} = ${want}`, R[label] === want, `got ${R[label]}, pre-count ${want}`);
    check("cancellation_requests_removed", pre.cancels);
    check("notification_events_removed", pre.events);
    check("notification_deliveries_removed", pre.deliveries);
    check("push_tokens_removed", pre.tokens);
    check("interest_registrations_removed", pre.interest);
    check("waitlist_removed", pre.waitlist);
    check("bookings_scrubbed", pre.bookings);
    check("enrolments_scrubbed", pre.enrolments);
    check("ledger_rows_removed", pre.ledger);
    const sp = R.storage_purge_required as Record<string, unknown> | undefined;
    t("storage_purge_required is present in the receipt", sp !== undefined, JSON.stringify(sp));
    t("...naming the bucket, A's prefix, and the row count",
      sp?.bucket === "submissions" && sp?.prefix === `${A.id}/` && sp?.rows_referencing_files === pre.submissions,
      JSON.stringify(sp));
    t("email_columns_scanned is a real number",
      typeof R.email_columns_scanned === "number" && (R.email_columns_scanned as number) >= 7,
      String(R.email_columns_scanned));
  }
  {
    const bLedger = created.ledger[1];
    const exists = await svc.from("lesson_credit_transactions").select("id").eq("id", bLedger);
    t("0049(f) setup: B's ledger row still exists to aim at -- an UPDATE matching nothing would be a false pass",
      (exists.data ?? []).length === 1, `${(exists.data ?? []).length} row(s)`);
    const r = await svc.from("lesson_credit_transactions").update({ delta: 4 }).eq("id", bLedger).select("id");
    t("0049(f) immediately after erase_user returned, an ordinary UPDATE is STILL refused 23001",
      r.error !== null && r.error.code === "23001",
      r.error ? err(r.error) : "NO ERROR -- set_config leaked; the ledger is no longer append-only");
  }
  {
    const list = await svc.storage.from("submissions").list(A.id);
    t("the storage object SURVIVED the erasure -- expected; the DB cannot delete a binary",
      (list.data ?? []).length === 1, `${(list.data ?? []).length} object(s) under ${A.id}/`);
    const rm = await svc.storage.from("submissions").remove([objPath]);
    if (!rm.error) objects = [];
    t("purged through the Storage API using the receipt's prefix", rm.error === null,
      rm.error ? rm.error.message : "removed");
    const after = await svc.storage.from("submissions").list(A.id);
    t("...and the prefix is now empty", (after.data ?? []).length === 0, `${(after.data ?? []).length} object(s)`);
  }
  {
    const r = await svc.rpc("erase_user", { target: B.id });
    t("erase_user(B) succeeds", r.error === null, r.error ? err(r.error) : JSON.stringify(r.data));
  }
  {
    const r = await svc.rpc("erase_user", { target: T.id });
    t("0049(d) T is REFUSED -- teacher on 2 bookings, and the message says so",
      r.error !== null && /teacher on 2 booking/.test(r.error.message ?? ""),
      r.error ? err(r.error) : "NO ERROR -- a teacher's lesson records were erased by association");
  }
  {
    const bs = await svc.from("private_bookings").select("id,email,notes,user_id").in("id", created.bookings);
    const rows = (bs.data ?? []) as { email: string; notes: string | null; user_id: string | null }[];
    t("0049(e) both lessons SURVIVED -- the lesson happened", rows.length === 2, `${rows.length} booking(s)`);
    t("...with a tombstone address, notes NULL and user_id NULL -- the person is gone",
      rows.length === 2 && rows.every((r) => r.email.endsWith("@ailemy.invalid") && r.notes === null && r.user_id === null),
      rows.map((r) => `${r.email} notes=${r.notes} uid=${r.user_id}`).join(" | "));
  }
  {
    const en2 = await svc.from("cohort_enrolments")
      .select("amount_pence,stripe_ref,email,parent_name,parent_contact").eq("id", created.enrolments[0]).single();
    const r = en2.data as Record<string, unknown> | null;
    t("the enrolment kept amount_pence and stripe_ref -- a payment stays provable",
      r?.amount_pence === 16900 && r?.stripe_ref === `probe_${RUN}`, `${r?.amount_pence} ${r?.stripe_ref}`);
    t("...and lost the address, the parent name and the WhatsApp number",
      String(r?.email ?? "").endsWith("@ailemy.invalid") && r?.parent_name === null && r?.parent_contact === null,
      `${r?.email} name=${r?.parent_name} contact=${r?.parent_contact}`);
  }

  console.log("\n--- independent residue check (NOT erase_user's own sweep) ---");
  const EMAIL_COLS: [string, string][] = [
    ["cancellation_requests", "requested_by_email"], ["notification_events", "email"],
    ["interest_registrations", "email"], ["waitlist", "email"],
    ["private_bookings", "email"], ["booking_holds", "email"], ["cohort_enrolments", "email"],
  ];
  let residue = 0;
  for (const addr of [A.email, B.email]) {
    for (const [tbl, col] of EMAIL_COLS) {
      const r = await svc.from(tbl).select("id").ilike(col, addr);
      const n = (r.data ?? []).length;
      residue += n;
      if (r.error || n !== 0) t(`residue ${tbl}.${col}`, false, r.error ? err(r.error) : `${n} row(s) for ${addr}`);
    }
  }
  t("residue across 7 email columns x 2 erased addresses = 0", residue === 0, `${residue} row(s)`);
  {
    const gone = await Promise.all([A.id, B.id].map((id) => svc.auth.admin.getUserById(id)));
    t("A and B are gone from auth.users",
      gone.every((g) => !g.data?.user), gone.map((g) => (g.data?.user ? "PRESENT" : "gone")).join(" | "));
  }
}

async function cleanup() {
  console.log("\n--- CLEANUP -- by captured id only ---");
  const TBL: Record<string, string> = {
    feedback: "submission_feedback", submissions: "submissions", weeks: "cohort_weeks",
    cancels: "cancellation_requests", events: "notification_events", ledger: "lesson_credit_transactions",
    tokens: "push_tokens", interest: "interest_registrations", waitlist: "waitlist",
    enrolments: "cohort_enrolments", bookings: "private_bookings",
  };
  for (const key of ["feedback", "submissions", "weeks", "cancels", "events", "tokens",
                     "interest", "waitlist", "enrolments", "bookings"]) {
    for (const id of (created as Record<string, string[]>)[key]) {
      const r = await svc.from(TBL[key]).delete().eq("id", id).select("id");
      if (r.error) console.log(`  !! ${TBL[key]} ${id} NOT DELETED -- ${err(r.error)}`);
    }
  }
  if (objects.length) await svc.storage.from("submissions").remove(objects);

  for (const u of users) {
    const still = await svc.auth.admin.getUserById(u.id);
    if (!still.data?.user) continue;
    if (!u.email.endsWith("@example.test")) { console.log(`  !! REFUSING to erase ${u.email}`); continue; }
    const r = await svc.rpc("erase_user", { target: u.id });
    if (r.error) console.log(`  !! erase_user(${u.email}) failed -- ${err(r.error)}`);
  }

  const leftovers: string[] = [];
  for (const key of Object.keys(TBL)) {
    const ids = (created as Record<string, string[]>)[key];
    if (!ids?.length) continue;
    const r = await svc.from(TBL[key]).select("id").in("id", ids);
    for (const row of (r.data ?? []) as { id: string }[]) leftovers.push(`${TBL[key]}:${row.id}`);
  }
  for (const u of users) {
    const s = await svc.auth.admin.getUserById(u.id);
    if (s.data?.user) leftovers.push(`auth.users:${u.id} (${u.email})`);
  }
  if (leftovers.length) {
    fail++;
    console.log("\n!!!! LEFTOVERS IN PRODUCTION -- DELETE THESE BY ID:");
    for (const l of leftovers) console.log(`       ${l}`);
  } else {
    t("NOTHING LEFT BEHIND -- every probe row and identity is gone", true, "0 leftovers");
  }
}

async function run() {
  try { await main(); }
  catch (e) { fail++; console.error("\nSCRIPT ERROR", e); }
  finally { await cleanup().catch((c) => { fail++; console.error("CLEANUP FAILED", c); }); }
  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} -- ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
run();
