import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";

import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * Step 1 of password recovery (§56).
 *
 * ⚠ THIS FLOW DID NOT EXIST. There was no /forgot-password route, no link on
 * /login, and no resetPasswordForEmail call anywhere in the codebase — while
 * supabase/auth-templates/reset-password.html sat ready and unused. A user who
 * forgot their password had no route back into their account at all.
 */
export const metadata: Metadata = {
  title: "Reset your password — Ailemy",
  description: "Request a link to set a new Ailemy password.",
  // Nothing here should be indexed or followed.
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
