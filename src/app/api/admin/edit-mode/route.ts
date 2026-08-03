import { NextResponse, type NextRequest } from "next/server";

import { assertAdmin } from "@/lib/admin/auth";
import { EDIT_MODE_COOKIE } from "@/lib/admin/edit-mode";

/**
 * POST /api/admin/edit-mode  — toggle the inline edit-mode cookie.
 *
 * Driven by a plain <form> in AdminOverlay, so the toggle needs ZERO client
 * JavaScript. That matters: a React toggle button would place its module in
 * the root layout's client graph, and Turbopack then ships that chunk to every
 * visitor — including logged-out students — even when the component renders
 * null. A form post avoids the bundle entirely.
 *
 * assertAdmin() is the first statement: this route is publicly reachable, so
 * the cookie must never be settable by a non-admin.
 */
export async function POST(request: NextRequest) {
  try {
    await assertAdmin();
  } catch {
    // Deliberately opaque — don't confirm the route's purpose to non-admins.
    return new NextResponse("Not found", { status: 404 });
  }

  const form = await request.formData();
  const desired = String(form.get("on") ?? "") === "1";
  const rawNext = String(form.get("next") ?? "/");

  // Only allow same-origin relative paths, so this can't be used as an
  // open redirect.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const res = NextResponse.redirect(new URL(next, request.url), {
    status: 303, // See Other — turns the POST into a GET on the target page.
  });

  if (desired) {
    res.cookies.set(EDIT_MODE_COOKIE, "1", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
    });
  } else {
    res.cookies.delete(EDIT_MODE_COOKIE);
  }

  return res;
}
