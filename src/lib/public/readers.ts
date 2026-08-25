import "server-only";

import { createClient } from "@supabase/supabase-js";

import { createClient as createServerClient } from "@/lib/supabase/server";

import {
  FALLBACK_COHORTS,
  activeAnnouncement,
  announcementFromRow,
  chooseCohorts,
  cohortFromRow,
  type Announcement,
  type AnnouncementRow,
  type Cohort,
  type Loaded,
} from "@/lib/public/catalogue";

/**
 * The public site's DB-first readers.
 *
 * ============================================================================
 * ⚠ THESE READ AS anon, ON PURPOSE
 * ============================================================================
 * A cookie-less anonymous client — not the service role, and not the visitor's
 * session. Three reasons, and the first is the important one:
 *
 *   1. THE PUBLIC PAGE IS THE PUBLIC POLICY'S TEST. Reading the catalogue with
 *      a key that bypasses RLS would show the founder rows that 0041's
 *      cohorts_read_public would hide from an actual visitor. The page would
 *      look right and be wrong, and the failure would only appear to someone
 *      who was not signed in — i.e. to everyone except the person checking.
 *   2. A service-role key on a page rendered for the public is one import
 *      mistake away from being the page's data source for everything.
 *   3. Cookie-less keeps these pages cacheable: reading cookies() would force
 *      every homepage render dynamic for data that is identical for everyone.
 *
 * ⚠ EVERY READER FALLS BACK, AND EVERY READER SAYS SO. `source` is part of the
 * return value, not a log line: a test asserts the fallback fired because the
 * table was absent rather than inferring it from a coincidentally-identical
 * result, and a page can surface it. A fallback that cannot be distinguished
 * from a successful read is a failure that reports success.
 */

// PostgREST/Postgres codes that mean "the migration has not been applied".
// Kept separate from every other failure because it is the only one with an
// action attached: run the SQL.
const NOT_MIGRATED = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);

type DbFailure = { kind: "not-migrated" | "denied" | "error"; detail: string };

function classify(error: { code?: string; message?: string } | null): DbFailure {
  const code = error?.code ?? "";
  const message = error?.message ?? "unknown error";
  if (NOT_MIGRATED.has(code)) return { kind: "not-migrated", detail: `${code}: ${message}` };
  if (code === "42501") return { kind: "denied", detail: `${code}: ${message}` };
  return { kind: "error", detail: code ? `${code}: ${message}` : message };
}

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ============================================================================
// COHORTS
// ============================================================================

export type CohortLoad = Loaded<readonly Cohort[]> & { refusals: string[] };

/**
 * The tuition catalogue, database first.
 *
 * ⚠ REFUSALS TRAVEL WITH THE RESULT. A row the mapper dropped — no subject, an
 * unknown status — is not a log line that scrolls away; it comes back with the
 * data so a page or a check can say "four rows, one refused, here is why".
 * Partial success reported as success is the failure mode this whole layer was
 * rewritten to remove.
 */
/**
 * ⚠ AN ENROLLED STUDENT'S OWN COHORT IS NOT "PUBLIC CONTENT".
 * ============================================================================
 * The catalogue is anon-readable and gated on is_public — correct for a
 * stranger browsing. But an enrolled student's personal calendar resolved
 * through this same list, so the moment a full cohort was set is_public=false
 * — the obvious admin action when 20 seats are gone — every enrolled student's
 * calendar went blank. Their enrolment row was untouched and nothing on screen
 * connected the two.
 *
 * `entitledSlugs` are cohorts the CALLER has already proved the viewer belongs
 * to, by reading cohort_enrolments under that viewer's own session. They are
 * fetched with the authenticated client, where the "cohorts readable" policy
 * (0041) allows `is_active OR is_staff()` with no is_public condition — so the
 * database already permitted this and only the application was refusing.
 *
 * ⚠ IT IS NOT AN AUTHORISATION BYPASS. The slugs come from the viewer's own
 * enrolments; RLS still applies to the read. Passing a slug the viewer is not
 * enrolled on gets a cohort they could see anyway, or nothing.
 */
