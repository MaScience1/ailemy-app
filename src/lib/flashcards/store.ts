import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Deck } from "./types.ts";
import { CHEMISTRY_MOLE_DECK } from "./decks/chemistry-mole.ts";

/**
 * Where a lesson's card deck comes from.
 *
 * ============================================================================
 * ⚠ TABLE FIRST, BUNDLED SAMPLE SECOND, AND THE CALLER IS TOLD WHICH (§53)
 * ============================================================================
 * The deck tables are a parked _PROPOSED_ migration. Until they land the only
 * decks that exist are the bundled samples, and this returns them with
 * `source: "sample"` so every surface can say so. A sample deck presented as
 * the lesson's real notes would be exactly the fabricated completeness the
 * last three builds have been removing.
 *
 * ⚠ PGRST205 IS THE ONE ERROR THAT MEANS "NOT BUILT YET". Every other database
 * error is thrown: a broken store that reads as "this lesson has no notes" is
 * a fault wearing the clothes of an editorial decision.
 *
 * ⚠ THE ADMIN CLIENT IS CORRECT HERE AND NOWHERE NEAR STUDENT DATA. Decks are
 * published teaching material — the same bytes for every reader, gated by
 * `status = 'published'` in the query. Student state (resume, saved cards)
 * goes through the browser today and the student's own session tomorrow.
 */

export type DeckResult =
  | { available: true; deck: Deck; source: "database" | "sample" }
  | { available: false; reason: string };

const tableAbsent = (e: { code?: string } | null) => e?.code === "PGRST205";

/** Bundled sample decks, keyed by the lesson they demonstrate (§30, §55). */
const SAMPLE_DECKS: Record<string, Deck> = {
  [CHEMISTRY_MOLE_DECK.lessonSlug!]: CHEMISTRY_MOLE_DECK,
};

export async function loadDeckForLesson(
  lessonId: string,
  lessonSlug: string,
): Promise<DeckResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lesson_card_decks")
    .select("id, subject, title, topic, description, spec_codes, cards, status")
    .eq("lesson_id", lessonId)
    .eq("status", "published")
    .maybeSingle();

  if (error && !tableAbsent(error)) {
    throw new Error(`lesson_card_decks read failed: ${error.message}`);
  }

  if (!error && data) {
    const cards = Array.isArray(data.cards) ? data.cards : [];
    if (cards.length === 0) {
      return { available: false, reason: "This lesson's card deck is empty." };
    }
    return {
      available: true,
      source: "database",
      deck: {
        id: String(data.id),
        subject: data.subject,
        title: String(data.title),
        lessonSlug,
        topic: data.topic ?? undefined,
        description: data.description ?? undefined,
        specCodes: Array.isArray(data.spec_codes) ? data.spec_codes : undefined,
        cards,
      } as Deck,
    };
  }

  const sample = SAMPLE_DECKS[lessonSlug];
  if (sample) return { available: true, deck: sample, source: "sample" };

  return {
    available: false,
    reason: "No revision cards have been written for this lesson yet.",
  };
}
