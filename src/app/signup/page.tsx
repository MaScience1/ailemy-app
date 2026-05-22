"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
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
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
        Create your account
      </p>
      <h1 className="font-display mt-4 text-3xl font-medium leading-tight tracking-tight md:text-4xl">
        Join Ailemy.
      </h1>
      <p className="mt-3 text-sm text-ink/60">
        Built for IB, IGCSE and A-Level students.
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
            onValueChange={setFullName}
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
            onValueChange={setEmail}
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
            onValueChange={setPassword}
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
