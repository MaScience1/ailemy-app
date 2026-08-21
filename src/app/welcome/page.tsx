import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { OnboardingSteps } from "@/components/account/OnboardingSteps";

export const metadata: Metadata = {
  title: "Welcome — Ailemy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Post-signup onboarding (§23).
 *
 * ============================================================================
 * ⚠ ONE QUESTION AT A TIME, AND EVERY ONE SKIPPABLE
 * ============================================================================
 * §23 asks for this to feel like personalisation rather than paperwork. Four
 * questions on one page is a form; one at a time with a visible "skip" is a
 * conversation you can leave.
 *
 * ⚠ AND IT IS A SEPARATE ROUTE, NOT A GATE. A student who closes the tab is
 * signed in and can use everything — nothing here blocks the product. That is
 * why /welcome is reachable and never redirected TO from the auth callback.
 *
 * ⚠ SIGNED-OUT VISITORS ARE SENT AWAY. There is nothing to personalise for
 * somebody with no account, and the questions would have nowhere to save.
 */
export default async function WelcomePage() {
  const session = await getNavSession();
  if (!session) redirect("/login?next=/welcome");

  return (
    <div className="bg-parchment text-ink">
      <SiteNav session={session} />
      <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
          Welcome to Ailemy
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
          Four quick questions, so Ailemy knows where to start.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink/70">
          Every one is optional — skip anything you would rather not answer, and change it later
          in your profile.
        </p>
        <div className="mt-10">
          <OnboardingSteps />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
