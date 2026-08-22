import { createClient } from "@/lib/supabase/server";
import { flattenFrames } from "@/lib/lesson-deck/manifest.ts";
import { frameUrl, loadPublishedDeck } from "@/lib/lesson-deck/store.ts";
import { LessonPlayer, type PlayerFrame } from "./LessonPlayer";
import { LessonPractice } from "./LessonPractice";
import { SpecJump } from "./SpecJump";

/**
 * Server assembly for the interactive lesson experience (§4, §73).
 *
 * ============================================================================
 * ⚠ THE DECK DECIDES WHAT RENDERS, AND ABSENCE IS SILENT ON PURPOSE
 * ============================================================================
 * Published deck → the player is the primary content and practice renders
 * beneath it. No published deck → this component renders NOTHING and the
 * lesson page keeps its existing video-or-placeholder behaviour, byte for
 * byte. Every lesson that has not been touched by the deck pipeline is
 * therefore unaffected by this feature existing — the §81 scaling rule
 * (Lesson 1 is a pilot, not a special case) enforced by rendering shape.
 *
 * ⚠ THE WATERMARK IS THE SIGNED-IN ADDRESS (§7) — restrained, configurable by
 * the one constant below, and honest: it deters casual redistribution and
 * claims nothing more. Anonymous viewers of a free lesson get the plain
 * "Ailemy" mark instead of an identity they do not have.
 */

const WATERMARK_ENABLED = true;

export async function LessonDeckSection({ lessonSlug, deckPath }: {
  lessonSlug: string;
  deckPath: string | null;
}) {
  const deck = await loadPublishedDeck(deckPath);
  if (!deck.available) return null;

  let watermark: string | null = null;
  if (WATERMARK_ENABLED) {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    watermark = user?.email ?? "";
  }

  const frames: PlayerFrame[] = flattenFrames(deck.manifest).map((f) => ({
    index: f.index,
    slideN: f.slideN,
    step: f.step,
    stepCount: f.stepCount,
    url: frameUrl(deck, f.path),
    buildLabel: f.buildLabel,
  }));

  // §76 — the FIRST slide that carries each spec chip, from the deck's own
  // detection. A code with no chip simply has no jump target.
  const specTargets: { code: string; slideN: number }[] = [];
  for (const s of deck.manifest.slides) {
    for (const code of s.specCodes) {
      if (!specTargets.some((t) => t.code === code)) specTargets.push({ code, slideN: s.n });
    }
  }
  specTargets.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return (
    <div className="grid gap-10" data-lesson-deck>
      <div>
      <LessonPlayer
        lessonSlug={lessonSlug}
        version={deck.manifest.version}
        frames={frames}
        slideCount={deck.manifest.slideCount}
        watermark={watermark}
      />
      <SpecJump targets={specTargets} />
      </div>
      <LessonPractice lessonSlug={lessonSlug} />
    </div>
  );
}
