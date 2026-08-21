import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { displayName, loadIdentity } from "@/lib/account/identity";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already enforces auth on /dashboard, but defense in depth — if
  // somehow we render here without a user, bounce to login rather than crash.
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  /**
   * ⚠ ONE LADDER, AND IT IS identity.ts's.
   *
   * This page used to read profiles itself and end its ladder at the literal
   * "there" — so an account with no name was greeted "Welcome, there." while
   * /profile, reading the same row through displayName(), deliberately ends at
   * NULL and falls back to a TITLE. Two answers to one question, and the wrong
   * one was the friendlier-looking one: a placeholder reads as though the system
   * knows who you are and got it wrong, which is worse than not greeting a
   * stranger by name.
   *
   * Reading through loadIdentity() also removes the second, divergent profiles
   * query. identity.ts already carries the maybeSingle discipline this page had
   * to state for itself, and its refusals travel with the result.
   */
  const identity = await loadIdentity();
  const name = identity ? displayName(identity) : null;

  for (const r of identity?.refusals ?? []) {
    // Server logs only — surfaces RLS/PostgREST faults without crashing the
    // page, exactly as before. A refusal costs the name, never the page.
    console.error("[dashboard] identity refusal:", r);
  }

  return (
    <div className="flex min-h-screen flex-col bg-parchment text-ink">
      <nav className="border-b border-ink/10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
          <Link
            href="/"
            className="font-display text-xl font-medium tracking-tight text-ink"
          >
            Ailemy<span className="text-flask">.</span>
          </Link>
          <SignOutButton />
        </div>
      </nav>

      <main className="flex flex-1 items-start">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
            Dashboard
          </p>

          {/* ⚠ NO NAME MEANS NO NAME — "Welcome." is a complete sentence. And
              an address is set in mono so it does not masquerade as one, which
              is the same treatment /profile gives it. */}
          <h1 className="font-display mt-6 max-w-[760px] text-4xl font-medium leading-[1.1] tracking-tight md:text-6xl">
            {name === null ? (
              "Welcome."
            ) : name.kind === "name" ? (
              <>Welcome, {name.value}.</>
            ) : (
              <>
                Welcome,{" "}
                <span className="font-mono text-2xl md:text-4xl">{name.value}</span>.
              </>
            )}
          </h1>

          {/* ⚠ THE ROLE LINE IS GONE, NOT RELOCATED. It read profiles.role — the
              legacy 0001 column — while every authorisation gate in the app now
              resolves public.user_roles (0027). Printing the losing side of that
              split to the student was telling them something the system does not
              act on. Nothing here needed it. */}
          <p className="mt-6 max-w-[620px] text-lg leading-relaxed text-ink/70">
            You&apos;re signed in. Your courses, tuition and progress live on your
            profile.
          </p>

          <Link
            href="/profile"
            className="mt-8 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Open my profile →
          </Link>
        </div>
      </main>
    </div>
  );
}
