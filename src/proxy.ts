import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 Proxy (formerly Middleware — renamed in v16 to clarify network
 * boundary). Runs on every request, refreshes the Supabase session cookie,
 * and enforces protection for /app/* and /dashboard.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  /**
   * Match all paths except Next internals and static assets. Auth cookies need
   * to refresh on real page loads, not on /_next/* or image requests.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
