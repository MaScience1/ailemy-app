import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { assertAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/deck-preview/<slug>/v<k>/frames/<frame>.png
 *
 * Serves a LOCAL ingest bundle's frames to the ADMIN preview page (§9, §64) —
 * the "Ready for review" state before anything is uploaded or published.
 * Students never touch this route: assertAdmin() is the first statement and
 * throws for anyone else, exactly like every other admin route.
 *
 * ⚠ CONFINEMENT IS CHECKED TWICE. The path is rebuilt from validated segments
 * (slug charset, v<digits>, frames/, *.png) AND the resolved absolute path is
 * required to stay under content/decks — so a traversal that survives the
 * first fence dies on the second. Only .png ever leaves: the manifest,
 * notes.json and source hashes stay server-side even for admins, because the
 * preview page gets its data through loadLocalDeck(), not raw files.
 */
const ROOT = join(process.cwd(), "content", "decks");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // assertAdmin throws for non-admins; translated to a clean 401 rather than
  // a 500 — a refusal is a normal outcome for this route, not a server fault.
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 401 });
  }

  const { path: parts } = await params;
  if (
    !parts ||
    parts.length !== 4 ||
    !/^[a-z0-9-]+$/.test(parts[0]) ||
    !/^v\d+$/.test(parts[1]) ||
    parts[2] !== "frames" ||
    !/^[a-z0-9-]+\.png$/.test(parts[3])
  ) {
    return NextResponse.json({ error: "unsupported preview path" }, { status: 403 });
  }

  const abs = normalize(join(ROOT, ...parts));
  if (!abs.startsWith(ROOT + sep)) {
    return NextResponse.json({ error: "path escapes bundle root" }, { status: 403 });
  }

  try {
    const bytes = await readFile(abs);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/png",
        // Admin preview only — never let a shared cache hold these.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "frame not found" }, { status: 404 });
  }
}
