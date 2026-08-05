import { NextResponse, type NextRequest } from "next/server";

import { assertAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAPERS_BUCKET,
  buildPaperPath,
  isPaperFileKind,
  isUploadGroupId,
} from "@/lib/storage/paper-uploads";

/**
 * POST /api/admin/papers/upload-url — mint a one-shot signed upload URL.
 *
 * WHY THIS EXISTS: PDFs used to be multipart-POSTed into the createPastPaper
 * Server Action, buffered with file.arrayBuffer(), and only then forwarded to
 * Storage. That capped uploads at Next's default Server Action body limit of
 * 1 MB — and even raising it only moves the wall to Vercel's 4.5 MB request-body
 * cap, which is not configurable. A real question paper plus a mark scheme
 * clears both. The browser now uploads straight to Storage and the form submits
 * only the resulting paths, so the request body is a few hundred bytes.
 *
 * THE SERVER OWNS THE PATH. The client sends a kind and a group id; it never
 * proposes a key. The action that later persists the path re-validates it
 * against the same shape (isValidPaperPath), because a client that can choose
 * where it uploads could otherwise point a row at any object in the bucket.
 *
 * assertAdmin() is the first statement: this route is publicly reachable, and a
 * signed upload URL is a write capability. A non-admin gets an opaque 404 —
 * the same treatment /api/admin/edit-mode gives, so the route's existence is
 * not confirmed to someone probing.
 */
export async function POST(request: NextRequest) {
  try {
    await assertAdmin();
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  let body: { kind?: unknown; groupId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const kind = String(body.kind ?? "");
  if (!isPaperFileKind(kind)) {
    return NextResponse.json(
      { error: "Unknown file kind" },
      { status: 400 },
    );
  }

  // On edit this is the existing past_papers id; on create the client mints a
  // v4 UUID once per form and that value becomes the row id, so the object
  // never has to be moved after the insert.
  const groupId = String(body.groupId ?? "");
  if (!isUploadGroupId(groupId)) {
    return NextResponse.json(
      { error: "groupId must be a UUID" },
      { status: 400 },
    );
  }

  const path = buildPaperPath(groupId, kind);

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(PAPERS_BUCKET)
    // The bucket is public with a 50 MB limit and application/pdf pinned as the
    // only allowed MIME type, so Storage rejects a non-PDF itself.
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[papers/upload-url] could not sign upload", error);
    return NextResponse.json(
      { error: "Could not prepare the upload. Try again." },
      { status: 502 },
    );
  }

  // `path` is returned so the form can submit exactly what was signed, and
  // `token` so the browser can PUT to it. Both are single-use for this key.
  return NextResponse.json({ path, token: data.token });
}
