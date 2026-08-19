"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { postSignInTarget } from "@/lib/auth/safe-next";

const FORM_INPUT_CLASS =
  "h-10 rounded-md border-ink/15 bg-snow text-ink focus-visible:border-flask focus-visible:ring-flask/30 md:text-sm";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Defaults to "/" now, not "/dashboard". An explicit ?next= still wins, so a
  // student bounced here from a gated page lands where they intended.
  //
  // postSignInTarget also VALIDATES it. This previously pushed the raw query
  // value straight into router.push(), so /login?next=https://evil.com would
  // navigate a freshly-authenticated user off-site. The callback route already
  // guarded against that; this path did not.
  const next = postSignInTarget(searchParams.get("next"));
  // Set by /reset-password after a successful change. The reset flow signs the
  // user out deliberately, so they arrive here and need to know the change
  // worked — otherwise the sign-out reads as the reset having failed.
  const justReset = searchParams.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    // Push then refresh — the server-side proxy/route components need to
    // re-read the session cookie that Supabase just wrote.
    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
        Welcome back
      </p>
      <h1 className="font-display mt-4 text-3xl font-medium leading-tight tracking-tight md:text-4xl">
        Sign in.
      </h1>
      <p className="mt-3 text-sm text-ink/60">
        Continue your science learning pathway.
      </p>

      {justReset && (
        <p
          role="status"
          className="mt-6 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          Your password has been changed. Sign in with it now.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
        {error && (
          <p className="text-sm font-medium text-flask" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FORM_INPUT_CLASS}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={FORM_INPUT_CLASS}
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-md bg-flask text-sm font-medium text-snow [a]:hover:bg-flask/90 hover:bg-flask/90"
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        <div className="flex flex-col items-center gap-3 pt-2 text-sm">
          <Link
            href="/signup"
            className="text-ink/70 transition-colors hover:text-ink"
          >
            New to Ailemy?{" "}
            <span className="font-medium underline-offset-4 hover:underline">
              Create an account
            </span>
          </Link>
          {/* ⚠ §56 — THIS WAS href="#". The link was here the whole time and
              went nowhere: the worst version of a missing feature, because it
              tells a locked-out user that recovery exists and then does
              nothing. It now points at the real flow. */}
          <Link
            href="/forgot-password"
            className="text-xs text-ink/50 transition-colors hover:text-ink/70"
          >
            Forgot password?
          </Link>
        </div>
      </form>
    </div>
  );
}
