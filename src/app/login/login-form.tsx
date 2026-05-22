"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const FORM_INPUT_CLASS =
  "h-10 rounded-md border-ink/15 bg-snow text-ink focus-visible:border-flask focus-visible:ring-flask/30 md:text-sm";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

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
            onValueChange={setEmail}
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
            onValueChange={setPassword}
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
          <a
            href="#"
            className="text-xs text-ink/50 transition-colors hover:text-ink/70"
          >
            Forgot password?
          </a>
        </div>
      </form>
    </div>
  );
}
