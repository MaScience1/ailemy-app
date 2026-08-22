/**
 * READ-ONLY, one purpose: is there a PUBLISHED lesson_decks row for L1?
 * The founder sees the video placeholder on /lessons L1 and suspects the
 * server is on main; the branch's own design renders the placeholder when no
 * deck is published. This names which explanation is true. No writes.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i < 0 || line.trim().startsWith("#")) continue;
  env.set(line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, ""));
}
const svc = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: lesson, error: le } = await svc
  .from("lessons").select("id, slug, deck_path").eq("slug", "definitions-formulae-and-the-mole").single();
if (le || !lesson) { console.error("L1 lookup failed:", le?.message); process.exit(1); }
// THE publish switch — publishDeck() sets it, LessonDeckSection reads it.
console.log(`lessons.deck_path for L1: ${lesson.deck_path ?? "NULL (not published)"}`);

const { data: decks, error: de } = await svc
  .from("lesson_decks")
  .select("id, version, status, deck_bucket_path, created_at, published_at")
  .eq("lesson_id", lesson.id)
  .order("created_at", { ascending: false });
if (de) { console.error("lesson_decks read failed:", de.message); process.exit(1); }

console.log(`lesson_decks rows for L1 (${lesson.slug}):`);
if (!decks?.length) console.log("  NONE — nothing staged or published");
for (const d of decks ?? []) {
  console.log(`  v${d.version} · status=${d.status} · deck_bucket_path=${d.deck_bucket_path ?? "NULL"} · ${d.created_at}`);
}
// ⚠ THE VERDICT KEYS OFF lessons.deck_path — the switch publishDeck() actually
// sets and LessonDeckSection actually reads. The first version keyed off
// lesson_decks rows and printed a FALSE "not published" while the deck was
// live: the 0064 registry has no readers or writers yet (zero rows always).
const published = lesson.deck_path != null;
console.log(`\nVERDICT: ${published ? "PUBLISHED — students see the player (lessons.deck_path is set)" : "NO published deck — the placeholder is the designed pre-publish behaviour"}`);
console.log(`lesson_decks registry (0064): ${decks?.length ? `${decks.length} row(s)` : "UNWIRED — zero rows; no app code reads or writes it yet"}`);

// And the precondition publishDeck() checks: the staged manifest in the bucket.
const { data: staged, error: se } = await svc.storage
  .from("assets")
  .list(`lessons/${lesson.id}/deck/v1`, { search: "manifest.json" });
if (se) console.log(`bucket check failed: ${se.message}`);
else console.log(`staged manifest in bucket: ${staged?.some((o) => o.name === "manifest.json") ? "YES — Publish will succeed first click" : "NO — Stage must run before Publish"}`);
