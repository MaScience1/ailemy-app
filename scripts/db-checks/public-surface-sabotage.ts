/**
 * Live sabotage tests for the public surface: 0039, 0040, 0041.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/public-surface-sabotage.ts
 *
 * ============================================================================
 * ⚠ THIS IS THE ONE PLACE PRODUCTION CREDENTIALS ARE USED ON PURPOSE
 * ============================================================================
 * It is the owner's check, run with the owner watching, against named targets.
 * It is NOT importable, it is not part of `npm test`, and no subagent is ever
 * handed it — an audit reasons about source; this asks the database whether the
 * policies actually hold (AGENTS.md, "Subagents and audits").
 *
 * ⚠ EVERY ROW IT CREATES IS DELETED BY THE ID IT CAPTURED AT CREATION. There is
 * no table-wide sweep and no delete by filter anywhere in this file. It runs
 * against the live database; a `DELETE ... WHERE title LIKE 'probe%'` is one
 * typo away from deleting somebody's real announcement.
 *
 * ============================================================================
 * ⚠ A ZERO-ROW RESULT IS NOT A PASS, AND THAT IS THE WHOLE DESIGN
 * ============================================================================
 * "anon saw nothing" is what a correct policy looks like AND what an empty
 * table looks like AND what a broken query looks like. So every negative check
 * here is paired with its positive half:
 *
 *   • anon SELECT on interest_registrations must ERROR (42501). Zero rows would
 *     mean a SELECT grant exists and RLS merely filtered — a different, weaker
 *     posture that this script refuses to call a pass.
 *   • Every "anon sees 0" on a probe row is preceded by service_role proving
 *     that row EXISTS, and followed by flipping the gate and proving anon then
 *     sees exactly 1.
 */
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (!existsSync(".env.local")) {
  console.error("REFUSED — .env.local not found. This script talks to the live database.");
  process.exit(2);
}

const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env.set(t.slice(0, i).trim(), v);
}

