import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/sign-out — clear the session and return to a public page.
 *
 * A route handler driven by a plain <form>, not a client-side
 * supabase.auth.signOut() call, so the site nav needs ZERO extra JavaScript.
 * That matters here specifically: SiteNav renders on every marketing page, and
 * importing @/lib/supabase/client into it would pull the Supabase browser
 * client into the bundle for every visitor — including logged-out ones who can
 * never use it. Same reasoning AdminOverlay documents for the edit-mode toggle.
 * It also means sign-out still works with JavaScript disabled.
 *
 * (/dashboard keeps its own client-side SignOutButton. That page is already
 * behind auth and already loads the browser client, so there is nothing to be
 * saved by changing it, and this commit leaves it alone.)
 *
 * NOT GUARDED, deliberately: signing out an already-signed-out visitor is a
 * no-op, and there is nothing to leak. Cookie writes are permitted in a route
 * handler, unlike in a Server Component render, so setAll actually applies here.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const form = await request.formData().catch(() => null);
  const next = safeNext(form ? String(form.get("next") ?? "") : "");

  // 303 so the browser follows with GET — a 307 would replay the POST.
  return NextResponse.redirect(new URL(next ?? "/", request.url), 303);
}

/**
 * Same-origin relative paths only, so this cannot be turned into an open
 * redirect. Mirrors safeNext() in src/app/auth/callback/route.ts.
 */
function safeNext(raw: string): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}
