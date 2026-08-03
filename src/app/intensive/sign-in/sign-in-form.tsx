"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const FORM_INPUT_CLASS =
  "h-11 rounded-md border-line bg-snow text-ink focus-visible:border-flask focus-visible:ring-flask/30 md:text-sm";

/**
 * Magic-link (OTP) sign-in for the cohort. No passwords — the founder inserts a
 * cohort_enrolments row by email, the student requests a link, signs in, and
 * claim_enrolment() attaches them on first landing. `shouldCreateUser` defaults
 * to true so a student who has never had an Ailemy account can still sign in;
 * a non-enrolled account simply lands on the access-pending page.
 */
export function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus("sending");

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/intensive`,
      },
    });

    if (otpError) {
      setStatus("idle");
      setError(otpError.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div>
        <p className="ai-spec">Check your inbox</p>
        <h1 className="ai-display mt-4 text-3xl md:text-4xl">Link sent.</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-60">
          We&apos;ve emailed a sign-in link to{" "}
          <span className="font-medium text-ink">{email.trim()}</span>. Open it
          on this device to enter the intensive. The link expires after a short
          while — request another below if it lapses.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setError(null);
          }}
          className="mt-6 text-sm font-medium text-flask underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="ai-spec">Chemistry AS Exam Intensive</p>
      <h1 className="ai-display mt-4 text-3xl md:text-4xl">Sign in.</h1>
      <p className="mt-3 text-sm text-ink-60">
        Enter the email you enrolled with. We&apos;ll send a one-tap sign-in
        link — no password to remember.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
        {error && (
          <p className="text-sm font-medium text-danger" role="alert">
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
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FORM_INPUT_CLASS}
          />
        </div>

        <Button
          type="submit"
          disabled={status === "sending" || email.trim().length === 0}
          className="h-11 w-full rounded-md bg-flask text-sm font-medium text-snow hover:bg-flask/90"
        >
          {status === "sending" ? "Sending…" : "Email me a sign-in link"}
        </Button>

        <p className="pt-2 text-xs leading-relaxed text-ink-40">
          Enrolled but can&apos;t get in?{" "}
          <a
            href="mailto:mascience15@gmail.com?subject=Intensive%20access"
            className="text-ink-60 underline-offset-4 hover:underline"
          >
            Email us
          </a>
          .
        </p>
      </form>
    </div>
  );
}
