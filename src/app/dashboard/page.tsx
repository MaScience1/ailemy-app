import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

type SearchParams = Promise<{ welcome?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const showWelcome = params.welcome === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already enforces auth on /dashboard, but defense in depth — if
  // somehow we render here without a user, bounce to login rather than crash.
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name?.trim() || user.email || "there";
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

      {showWelcome && (
        <div className="border-b border-signal/40 bg-signal/15">
          <div className="mx-auto w-full max-w-7xl px-6 py-3 sm:px-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/75">
              Welcome to Ailemy. Your account is verified.
            </p>
          </div>
        </div>
      )}

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
