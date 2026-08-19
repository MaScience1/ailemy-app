"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const FORM_INPUT_CLASS =
  "h-10 rounded-md border-ink/15 bg-snow text-ink focus-visible:border-flask focus-visible:ring-flask/30 md:text-sm";

/** Matches /signup. One rule, so a reset cannot set a password signup would reject. */
const MIN_LENGTH = 8;

type Ready = "checking" | "ready" | "no-session";

export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState<Ready>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * ⚠ THE FORM IS NOT SHOWN UNTIL A RECOVERY SESSION EXISTS.
   *
   * updateUser() with no session fails with an opaque auth error, which reads
   * to a user as "my new password was rejected" rather than "your link has
   * expired". Checking first lets the page say the true thing, and means an
   * expired link ends at "request a new one" instead of a dead form.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!alive) return;
      setReady(!sessionError && data.session ? "ready" : "no-session");
    })();
    return () => { alive = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    // Checked here rather than only with a pattern attribute: a mistyped
    // confirmation on the one form that cannot be retried without a fresh
    // email is worth catching properly.
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError(
        /session|jwt|expire/i.test(updateError.message)
          ? "That reset link has expired. Request a new one and try again."
          : updateError.message,
      );
      return;
    }

    /**
     * ⚠ SIGNED OUT ON PURPOSE, THEN SENT TO SIGN IN.
     *
     * Supabase leaves the recovery session active after updateUser, so staying
     * put would drop them into the site still authenticated by the emailed
     * link. Ending that session means the new password is proved once, by them,
     * and a recovery link that leaked cannot keep a live session behind it.
     */
    await supabase.auth.signOut();
    router.push("/login?reset=1");
  }

  if (ready === "checking") {
    return <p className="text-sm text-ink/60">Checking your link…</p>;
  }

  if (ready === "no-session") {
    return (
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-ink">
          This link is no longer valid
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink/70">
          Password reset links expire shortly after they are sent, and can only be used once.
          Request a fresh one and it will work.
        </p>
        <Link
          href="/forgot-password"
          className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment hover:bg-ink/90"
        >
          Send a new link →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink">Set a new password</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink/70">
        Choose a password you have not used elsewhere. You will sign in with it straight after.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password" type="password" autoComplete="new-password"
            minLength={MIN_LENGTH} required value={password}
            onChange={(e) => setPassword(e.target.value)} className={FORM_INPUT_CLASS}
          />
          <p className="text-xs text-ink/50">At least {MIN_LENGTH} characters.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm" type="password" autoComplete="new-password"
            minLength={MIN_LENGTH} required value={confirm}
            onChange={(e) => setConfirm(e.target.value)} className={FORM_INPUT_CLASS}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Saving…" : "Set password and sign in"}
        </Button>
      </form>
    </div>
  );
}
