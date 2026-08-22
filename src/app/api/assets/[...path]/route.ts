import { NextResponse, type NextRequest } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ASSETS_BUCKET = "assets";
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * ⚠ SERVABLE EXTENSIONS ARE AN ALLOWLIST, AND .pptx IS THE REASON IT EXISTS.
 *
 * This route signs ANY path under lessons/ once access passes — which was fine
 * while the bucket held only rendered derivatives, and stops being fine the
 * moment an original PowerPoint lands anywhere under a lesson prefix: a
 * signed-in student could then mint a 60-second URL to the founder's source
 * file (§70). Sources are stored under the `lesson-sources/` prefix, which
 * this route already refuses — this allowlist is the SECOND fence, so both a
 * misplaced upload AND a route regression have to happen before a source
 * leaks. Derivatives are images, PDFs and nothing else; JSON is deliberately
 * absent so a deck's manifest (and anything else structural) stays
 * server-side.
 */
const SERVABLE_EXTENSIONS = /\.(png|webp|jpe?g|svg|pdf)$/i;

/**
 * GET /api/assets/<path...>
 *
 * Serves a private-bucket asset by:
 *   1. Looking up the owning lesson (path convention: lessons/<lesson_id>/…)
 *   2. Enforcing lesson.access — 'free' allows anon; 'paid' requires a session
 *   3. Minting a 60-second signed URL and 307-redirecting to it
 *
 * The signed URL is deliberately short-lived: it can be shared briefly but
 * is not a persistent leak vector. The bucket itself has no anon policies —
 * a stolen path is useless without going through this handler.
 *
 * Only "lessons/" prefixed paths are supported today. Other prefixes 403 so
 * a future admin adding a new asset type has to explicitly wire the access
 * check here rather than accidentally exposing everything.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  if (!parts || parts.length === 0) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }
  const path = parts.join("/");

  if (parts[0] !== "lessons" || parts.length < 3) {
    return NextResponse.json({ error: "unsupported asset path" }, { status: 403 });
  }
  if (!SERVABLE_EXTENSIONS.test(parts[parts.length - 1])) {
    // ⚠ 403 BY EXTENSION BEFORE ANY LOOKUP — see SERVABLE_EXTENSIONS. A
    // .pptx under a lesson path must be unreachable even if it exists.
    return NextResponse.json({ error: "unsupported asset type" }, { status: 403 });
  }
  const lessonId = parts[1];

  // Access lookup via admin client — the lessons row itself is public-readable
  // per RLS, but using admin here keeps this route's data access consistent
  // and future-proofed if lesson-level RLS tightens.
  const admin = createAdminClient();
  const { data: lesson, error: lookupError } = await admin
    .from("lessons")
    .select("id, access, status")
    .eq("id", lessonId)
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!lesson) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Paid lessons require a session; free lessons allow anon.
  if (lesson.access === "paid") {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "authentication required" }, { status: 401 });
    }
  }

  const { data: signed, error: signError } = await admin.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signError?.message ?? "sign failed" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl, 307);
}
