import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getStaffStatus } from "@/lib/admin/staff";
import { StudyCardDeck } from "@/components/flashcards/StudyCardDeck";
import { CHEMISTRY_MOLE_DECK } from "@/lib/flashcards/decks/chemistry-mole.ts";
import {
  BIOLOGY_PREVIEW_DECK,
  PHYSICS_PREVIEW_DECK,
} from "@/lib/flashcards/decks/preview-decks.ts";
import { overfullCards, estimatedMinutes, type Deck } from "@/lib/flashcards/types.ts";

/**
 * /dev/flashcards — the internal design surface (§5).
 *
 * ============================================================================
 * ⚠ STAFF ONLY, AND IT 404s RATHER THAN REFUSING
 * ============================================================================
 * An ordinary production user must not reach this. It is gated on staff role
 * and answers notFound() — not a "you are not allowed" page — because a
 * refusal page confirms the route exists and invites somebody to come back
 * with better credentials. A 404 tells them nothing.
 *
 * ⚠ IT FAILS CLOSED. getStaffStatus can answer `unavailable` — the check
 * itself failed — which is NOT "no" but is treated as one here. An outage that
 * opened an internal tool is far worse than an outage that closed it, which is
 * the same rule /admin already follows.
 *
 * ⚠ noindex, AND THE GATE IS THE REAL DEFENCE. The metadata below is a
 * courtesy to crawlers; it protects nothing on its own, and nothing here
 * should ever rely on it.
 */

/**
 * ⚠ THE TITLE IS GATED TOO, AND THIS WAS A REAL (SMALL) LEAK.
 * ==========================================================================
 * `export const metadata` is evaluated BEFORE the component runs, so
 * notFound() never suppresses it: an anonymous request for this URL got a 404
 * whose RSC payload still carried "Flashcard design preview · Ailemy". No card
 * content leaked — verified — but the route's purpose did, to somebody who had
 * already guessed the path. generateMetadata can ask who is asking; a static
 * metadata object cannot.
 */
export async function generateMetadata(): Promise<Metadata> {
  const staff = await getStaffStatus();
  if (!staff.ok) return { title: "Not found · Ailemy", robots: { index: false, follow: false } };
  return {
    title: "Flashcard design preview · Ailemy",
    robots: { index: false, follow: false, nocache: true },
  };
}

export const dynamic = "force-dynamic";

const DECKS: Deck[] = [CHEMISTRY_MOLE_DECK, BIOLOGY_PREVIEW_DECK, PHYSICS_PREVIEW_DECK];

export default async function DevFlashcardsPage() {
  const staff = await getStaffStatus();
  if (!staff.ok) notFound();

  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
        <header className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/50">
            Internal · design preview
          </p>
          <h1 className="font-display mt-4 text-4xl font-medium leading-[1.05] tracking-tight">
            Flashcard notes.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-ink/70">
            One engine, three subject identities. Every deck below renders through the same
            <code className="mx-1 rounded bg-ink/[0.06] px-1 py-0.5 font-mono text-[0.9em]">StudyCardDeck</code>
            — what differs is the data. Drag a card, use the arrow keys, or press space on a
            card that has a back.
          </p>
        </header>

        <div className="mt-12 grid gap-16">
          {DECKS.map((deck) => {
            const overfull = overfullCards(deck);
            return (
              <section key={deck.id} aria-labelledby={`deck-${deck.id}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-ink/10 pb-3">
                  <div>
                    <h2 id={`deck-${deck.id}`} className="font-display text-2xl font-medium tracking-tight">
                      {deck.title}
                    </h2>
                    <p className="font-mono mt-1 text-[10px] uppercase tracking-[0.2em] text-ink/45">
                      {deck.subject} · {deck.cards.length} cards · ~{estimatedMinutes(deck)} min ·
                      {" "}{[...new Set(deck.cards.map((c) => c.type))].join(", ")}
                    </p>
                  </div>
                </div>

                {/* ⚠ THE §48 DENSITY WARNING, VISIBLE ONLY HERE. An author needs
                    to know a card is too full BEFORE a student meets it clipped
                    or scrolling — and a student never needs to see this. */}
                {overfull.length > 0 && (
                  <p role="status" className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Density warning — {overfull.length} card
                    {overfull.length === 1 ? "" : "s"} exceed the recommended length:{" "}
                    {overfull.map((c) => `${c.id} (${c.words} words)`).join(", ")}. Author them
                    down rather than letting the card scroll.
                  </p>
                )}

                <div className="mt-6 max-w-2xl">
                  <StudyCardDeck deck={deck} />
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
