import { redirect } from "next/navigation";

import { getIntensiveAccess } from "@/lib/intensive/enrolment";
import { PendingAccess } from "../_components/PendingAccess";

/**
 * The paid gate for everything under /intensive/(gated) — the home and every
 * week page. Runs server-side on every navigation into the group:
 *
 *   • not signed in            → /intensive/sign-in
 *   • signed in, not enrolled  → access-pending page (no week content rendered)
 *   • signed in + enrolled     → the requested page
 *
 * Because this is a Server Component gate, an un-enrolled email cannot reach any
 * child page's data — and the week pages additionally mint Mux/storage URLs
 * only after their own enrolment + release checks, so there is no URL a
 * non-enrolled user can hit to pull cohort content.
 */
export default async function GatedIntensiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getIntensiveAccess();

  if (access.state === "anon") redirect("/intensive/sign-in");
  if (access.state === "pending") return <PendingAccess email={access.email} />;

  return <>{children}</>;
}