export async function loadCohorts(
  opts: { entitledSlugs?: readonly string[] } = {},
): Promise<CohortLoad> {
  /**
   * ⚠ THE AUTHENTICATED CLIENT WHEN THE VIEWER HAS ENTITLEMENTS. anon holds
   * only cohorts_read_public, so a non-public cohort is invisible to it no
   * matter what the query asks for — the filter would look fixed and the row
   * would still be missing.
   */
  const entitled = (opts.entitledSlugs ?? []).filter((x) => /^[a-z0-9-]+$/.test(x));
  const db = entitled.length > 0 ? await createServerClient() : anonClient();
  if (!db) {
    return { data: FALLBACK_COHORTS, source: "fallback", reason: "supabase env vars absent", refusals: [] };
  }

  // ⚠ NOT .select("*"). Naming the columns means a missing one is an error
  // with the column's name in it, rather than an undefined that becomes a
  // default three layers later.
  const { data, error } = await db
    .from("cohorts")
    .select(
      "slug,title,subject,qualification,price_pence,price_qar,currency,hours_per_week," +
        "sessions_per_week,schedule_summary,onboarding_on,starts_on,ends_on,seat_cap," +
        "status,enrolment_url,summary,features,display_order,year_group",
    )
    .or(
      /**
       * ⚠ OR, NOT A SECOND QUERY. Two reads would need merging and de-duping,
       * and a partial failure would silently drop the student's own cohort —
       * exactly the failure this change exists to remove.
       */
      entitled.length > 0
        ? `is_public.eq.true,slug.in.(${entitled.join(",")})`
        : "is_public.eq.true",
    )
    .order("display_order", { ascending: true })
    .order("slug", { ascending: true });

  if (error) {
    const f = classify(error);
    return {
      data: FALLBACK_COHORTS,
      source: "fallback",
      reason: f.kind === "not-migrated" ? `0041 not applied (${f.detail})` : f.detail,
      refusals: [],
    };
  }

  const kept: Cohort[] = [];
  const refusals: string[] = [];
  // The select list is assembled from several strings, so supabase-js cannot
  // parse it at the type level and infers a placeholder. The row shape is
  // checked at runtime by cohortFromRow, which is where it belongs.
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const m = cohortFromRow(row);
    if (m.ok) kept.push(m.value);
    else refusals.push(m.reason);
  }

  const chosen = chooseCohorts(kept, FALLBACK_COHORTS);
  return { ...chosen, refusals };
}

// ============================================================================
// ANNOUNCEMENTS
// ============================================================================

export type AnnouncementLoad = Loaded<Announcement | null> & { refusals: string[] };

/**
 * The one announcement the bar should show, or none.
 *
 * ⚠ EMPTY IS A REAL ANSWER HERE, UNLIKE COHORTS. Nobody has an announcement
 * running most of the time, and the bar must vanish. So a successful query
 * returning zero rows is `source: "database"` with null data — NOT a fallback —
 * and only a failure falls back (to null, which looks the same on screen and is
 * a different fact in the return value).
 *
 * ⚠ THE WINDOW IS FILTERED TWICE. 0039's announcements_read_public_bar already
 * hides disabled and out-of-window rows from anon; activeAnnouncement() filters
 * again in JS. The policy is the security boundary and the JS is not pretending
 * to be one — it exists so the same rule is exercised by a test that needs no
 * database, and so a signed-in staff session (which sees more rows through
 * 0022's policy) still renders the public bar.
 */
export async function loadAnnouncement(now = new Date()): Promise<AnnouncementLoad> {
  const db = anonClient();
  if (!db) {
    return { data: null, source: "fallback", reason: "supabase env vars absent", refusals: [] };
  }

  const { data, error } = await db
    .from("announcements")
    .select("id,title,body,cta_label,link_url,priority,enabled,starts_at,ends_at")
    .eq("enabled", true)
    .order("priority", { ascending: false })
    .limit(20);

  if (error) {
    const f = classify(error);
    return {
      data: null,
      source: "fallback",
      reason: f.kind === "not-migrated" ? `0039 not applied (${f.detail})` : f.detail,
      refusals: [],
    };
  }

  const rows: AnnouncementRow[] = [];
  const refusals: string[] = [];
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const m = announcementFromRow(row);
    if (m.ok) rows.push(m.value);
    else refusals.push(m.reason);
  }

  return { data: activeAnnouncement(rows, now), source: "database", refusals };
}
