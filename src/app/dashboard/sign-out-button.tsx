"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side sign out. Calls supabase.auth.signOut() to clear the session
 * cookie, then bounces to / and refreshes so the proxy + server components
 * re-render in the unauthenticated state.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="h-9 rounded-md border border-ink/15 bg-transparent px-4 text-sm font-medium text-ink hover:bg-ink/5"
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
