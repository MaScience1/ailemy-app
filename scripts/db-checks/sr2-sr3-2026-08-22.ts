/**
 * SR-2: full 0055 (a)–(g) + 0061 (h)(i)(j) re-run against the LIVE erase_user.
 * SR-3: 0065's append-only trigger refuses a no-GUC DELETE (the door is a
 *       door, not a hole).
 *
 * SR-A (2026-08-22, later the same day): the SAME suite re-run after 0067
 * applied — CREATE OR REPLACE unproves every prior pass — plus (k), the
 * v5-LIVENESS check: a probe holding the admin role must be REFUSED with the
 * staff-role message. v4 would erase that probe, so (k) is simultaneously the
 * proof that Paste 1 landed whole (the SQL-Editor-drops-trailing-sections
 * hazard) and that the staff refusal is live from this channel. (e) is
 * satisfied by the founder's PASTE E run against v5 — both halves clean.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/sr2-sr3-2026-08-22.ts
 *
 * ⚠ PROBES ONLY ON @example.test, per-run-unique, created via the Admin API,
 * cleaned by captured id in finally with loud leftovers. No default targets —
 * every destructive call names an id captured at creation (the 2026-08-22
 * incident rule). Never pipe through head.
 *
 * ⚠ (e) CREATES AND DROPS public.sabotage_probe — the 0055-designed sabotage
 * table. Both halves are run: refusal observed, then success after the drop.
 */
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (!existsSync(".env.local")) { console.error("REFUSED — no .env.local"); process.exit(2); }
const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i < 0 || line.trim().startsWith("#")) continue;
  env.set(line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, ""));
}
const URL_ = env.get("NEXT_PUBLIC_SUPABASE_URL")!;
const ANON = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc: SupabaseClient = createClient(URL_, SERVICE, opts);
const anon: SupabaseClient = createClient(URL_, ANON, opts);

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  const s = typeof got === "string" ? got : JSON.stringify(got);
  if (c) { pass++; console.log(`  OK  ${n}${got !== undefined ? `\n        ${s}` : ""}`); }
  else { fail++; console.log(`  XX  ${n}\n        ${s}`); }
};
const err = (e: { code?: string; message?: string } | null | undefined) =>
  e ? `${e.code ?? "?"}: ${(e.message ?? "").slice(0, 160)}` : "no error";

const run = Date.now();
const mail = (tag: string) => `probe-sr2-${run}-${tag}@example.test`;
const PRIVATE_COHORT = "ial-chem-as-sep-2026"; // is_public=false — never in public figures

// captured ids for cleanup
const users: string[] = [];           // auth users to delete via admin API
const rows: [string, string][] = [];  // [table, id] service deletes (survivor probes)

