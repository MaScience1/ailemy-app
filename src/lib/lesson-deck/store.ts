import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";
import { parseManifest, type DeckManifest } from "./manifest.ts";

/**
 * Where a lesson's deck comes from (§6, §10, §68).
 *
 * ============================================================================
 * ⚠ PUBLISHED = lessons.deck_path IS SET, AND NOTHING ELSE
 * ============================================================================
 * 0008 added `lessons.deck_path` for exactly this and nothing ever consumed
 * it. It now holds the BUCKET DIRECTORY of the published deck version, e.g.
 * `lessons/<lesson_id>/deck/v1`. Publishing is one admin UPDATE of that
 * column; unpublishing sets it NULL; rollback points it at the previous
 * version directory, which is never deleted (§10). The student page asks one
 * question — "is deck_path set?" — so there is no second publication flag to
 * drift from the first.
 *
 * ⚠ TWO SOURCES, ONE PRIORITY, NO SILENT MIXING:
 *   bucket  the published path — production, what students see
 *   fs      content/decks/<slug>/v<k> on this machine — the ingest output,
 *           readable ONLY by the admin preview flow (the caller passes
 *           allowLocal, and every caller that does sits behind assertAdmin)
 *
 * A student request never reads the filesystem; an fs bundle that was never
 * uploaded and published simply does not exist as far as students are
 * concerned. That is the §70 boundary expressed as data flow.
 *
 * ⚠ THE MANIFEST IS FETCHED SERVER-SIDE WITH THE ADMIN CLIENT and only its
 * PARSED, student-safe form ever leaves this module. No signed URL to
 * manifest.json is ever minted for a browser: the client receives frame paths
 * routed through /api/assets, which re-checks access per request.
 */

export type DeckSource = "bucket" | "fs";
export type DeckLoad =
  | { available: true; manifest: DeckManifest; source: DeckSource; deckPath: string }
  | { available: false; reason: string };

/** In-process cache — a manifest is immutable per version directory. */
const cache = new Map<string, DeckManifest>();

export async function loadPublishedDeck(deckPath: string | null): Promise<DeckLoad> {
  if (!deckPath) return { available: false, reason: "no deck published for this lesson" };
  if (!/^lessons\/[0-9a-f-]{36}\/deck\/v\d+$/.test(deckPath)) {
    // ⚠ THE SHAPE IS THE AUTHORISATION. deck_path is admin-written, but a
    // malformed value must fail here, not become a bucket path elsewhere.
    return { available: false, reason: `deck_path is malformed: ${deckPath}` };
  }

  const cached = cache.get(deckPath);
  if (cached) return { available: true, manifest: cached, source: "bucket", deckPath };

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("assets").download(`${deckPath}/manifest.json`);
  if (error || !data) {
    return { available: false, reason: `manifest fetch failed: ${error?.message ?? "no data"}` };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await data.text());
  } catch {
    return { available: false, reason: "manifest is not valid JSON" };
  }
  const verdict = parseManifest(raw);
  if (!verdict.ok) return { available: false, reason: verdict.reason };

  cache.set(deckPath, verdict.manifest);
  return { available: true, manifest: verdict.manifest, source: "bucket", deckPath };
}

/**
 * Local ingest output — ADMIN PREVIEW ONLY. Every caller sits behind
 * assertAdmin(); this function additionally refuses path characters that
 * could escape content/decks.
 */
export async function loadLocalDeck(slug: string, version: number): Promise<DeckLoad> {
  if (!/^[a-z0-9-]+$/.test(slug) || !Number.isInteger(version) || version < 1) {
    return { available: false, reason: "malformed slug or version" };
  }
  const dir = join(process.cwd(), "content", "decks", slug, `v${version}`);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
  } catch {
    return { available: false, reason: `no local bundle at content/decks/${slug}/v${version}` };
  }
  const verdict = parseManifest(raw);
  if (!verdict.ok) return { available: false, reason: verdict.reason };
  return { available: true, manifest: verdict.manifest, source: "fs", deckPath: `local/${slug}/v${version}` };
}

/** The URL the CLIENT uses for one frame — always the checked route, never a
 *  bucket URL. For fs previews, the admin preview route. */
export function frameUrl(load: { source: DeckSource; deckPath: string }, framePath: string): string {
  if (load.source === "bucket") return `/api/assets/${load.deckPath}/${framePath}`;
  return `/api/admin/deck-preview/${load.deckPath.replace(/^local\//, "")}/${framePath}`;
}
