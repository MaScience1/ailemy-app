"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "@/lib/supabase/client";

type Role = "student" | "parent";

const FORM_INPUT_CLASS =
  "h-10 rounded-md border-ink/15 bg-snow text-ink focus-visible:border-flask focus-visible:ring-flask/30 md:text-sm";

/**
 * ⚠ PREFILL ONLY, AND THE AUTH CALL IS UNTOUCHED. The quick-signup drawer on
 * the homepage collects name, year group, subjects and country so that THIS
 * form only has to ask for a password — which is the short-signup requirement.
 * Nothing here changes how an account is created; the params seed two initial
 * useState values and are then ignored.
 *
 * ⚠ NO PASSWORD IS EVER READ FROM THE URL, and none is ever put there. A query
 * string lands in browser history and in every proxy log between here and the
 * server. A name is fine there; a credential is not.
 *
 * ⚠ Suspense, BECAUSE useSearchParams OPTS A ROUTE INTO CLIENT RENDERING. Next
 * requires the boundary, and without it the build fails on this page rather
 * than degrading — which is the correct direction, but only if the boundary
 * exists.
 */
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [fullName, setFullName] = useState(params.get("name") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName, role },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    router.push("/auth/verify-email");
  }

  return (
    <AuthShell>
      {/* ── §24 — WHY AN ACCOUNT, NOT JUST HOW ──────────────────────────
          ⚠ EVERY LINE MAPS TO SOMETHING A STUDENT CAN DO THE DAY THEY SIGN IN.
          No "AI tutor", no "guaranteed grade", nothing that needs a feature
          which does not exist. The brief is explicit that claims must
          correspond to real or legitimately-coming functionality — so
          "get answers marked" is here and "personalised revision plan" is not,
          because the second has no writer behind it yet. */}
      <ul className="mb-6 grid gap-1.5 text-[13px] text-ink/70 sm:grid-cols-2">
        {[
          "Save your progress",
          "Get answers marked",
          "See weak topics",
          "Practise past papers",
          "Track your revision",
          "Join live tuition",
        ].map((b) => (
          <li key={b} className="flex items-start gap-1.5">
            <span aria-hidden className="mt-px text-ink/35">✓</span>
            {b}
          </li>
        ))}
      </ul>
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
        Create your account
      </p>
      <h1 className="font-display mt-4 text-3xl font-medium leading-tight tracking-tight md:text-4xl">
        Join Ailemy.
      </h1>
      <p className="mt-3 text-sm text-ink/60">
        {/* ⚠ §57 — was "IB, IGCSE and A-Level". */}
        Built for Pearson Edexcel GCSE, International GCSE and IAL students.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
        {error && (
          <p className="text-sm font-medium text-flask" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={FORM_INPUT_CLASS}
          />
        </div>

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
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={FORM_INPUT_CLASS}
          />
          <p className="text-xs text-ink/50">At least 8 characters.</p>
        </div>

        <div className="space-y-3 pt-2">
          <Label>I am a…</Label>
          <RadioGroup
            value={role}
            onValueChange={(value) => setRole(value as Role)}
            className="gap-3"
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem
                id="role-student"
                value="student"
                className="data-checked:border-flask data-checked:bg-flask data-checked:text-snow"
              />
              <Label htmlFor="role-student" className="font-normal text-ink/80">
                I&apos;m a student
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem
                id="role-parent"
                value="parent"
                className="data-checked:border-flask data-checked:bg-flask data-checked:text-snow"
              />
              <Label htmlFor="role-parent" className="font-normal text-ink/80">
                I&apos;m a parent
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-md bg-flask text-sm font-medium text-snow [a]:hover:bg-flask/90 hover:bg-flask/90"
        >
          {loading ? "Creating account…" : "Create account"}
        </Button>

        <p className="pt-2 text-center text-sm text-ink/60">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-ink underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
