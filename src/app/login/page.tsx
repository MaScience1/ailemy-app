import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

/**
 * Server page shell. The actual form is a Client Component because it reads
 * `?next=` via useSearchParams — that hook requires a Suspense boundary.
 */
export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