const URL_ = env.get("NEXT_PUBLIC_SUPABASE_URL");
const ANON = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE = env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!URL_ || !ANON || !SERVICE) {
  console.error("REFUSED — need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon: SupabaseClient = createClient(URL_, ANON, opts);
const svc: SupabaseClient = createClient(URL_, SERVICE, opts);

let pass = 0, fail = 0;
const t = (name: string, cond: boolean, observed: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${name}\n      observed: ${fmt(observed)}`); }
  else { fail++; console.log(`  ✗ ${name}\n      observed: ${fmt(observed)}`); }
};
const fmt = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
const err = (e: { code?: string; message?: string } | null) =>
  e ? `${e.code ?? "?"}: ${e.message ?? ""}` : "no error";

/** Ids this run created, so cleanup names them individually. */
const created = { interest: [] as string[], announcements: [] as string[], cohorts: [] as string[] };

const MIGRATION_ABSENT = new Set(["PGRST205", "42P01", "PGRST204", "42703"]);
const absent = (e: { code?: string } | null) => Boolean(e && MIGRATION_ABSENT.has(e.code ?? ""));

async function main() {
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 0040 · interest_registrations ─────────────────────────────");

  // (1) anon SELECT must be an ERROR, not an empty list.
  {
    const { data, error } = await anon.from("interest_registrations").select("id").limit(1);
    if (absent(error)) {
      t("anon SELECT is refused", false, `${err(error)}  ← 0040 NOT APPLIED`);
    } else {
      t(
        "anon SELECT is refused with permission denied (0 rows would be a FAILURE)",
        error !== null && error.code === "42501",
        error ? err(error) : `NO ERROR — returned ${(data ?? []).length} row(s). A SELECT grant exists.`,
      );
    }
  }

  // (2) anon INSERT without consent must fail.
  {
    const { error } = await anon.from("interest_registrations").insert({
      subject: "biology", qualification: "ial-as",
      student_name: "sabotage no-consent", email: "probe-noconsent@example.test",
      consent_to_contact: false,
    });
    t(
      "anon INSERT without consent is refused",
      error !== null && !absent(error),
      error ? err(error) : "NO ERROR — a row without consent was accepted",
    );
  }

  // (2b) …and consent_to_contact=true with no consent_at is refused too. The
  //      CHECK requires both; a tick with no timestamp cannot answer "when".
  {
    const { error } = await anon.from("interest_registrations").insert({
      subject: "biology", qualification: "ial-as",
      student_name: "sabotage no-timestamp", email: "probe-nots@example.test",
      consent_to_contact: true, consent_at: null,
    });
    t(
      "anon INSERT with consent but no consent_at is refused",
      error !== null && !absent(error),
      error ? err(error) : "NO ERROR — consent with no timestamp was accepted",
    );
  }

  // (3) anon INSERT with consent succeeds. The id is MINTED HERE rather than
  //     read back, because anon holds no SELECT — this is how the row stays
  //     deletable by an id we captured at creation.
  {
    const id = randomUUID();
    const { error } = await anon.from("interest_registrations").insert({
      id,
      subject: "biology", qualification: "ial-as",
      student_name: "sabotage probe", email: "probe@example.test",
      consent_to_contact: true, consent_at: new Date().toISOString(),
    });
    const ok = error === null;
    t("anon INSERT with consent succeeds", ok, ok ? `inserted id ${id}` : err(error));
    if (ok) {
      created.interest.push(id);
      // The positive half: service_role proves the row is really there, so the
      // refusal in (1) is a refusal and not an empty table.
      const { data: seen } = await svc.from("interest_registrations").select("id,consent_at").eq("id", id);
      t(
        "…and service_role can see it (so (1) proved a refusal, not emptiness)",
        (seen ?? []).length === 1,
        seen,
      );
      // Delete by the captured id, and count what came back.
      const { data: gone, error: delErr } = await svc
        .from("interest_registrations").delete().eq("id", id).select("id");
      const count = (gone ?? []).length;
      t("…and deleting it by that id removes exactly 1 row", delErr === null && count === 1, `count=${count}`);
      if (delErr === null && count === 1) created.interest.pop();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 0039 · announcements ──────────────────────────────────────");

  const annId = randomUUID();
  const annTitle = `sabotage probe ${annId.slice(0, 8)}`;
  {
    // ⚠ body IS SUPPLIED BECAUSE THE COLUMN IS NOT NULL. The first live run of
    // this script omitted it and production answered 23502 — which is how the
    // divergence between 0022-on-disk (nullable) and production (NOT NULL) was
    // found at all. Left as a supplied value rather than "fixed" silently.
    const { error } = await svc.from("announcements").insert({
      id: annId, title: annTitle, body: "sabotage probe body",
      category: "update", status: "live", enabled: false,
    });
    if (error) {
      t("service_role can create a probe announcement", false, err(error));
    } else {
      created.announcements.push(annId);
      t("service_role can create a probe announcement", true, `id ${annId}, enabled=false`);

      // (5a) disabled → anon sees nothing, and service_role proves it exists.
      const { data: mine } = await svc.from("announcements").select("id").eq("id", annId);
      t("…and service_role sees it", (mine ?? []).length === 1, mine);

      const d1 = await anon.from("announcements").select("id").eq("id", annId);
      t(
        "anon sees NOTHING while it is disabled",
        d1.error === null && (d1.data ?? []).length === 0,
        d1.error ? err(d1.error) : `${(d1.data ?? []).length} row(s)`,
      );

      // (5b) enabled and in window → anon sees exactly 1. Without this, (5a)
      //      proves only that anon cannot read announcements at all.
      await svc.from("announcements").update({
        enabled: true,
        starts_at: new Date(Date.now() - 60_000).toISOString(),
        ends_at: new Date(Date.now() + 3_600_000).toISOString(),
      }).eq("id", annId);
      const d2 = await anon.from("announcements").select("id").eq("id", annId);
      t(
        "anon DOES see it once enabled and in window",
        d2.error === null && (d2.data ?? []).length === 1,
        d2.error ? err(d2.error) : `${(d2.data ?? []).length} row(s)`,
      );

      // (5c) expired → gone again.
      await svc.from("announcements").update({
        ends_at: new Date(Date.now() - 60_000).toISOString(),
      }).eq("id", annId);
      const d3 = await anon.from("announcements").select("id").eq("id", annId);
      t(
        "anon sees NOTHING once the window has closed",
        d3.error === null && (d3.data ?? []).length === 0,
        d3.error ? err(d3.error) : `${(d3.data ?? []).length} row(s)`,
      );

      // (5d) not yet started → also invisible.
      await svc.from("announcements").update({
        starts_at: new Date(Date.now() + 3_600_000).toISOString(),
        ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      }).eq("id", annId);
      const d4 = await anon.from("announcements").select("id").eq("id", annId);
      t(
        "anon sees NOTHING before the window opens",
        d4.error === null && (d4.data ?? []).length === 0,
        d4.error ? err(d4.error) : `${(d4.data ?? []).length} row(s)`,
      );

      // (4) anon UPDATE must fail.
      const u = await anon.from("announcements").update({ title: "hijacked" }).eq("id", annId);
      const after = await svc.from("announcements").select("title").eq("id", annId).single();
      const unchanged = (after.data as { title: string } | null)?.title === annTitle;
      t(
        "anon UPDATE is refused",
        u.error !== null,
        u.error ? err(u.error) : `NO ERROR — title is now ${JSON.stringify((after.data as { title: string } | null)?.title)}`,
      );
      t("…and the title is provably unchanged", unchanged, (after.data as { title: string } | null)?.title);

      // anon INSERT and DELETE must fail too.
      const i = await anon.from("announcements").insert({ title: "nope", category: "update" });
      t("anon INSERT is refused", i.error !== null, i.error ? err(i.error) : "NO ERROR");
      const x = await anon.from("announcements").delete().eq("id", annId);
      const still = await svc.from("announcements").select("id").eq("id", annId);
      t(
        "anon DELETE is refused and the row survives",
        x.error !== null || (still.data ?? []).length === 1,
        x.error ? err(x.error) : `row still present: ${(still.data ?? []).length === 1}`,
      );

      // ⚠ THE WINDOW CONSTRAINT. ends_at before starts_at must be rejected.
      const bad = await svc.from("announcements")
        .update({ starts_at: new Date(Date.now() + 7_200_000).toISOString(),
                  ends_at: new Date(Date.now() + 3_600_000).toISOString() })
        .eq("id", annId);
      t(
        "a backwards window is refused BY announcements_window_ordered",
        bad.error !== null && bad.error.code === "23514" &&
          /announcements_window_ordered/.test(bad.error.message ?? ""),
        bad.error ? err(bad.error) : "NO ERROR — ends_at before starts_at was accepted",
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 0041 · cohorts ────────────────────────────────────────────");

  // (8) the dead-CTA constraint: enrolling with no url must be refused.
  {
    const id = randomUUID();
    const { error } = await svc.from("cohorts").insert({
      id, slug: `sabotage-probe-${id.slice(0, 8)}`, title: "sabotage probe",
      price_pence: 1, starts_on: "2027-09-01", ends_on: "2028-06-01",
      status: "enrolling", enrolment_url: null, is_public: false,
    });
    if (error === null) created.cohorts.push(id);
    // ⚠ "IT ERRORED" IS NOT THE ASSERTION. On the first run of this script the
    // enrolment_url column did not exist, PostgREST returned PGRST204, and this
    // check went green while proving nothing whatsoever about the constraint.
    // The named constraint must be what refuses it: 23514 is check_violation.
    t(
      "status=enrolling with no enrolment_url is refused BY cohorts_enrolling_needs_url",
      error !== null && error.code === "23514" &&
        /cohorts_enrolling_needs_url/.test(error.message ?? ""),
      error
        ? absent(error)
          ? `${err(error)}  ← 0041 NOT APPLIED; the constraint was never reached`
          : err(error)
        : "NO ERROR — a dead Enrol button is now writable",
    );
  }

  // (7) the is_public gate — the amendment's proof.
  const cohId = randomUUID();
  const cohSlug = `sabotage-probe-${cohId.slice(0, 8)}`;
  {
    const { error } = await svc.from("cohorts").insert({
      id: cohId, slug: cohSlug, title: "sabotage probe",
      price_pence: 1, starts_on: "2027-09-01", ends_on: "2028-06-01",
      // is_active deliberately LEFT AT ITS DEFAULT (true). A probe that set it
      // false would pass for the wrong reason and prove nothing about is_public.
      status: "interest", enrolment_url: null, is_public: false,
    });
    if (error) {
      t("service_role can create a probe cohort", false, err(error));
    } else {
      created.cohorts.push(cohId);
      t("service_role can create a probe cohort (is_active default true, is_public false)", true, `id ${cohId}`);

      const p1 = await anon.from("cohorts").select("id").eq("id", cohId);
      t(
        "anon sees NOTHING while is_public is false — 0009's unscoped policy is scoped",
        p1.error === null && (p1.data ?? []).length === 0,
        p1.error ? err(p1.error) : `${(p1.data ?? []).length} row(s)  ${(p1.data ?? []).length > 0 ? "← 0009 \"cohorts readable\" still applies to anon; the 0041 amendment did not take" : ""}`,
      );

      await svc.from("cohorts").update({ is_public: true }).eq("id", cohId);
      const p2 = await anon.from("cohorts").select("id").eq("id", cohId);
      t(
        "anon DOES see it once is_public is true",
        p2.error === null && (p2.data ?? []).length === 1,
        p2.error ? err(p2.error) : `${(p2.data ?? []).length} row(s)`,
      );

      // (6) anon writes must fail.
      const u = await anon.from("cohorts").update({ price_pence: 0 }).eq("id", cohId);
      const after = await svc.from("cohorts").select("price_pence").eq("id", cohId).single();
      t(
        "anon UPDATE on cohorts is refused",
        u.error !== null,
        u.error ? err(u.error) : `NO ERROR — price_pence is now ${(after.data as { price_pence: number } | null)?.price_pence}`,
      );
      t(
        "…and the price is provably unchanged",
        (after.data as { price_pence: number } | null)?.price_pence === 1,
        (after.data as { price_pence: number } | null)?.price_pence,
      );

      const i = await anon.from("cohorts").insert({
        slug: `anon-should-not-write-${randomUUID().slice(0, 8)}`, title: "nope",
        price_pence: 1, starts_on: "2027-09-01", ends_on: "2028-06-01",
      });
      t("anon INSERT on cohorts is refused", i.error !== null, i.error ? err(i.error) : "NO ERROR");

      const d = await anon.from("cohorts").delete().eq("id", cohId);
      const still = await svc.from("cohorts").select("id").eq("id", cohId);
      t(
        "anon DELETE on cohorts is refused and the row survives",
        d.error !== null || (still.data ?? []).length === 1,
        d.error ? err(d.error) : `row still present: ${(still.data ?? []).length === 1}`,
      );

      // The whole-table half of the is_public check: anon must see ONLY public
      // rows, not every is_active row.
      const all = await anon.from("cohorts").select("id,slug,is_public");
      const rows = (all.data ?? []) as { is_public: boolean; slug: string }[];
      t(
        "every cohort anon can see is is_public — none leaked via is_active",
        all.error === null && rows.every((r) => r.is_public === true),
        all.error ? err(all.error) : rows.filter((r) => !r.is_public).map((r) => r.slug),
      );
    }
  }
}

/** ⚠ BY CAPTURED ID ONLY. Never a filter, never a sweep. */
async function cleanup() {
  console.log("\n── cleanup (by captured id only) ─────────────────────────────");
  const table = async (name: string, ids: string[]) => {
    for (const id of ids) {
      const { data, error } = await svc.from(name).delete().eq("id", id).select("id");
      const n = (data ?? []).length;
      console.log(`  ${error ? "✗" : n === 1 ? "✓" : "!"} ${name} ${id} → ${error ? err(error) : `count=${n}`}`);
      if (error || n !== 1) fail++;
    }
    if (ids.length === 0) console.log(`  · ${name}: nothing to remove`);
  };
  await table("interest_registrations", created.interest);
  await table("announcements", created.announcements);
  await table("cohorts", created.cohorts);
}

try {
  await main();
} finally {
  await cleanup();
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
