"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const FORM_INPUT_CLASS =
  "h-10 rounded-md border-ink/15 bg-snow text-ink focus-visible:border-flask focus-visible:ring-flask/30 md:text-sm";

/**
 * ⚠ THE ANSWER IS THE SAME WHETHER THE ACCOUNT EXISTS OR NOT.
 *
 * This form never says "no account with that email". Supabase's
 * resetPasswordForEmail deliberately does not error on an unknown address, and
 * this component must not reintroduce the difference: a page that answers
 * differently for a registered address is an account-enumeration oracle, which
 * matters most for exactly the people who reuse passwords.
 *
 * A genuine transport failure IS shown — that is a fault on our side and the
 * user needs to know their request did not go anywhere.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    // The link lands on the existing callback, which exchanges the code for a
    // session and forwards to ?next=. Reusing it means recovery gets the same
    // validated redirect handling as every other sign-in path rather than a
    // second, parallel implementation of the same thing.
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (sendError) {
      setError("We could not send the email just now. Please try again in a moment.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-ink">Check your email</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink/70">
          If an Ailemy account exists for <strong className="text-ink">{email.trim()}</strong>, we
          have sent a link to set a new password. It expires shortly, so use it soon.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink/60">
          Nothing arrived? Check spam, then{" "}
          <button
            type="button"
            onClick={() => { setSent(false); setError(null); }}
            className="underline underline-offset-2 hover:text-ink"
          >
            try a different address
          </button>
          .
        </p>
        <p className="mt-8 text-sm">
          <Link href="/login" className="underline underline-offset-2 hover:text-ink">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink">Reset your password</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink/70">
        Enter the email address on your Ailemy account and we will send you a link to set a new
        password.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
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
            onChange={(e) => setEmail(e.target.value)}
            className={FORM_INPUT_CLASS}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink/60">
        Remembered it?{" "}
        <Link href="/login" className="underline underline-offset-2 hover:text-ink">
          Sign in
        </Link>
      </p>
    </div>
  );
}
