import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
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

  // maybeSingle (not single) so a missing/blocked row returns null rather than
  // throwing. Single's no-row error was being swallowed by the destructure,
  // silently masking real failures and falling through to the email.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    // Server logs only — surfaces RLS/PostgREST issues without crashing the
    // page. The fallback ladder below still renders a usable dashboard.
    console.error("[dashboard] failed to load profile", profileError);
  }

  // Display name priority:
  //   1. profiles.full_name (trimmed, non-empty)
  //   2. auth user email
  //   3. literal "there" — only if both above are missing
  const trimmedFullName = profile?.full_name?.trim();
  const displayName =
    trimmedFullName && trimmedFullName.length > 0
      ? trimmedFullName
      : (user.email ?? "there");

  const role = profile?.role ?? "student";

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

          <h1 className="font-display mt-6 max-w-[760px] text-4xl font-medium leading-[1.1] tracking-tight md:text-6xl">
            Welcome, {displayName}.
          </h1>

          <p className="mt-6 max-w-[620px] text-lg leading-relaxed text-ink/70">
            You&apos;re signed in as a {role}.
          </p>
        </div>
      </main>
    </div>
  );
}
