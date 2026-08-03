import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Enrolment gate for the /intensive route group.
 *
 * All reads go through the RLS-scoped *user* Supabase client (never the
 * service-role client) — the cohort_enrolments RLS policy in migration 0009
 * ("own enrolment") already restricts a caller to their own row, so a signed-in
 * student can only ever see their own enrolment and never another cohort
 * member's. The service-role client is deliberately not used here so this
 * student-reachable path can never bypass RLS.
 *
 * Fails CLOSED: any error (including the 0009 tables not existing yet on a DB
 * that hasn't had the migration applied) resolves to `pending`, not `enrolled`.
 */

export type Enrolment = {
  id: string;
  cohort_id: string;
  status: "paid" | "active" | "completed";
  email: string;
};

export type IntensiveAccess =
  | { state: "anon" }
  | { state: "pending"; email: string }
  | { state: "enrolled"; email: string; enrolment: Enrolment };

const ACTIVE_STATUSES = ["paid", "active", "completed"] as const;

export async function getIntensiveAccess(): Promise<IntensiveAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { state: "anon" };

  // First-login link: attach any paid enrolment row that was inserted by email
  // (before this user had an account) to this user_id. Idempotent — the SQL
  // function only touches rows where user_id is null and the email matches.
  // A missing function (un-migrated DB) returns an error we intentionally
  // ignore; the query below then falls through to `pending`.
  await supabase.rpc("claim_enrolment");

  const { data: enrolment, error } = await supabase
    .from("cohort_enrolments")
    .select("id, cohort_id, status, email")
    .eq("user_id", user.id)
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .maybeSingle();

  if (error || !enrolment) {
    return { state: "pending", email: user.email ?? "" };
  }

  return {
    state: "enrolled",
    email: user.email ?? "",
    enrolment: enrolment as Enrolment,
  };
}