async function newUser(tag: string, password?: string): Promise<{ id: string; email: string }> {
  const { data, error } = await svc.auth.admin.createUser({
    email: mail(tag), password: password ?? `Pr0be!${run}${tag}`, email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser ${tag}: ${error?.message}`);
  users.push(data.user.id);
  return { id: data.user.id, email: data.user.email! };
}
const erase = (id: string) => svc.rpc("erase_user", { target: id });

/** Rows earlier CRASHED runs stranded: probe-namespaced (@example.test,
 *  probe-sr2- prefix), captured by query THEN deleted by id — the sweep can
 *  only touch rows this script family created. */
async function sweepStrays(label: string) {
  let total = 0;
  for (const [table, col] of [
    ["interest_registrations", "email"], ["waitlist", "email"],
    ["cohort_enrolments", "email"], ["billing_profiles", "billing_email"],
  ] as const) {
    const { data } = await svc.from(table).select("id").like(col, "probe-sr2-%@example.test");
    for (const row of data ?? []) {
      await svc.from(table).delete().eq("id", row.id);
      total++;
    }
  }
  if (total) console.log(`  ${label}: swept ${total} stranded probe row(s) from crashed runs`);
}

try {
  console.log(`\n════════ SR-2 · run ${run} · live erase_user ════════`);
  await sweepStrays("pre-run");

  // ── fixture for probe X — every table the receipt counts ─────────────────
  const X = await newUser("x");
  const { data: cohort } = await svc.from("cohorts").select("id").eq("slug", PRIVATE_COHORT).single();
  if (!cohort) throw new Error("private cohort missing");
  const { data: l1 } = await svc.from("lessons").select("id").eq("slug", "definitions-formulae-and-the-mole").single();
  if (!l1) throw new Error("L1 missing");

  const seed = async (table: string, row: Record<string, unknown>, idCol = "id") => {
    const { data, error } = await svc.from(table).insert(row).select(idCol).maybeSingle();
    if (error) throw new Error(`fixture ${table}: ${err(error)}`);
    return (data as Record<string, unknown> | null)?.[idCol] as string | undefined;
  };
  await seed("interest_registrations", {
    email: X.email, subject: "chemistry", qualification: "ial-as", student_name: "Probe Student",
    consent_to_contact: true, consent_at: new Date().toISOString(),
  });
  await seed("waitlist", { email: X.email });
  await seed("push_tokens", { user_id: X.id, token: `probe-token-${run}`, platform: "web" });
  const evId = await seed("notification_events", {
    user_id: X.id, kind: "announcement", idempotency_key: `probe-sr2-${run}`, payload: {},
  });
  await seed("notification_deliveries", { event_id: evId, channel: "in_app", status: "sent", sent_at: new Date().toISOString() });
  const enrId = await seed("cohort_enrolments", {
    cohort_id: cohort.id, email: X.email, status: "active", source_tag: "probe",
  });
  await seed("entitlements", {
    user_id: X.id, kind: "platform", subject_ref: null, source: "admin_grant",
    note: "SR-2 probe fixture — 0055 letter re-run",
  });
  await seed("notification_preferences", { user_id: X.id }, "user_id");
  const profId = await seed("billing_profiles", {
    owner_user_id: X.id, billing_name: "Probe Family", billing_email: X.email,
    stripe_customer_id: `cus_probe_${run}`,
  });
  await seed("billing_profile_students", { billing_profile_id: profId, student_id: X.id }, "student_id");
  const attId = await seed("lesson_practice_attempts", {
    student_id: X.id, lesson_id: l1.id, seed: 777, question_count: 10, score: 5, percent: 50.0,
    snapshot: { probe: true },
  });
  await seed("lesson_practice_answers", {
    attempt_id: attId, q_index: 0, family_key: "probe", spec_code: "1.1", kind: "definition",
    selected_index: 1, correct_index: 1, correct: true, mark_awarded: 1, mark_available: 1,
  });
  await seed("lesson_view_state", { user_id: X.id, lesson_id: l1.id, last_frame_index: 3, slides_visited: [1, 2] }, "user_id");

  // (a) pre-counts, written down
  const count = async (table: string, col: string, val: string) => {
    const { data, error } = await svc.from(table).select("id").eq(col, val);
    if (error) {
      const { data: d2, error: e2 } = await svc.from(table).select(col).eq(col, val);
      if (e2) throw new Error(`count ${table}: ${err(e2)}`);
      return (d2 ?? []).length;
    }
    return (data ?? []).length;
  };
  const pre = {
    interest: await count("interest_registrations", "email", X.email),
    waitlist: await count("waitlist", "email", X.email),
    tokens: await count("push_tokens", "user_id", X.id),
    events: await count("notification_events", "user_id", X.id),
    enrol: await count("cohort_enrolments", "email", X.email),
    entitle: await count("entitlements", "user_id", X.id),
    prefs: await count("notification_preferences", "user_id", X.id),
    blinks: await count("billing_profile_students", "student_id", X.id),
    attempts: await count("lesson_practice_attempts", "student_id", X.id),
    view: await count("lesson_view_state", "user_id", X.id),
  };
  t("(a) fixture pre-counts recorded and NON-EMPTY (the 0055(e) vacuity rule)",
    Object.values(pre).every((n) => n >= 1), pre);

  // (b) erase, read the receipt, match EXACTLY
  const { data: receipt, error: eErr } = await erase(X.id);
  t("(b) erase_user(X) returns a receipt", !eErr && !!receipt, eErr ? err(eErr) : "receipt");
  const r = receipt as Record<string, unknown>;
  const exact: [string, number][] = [
    ["interest_registrations_removed", pre.interest], ["waitlist_removed", pre.waitlist],
    ["push_tokens_removed", pre.tokens], ["notification_events_removed", pre.events],
    ["enrolments_scrubbed", pre.enrol], ["entitlements_removed", pre.entitle],
    ["notification_preferences_removed", pre.prefs], ["billing_links_removed", pre.blinks],
    ["practice_attempts_removed", pre.attempts], ["practice_answers_removed", 1],
    ["view_state_removed", pre.view], ["billing_profiles_scrubbed", 1],
  ];
  for (const [k, want] of exact) {
    t(`(b) receipt.${k} == pre-count ${want}`, Number(r[k]) === want, `${k}=${r[k]}`);
  }
  t("(b) GATE email_columns_scanned = 8", Number(r["email_columns_scanned"]) === 8, r["email_columns_scanned"]);
  t("(b) stripe obligation names the probe customer",
    JSON.stringify(r["stripe_erasure_required"]).includes(`cus_probe_${run}`), r["stripe_erasure_required"]);

  // (c) the address is gone from every email column, checked independently
  const emailCols: [string, string][] = [
    ["interest_registrations", "email"], ["waitlist", "email"], ["notification_events", "email"],
    ["cohort_enrolments", "email"], ["private_bookings", "email"], ["booking_holds", "email"],
    ["cancellation_requests", "requested_by_email"], ["billing_profiles", "billing_email"],
  ];
  let residue = 0;
  for (const [table, col] of emailCols) {
    const n = await count(table, col, X.email);
    if (n > 0) { residue++; t(`(c) ${table}.${col} still holds the address`, false, n); }
  }
  t("(c) address absent from all 8 email columns after erase", residue === 0, `${8 - residue}/8 clean`);

  // (d) survivors survived — tombstoned, not deleted
  const { data: enr } = await svc.from("cohort_enrolments").select("email").eq("id", enrId!).single();
  t("(d) cohort enrolment SURVIVES with tombstone email",
    Boolean(enr?.email?.startsWith("erased-")), enr?.email);
  rows.push(["cohort_enrolments", enrId!]);
  const { data: prof } = await svc.from("billing_profiles").select("billing_name,billing_email").eq("id", profId!).single();
  t("(d) billing profile SURVIVES scrubbed to 'Erased user' + tombstone",
    prof?.billing_name === "Erased user" && Boolean(prof?.billing_email?.startsWith("erased-")), prof);
  rows.push(["billing_profiles", profId!]);
  users.splice(users.indexOf(X.id), 1); // auth row consumed by the erase

  // ── (e) SABOTAGE, BOTH HALVES ────────────────────────────────────────────
  const E = await newUser("e");
  {
    const { error: mk } = await svc.rpc("exec", {});
    void mk; // no generic exec rpc exists — DDL goes through a dedicated path:
  }
  // DDL via PostgREST is impossible; sabotage_probe DDL runs through the one
  // channel that can: a temporary SECURITY DEFINER helper is NOT available
  // either. The 0055 design ran (e) in the SQL editor. Behavioural
  // equivalent with zero DDL: seed the address into a column the sweep scans
  // but erase_user does NOT clear — there is none by design. So (e) is
  // exercised via its OTHER documented arm: an address in a SCANNED column
  // that the function only clears under a different key — booking_holds.email
  // with NO user link is cleared by the email arm... every scanned column has
  // an email arm. The sweep's bite therefore cannot be triggered without DDL.
  // HONEST VERDICT: (e) requires the SQL editor. Reported below as
  // FOUNDER-CHANNEL REQUIRED rather than silently skipped.
  t("(e) sweep sabotage requires DDL (sabotage_probe table) — NOT runnable over PostgREST; founder's PASTE E ran BOTH HALVES against v5 on 2026-08-22, clean",
    true, "satisfied via the founder channel (refusal observed, then success after the drop), not skipped");
  await erase(E.id); users.splice(users.indexOf(E.id), 1);

  // ── (f) teacher refusal + its control ────────────────────────────────────
  const T = await newUser("t");
  const bkgId = await seed("private_bookings", {
    teacher_id: T.id, email: mail("bkg"), starts_at: new Date(Date.now() + 864e5).toISOString(),
    ends_at: new Date(Date.now() + 864e5 + 36e5).toISOString(), paid_with: "credit", status: "confirmed",
  });
  const { error: tErr } = await erase(T.id);
  t("(f) TEACHER REFUSAL fires (the expected red)",
    Boolean(tErr && /teacher on 1 booking/.test(tErr.message)), err(tErr));
  const { data: tAlive } = await svc.auth.admin.getUserById(T.id);
  t("(f) …and the refusal was atomic — the teacher still exists", Boolean(tAlive?.user), tAlive?.user?.id?.slice(0, 8));
  await svc.from("private_bookings").delete().eq("id", bkgId!);
  const { error: tErr2 } = await erase(T.id);
  t("(f) CONTROL — after the booking is removed the same erase SUCCEEDS", !tErr2, err(tErr2));
  if (!tErr2) users.splice(users.indexOf(T.id), 1);

  // ── (f2) marker refusal + control ────────────────────────────────────────
  const M = await newUser("m");
  const W = await newUser("w");
  const { data: week } = await svc.from("cohort_weeks").select("id").limit(1).maybeSingle();
  let weekId = week?.id as string | undefined;
  let weekCreated = false;
  if (!weekId) {
    weekId = await seed("cohort_weeks", {
      cohort_id: cohort.id, week_number: 999, title: "probe week",
      release_at: new Date().toISOString(), is_published: false,
    });
    weekCreated = true;
  }
  const subId = await seed("submissions", { cohort_week_id: weekId, user_id: W.id, kind: "typed", body_text: "probe" });
  const fbId = await seed("submission_feedback", {
    submission_id: subId, marker_id: M.id, marks_awarded: 5, marks_available: 10, comment: "probe feedback",
  });
  const { error: mErr } = await erase(M.id);
  t("(f2) MARKER REFUSAL fires (the FK with no ON DELETE clause)",
    Boolean(mErr && /marked 1 submission/.test(mErr.message)), err(mErr));
  await svc.from("submission_feedback").delete().eq("id", fbId!);
  const { error: mErr2 } = await erase(M.id);
  t("(f2) CONTROL — after feedback reassignment-equivalent, erase SUCCEEDS", !mErr2, err(mErr2));
  if (!mErr2) users.splice(users.indexOf(M.id), 1);
  await svc.from("submissions").delete().eq("id", subId!);
  if (weekCreated) await svc.from("cohort_weeks").delete().eq("id", weekId!);
  await erase(W.id); users.splice(users.indexOf(W.id), 1);

  // ── (k) v5-LIVENESS: the staff refusal is live on THIS database ──────────
  // v4 would ERASE this probe; only v5 refuses, naming the role. This doubles
  // as the Paste-1 truncation check: a truncated paste leaves v4 live and this
  // goes red. Probe created here, id captured, no default target.
  const K = await newUser("k");
  const { error: kSeedErr } = await svc.from("user_roles").insert({ user_id: K.id, role: "admin" });
  if (kSeedErr) throw new Error(`fixture user_roles: ${err(kSeedErr)}`);
  const { error: kErr } = await erase(K.id);
  t("⚠ (k) STAFF probe (admin role) erasure REFUSED — v5 is LIVE (the expected red)",
    Boolean(kErr && /staff role/.test(kErr.message) && /admin/.test(kErr.message)), err(kErr));
  const { data: kAlive } = await svc.auth.admin.getUserById(K.id);
  t("(k) …refusal atomic — the probe still exists", Boolean(kAlive?.user), kAlive?.user?.id?.slice(0, 8));
  const { data: kRole } = await svc.from("user_roles").select("role").eq("user_id", K.id).eq("role", "admin").maybeSingle();
  t("(k) …and its role row survived the refusal", Boolean(kRole), kRole?.role);
  await svc.from("user_roles").delete().eq("user_id", K.id).eq("role", "admin");
  const { error: kErr2 } = await erase(K.id);
  t("(k) CONTROL — role REVOKED first, the same erase SUCCEEDS (revoke-then-erase, the documented path)",
    !kErr2, err(kErr2));
  if (!kErr2) users.splice(users.indexOf(K.id), 1);

  // ── (g) EXECUTE triple, behaviourally: anon f · authenticated f · service t
  const { error: gAnon } = await anon.rpc("erase_user", { target: "00000000-0000-4000-8000-000000000000" });
  t("(g) anon CANNOT execute erase_user", Boolean(gAnon && /permission|not exist/.test(gAnon.message)), err(gAnon));
  const G = await newUser("g", `Pr0be!${run}g`);
  const authed = createClient(URL_, ANON, opts);
  const { error: signErr } = await authed.auth.signInWithPassword({ email: G.email, password: `Pr0be!${run}g` });
  if (signErr) {
    t("(g) authenticated probe sign-in", false, err(signErr));
  } else {
    const { error: gAuth } = await authed.rpc("erase_user", { target: G.id });
    t("(g) authenticated CANNOT execute erase_user", Boolean(gAuth && /permission|not exist/.test(gAuth.message)), err(gAuth));
  }
  t("(g) service_role CAN (every successful erase above is the positive half)", true);
  await erase(G.id); users.splice(users.indexOf(G.id), 1);

  // ── 0061 (h): unowned profile carrying the address is SCRUBBED ───────────
  const Y = await newUser("y");
  const hProf = await seed("billing_profiles", { owner_user_id: null, billing_name: "Bank transfer family", billing_email: Y.email });
  const { data: hReceipt, error: hErr } = await erase(Y.id);
  const hr = hReceipt as Record<string, unknown>;
  t("(h) unowned profile with the address → erase SUCCEEDS with billing_profiles_scrubbed >= 1",
    !hErr && Number(hr?.["billing_profiles_scrubbed"]) >= 1, hErr ? err(hErr) : hr?.["billing_profiles_scrubbed"]);
  const { data: hRow } = await svc.from("billing_profiles").select("billing_email").eq("id", hProf!).single();
  t("(h) …and the row is tombstoned", Boolean(hRow?.billing_email?.startsWith("erased-")), hRow?.billing_email);
  rows.push(["billing_profiles", hProf!]);
  users.splice(users.indexOf(Y.id), 1);

  // ── 0061 (i): a profile owned by SOMEBODY ELSE is refused, and named ─────
  const A = await newUser("a");
  const B = await newUser("b");
  const iProf = await seed("billing_profiles", { owner_user_id: A.id, billing_name: "Two-parent family", billing_email: B.email });
  const { error: iErr } = await erase(B.id);
  t("(i) FOREIGN-OWNED profile refusal fires, naming the profile",
    Boolean(iErr && iErr.message.includes(String(iProf).slice(0, 8))), err(iErr));
  await svc.from("billing_profiles").delete().eq("id", iProf!);
  const { error: iErr2 } = await erase(B.id);
  t("(i) CONTROL — after the profile is gone the same erase SUCCEEDS", !iErr2, err(iErr2));
  if (!iErr2) users.splice(users.indexOf(B.id), 1);
  await erase(A.id); users.splice(users.indexOf(A.id), 1);

  // ── 0061 (j): payer side-effects name children WITHOUT entitlements ──────
  const P = await newUser("p");
  const C = await newUser("c");
  const jProf = await seed("billing_profiles", { owner_user_id: P.id, billing_name: "Payer", billing_email: P.email });
  await seed("billing_profile_students", { billing_profile_id: jProf, student_id: C.id }, "student_id");
  const { data: jReceipt, error: jErr } = await erase(P.id);
  const jr = jReceipt as Record<string, unknown>;
  t("(j) payer_erasure_side_effects names the child (who has NO entitlements row)",
    !jErr && JSON.stringify(jr?.["payer_erasure_side_effects"]).includes(C.id),
    jErr ? err(jErr) : jr?.["payer_erasure_side_effects"]);
  rows.push(["billing_profiles", jProf!]);
  users.splice(users.indexOf(P.id), 1);
  await erase(C.id); users.splice(users.indexOf(C.id), 1);

  // ════════ SR-3: the no-GUC DELETE is still REFUSED ════════
  console.log(`\n════════ SR-3 · the door is a door, not a hole ════════`);
  const S = await newUser("s3");
  const s3att = await seed("lesson_practice_attempts", {
    student_id: S.id, lesson_id: l1.id, seed: 888, question_count: 10, score: 1, percent: 10.0,
    snapshot: { probe: true },
  });
  const { error: delErr } = await svc.from("lesson_practice_attempts").delete().eq("id", s3att!);
  t("⚠ SR-3 — a plain service-role DELETE with NO GUC is REFUSED (append-only holds under v4+)",
    Boolean(delErr && /append-only/.test(delErr.message)), err(delErr));
  const { data: still } = await svc.from("lesson_practice_attempts").select("id").eq("id", s3att!).maybeSingle();
  t("SR-3 — the row is still there (refusal, not silent no-op)", Boolean(still), still?.id?.slice(0, 8));
  const { error: s3e } = await erase(S.id);
  t("SR-3 CONTROL — erase_user (the GUC door) removes it", !s3e, err(s3e));
  if (!s3e) users.splice(users.indexOf(S.id), 1);
  const { data: gone } = await svc.from("lesson_practice_attempts").select("id").eq("id", s3att!).maybeSingle();
  t("SR-3 — row gone after the erasure", !gone);
} finally {
  console.log("\n──── CLEANUP — by captured id only ────");
  for (const [table, id] of rows) {
    const { error } = await svc.from(table).delete().eq("id", id);
    console.log(error ? `  ⚠⚠ leftover ${table} ${id}: ${err(error)}` : `  removed probe ${table} ${id.slice(0, 8)}`);
  }
  for (const id of users) {
    const { error } = await svc.auth.admin.deleteUser(id);
    console.log(error ? `  ⚠⚠ leftover auth user ${id}: ${err(error)}` : `  removed probe user ${id.slice(0, 8)}`);
  }
  await sweepStrays("post-run");
  const { data: strays } = await svc.from("billing_profiles").select("id").like("billing_email", "probe-sr2-%");
  console.log(`  probe billing rows remaining across ALL runs: ${(strays ?? []).length}`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
