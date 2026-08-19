import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";

import { ResetPasswordForm } from "./reset-password-form";

/**
 * Step 2 of password recovery (§56) — where the recovery link lands.
 *
 * ⚠ DELIBERATELY NOT IN THE PROXY'S PROTECTED LIST. The recovery link creates a
 * real session before this renders, so gating it would work by accident; but it
 * must also not be in the "authenticated users get bounced away" list that
 * /login and /signup are in, or the person who just clicked the link would be
 * redirected off the only page that can change their password.
 */
export const metadata: Metadata = {
  title: "Set a new password — Ailemy",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
