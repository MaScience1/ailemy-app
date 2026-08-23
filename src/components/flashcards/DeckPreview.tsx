"use client";

import { useCallback, useEffect, useState } from "react";

import { track } from "@/lib/analytics/posthog";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";
import { estimatedMinutes, type Deck } from "@/lib/flashcards/types.ts";
import { loadDeckProgress } from "@/lib/flashcards/progress.ts";
import { StudyCardDeck } from "./StudyCardDeck";

/**
 * The lesson-page entry point: a tactile stack preview, then full-screen study
 * (§28, §29, §14).
 *
 * ============================================================================
 * ⚠ THE DECK DOES NOT UNFOLD INTO THE PAGE BY DEFAULT (§28)
 * ============================================================================
 * A full deck sitting inline would dominate a lesson that also has slides,
 * worked examples and practice, and would fight the page for vertical space on
 * a phone. The lesson shows a small stack with a real count and a real
 * estimate; studying is a deliberate step into a surface built for it.
 *
 * ⚠ THE ESTIMATE IS COUNTED FROM THE CARDS, NEVER AUTHORED. See
 * estimatedMinutes — an authored "~6 min" is right the day it is typed and
 * quietly wrong after the first edit.
 */

export function DeckPreview({
  deck,
  onPractice,
}: {
  deck: Deck;
  onPractice?: () => void;
}) {
  const [studying, setStudying] = useState(false);
  const [resumeCard, setResumeCard] = useState<number | null>(null);
  const colour = subjectColour(deck.subject);
  const minutes = estimatedMinutes(deck);

  useEffect(() => {
    const p = loadDeckProgress(deck.id);
    if (p && p.lastCard > 0) setResumeCard(p.lastCard);
  }, [deck.id]);

  const close = useCallback(() => {
    setStudying(false);
    track("notes_fullscreen_closed", { deck: deck.id });
  }, [deck.id]);

  // ⚠ THE PAGE MUST NOT SCROLL BEHIND THE STUDY VIEW, and the class is removed
  // on unmount as well as on close — leaving overflow:hidden on <body> because
  // a component unmounted mid-session freezes the whole site.
  useEffect(() => {
    if (!studying) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [studying]);

  if (studying) {
    return (
      <StudyMode deck={deck} onClose={close} onPractice={onPractice} />
    );
  }

  return (
    <div style={subjectVars(colour)}>
      <button
        type="button"
        onClick={() => { setStudying(true); track("notes_fullscreen_opened", { deck: deck.id }); }}
        className="group/deck block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        aria-label={`Study ${deck.cards.length} revision cards for ${deck.title}`}
      >
        <div className="relative h-[168px]">
          {/* the stack, lifting and separating on hover (§29) */}
          <div
            aria-hidden
            className="absolute inset-x-4 top-3 h-[140px] rounded-xl border border-ink/10 bg-[#FBF8F3] opacity-70 transition-transform duration-300 ease-out motion-safe:group-hover/deck:-translate-y-1"
          />
          <div
            aria-hidden
            className="absolute inset-x-2 top-1.5 h-[144px] rounded-xl border border-ink/10 bg-[#FDFBF7] transition-transform duration-300 ease-out motion-safe:group-hover/deck:-translate-y-[3px]"
          />
          <div className="absolute inset-x-0 top-0 flex h-[150px] flex-col overflow-hidden rounded-xl border border-ink/12 bg-[#FFFDF9] shadow-[0_1px_2px_rgba(15,20,25,0.05),0_10px_28px_-18px_rgba(15,20,25,0.3)] transition-transform duration-300 ease-out motion-safe:group-hover/deck:-translate-y-[5px]">
            <div aria-hidden className="h-[3px] w-full bg-[var(--subject-accent)] opacity-80" />
            <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                {deck.cards.length} revision cards · ~{minutes} min
              </p>
              <p className="font-display mt-2 line-clamp-2 text-lg font-medium leading-snug tracking-tight">
                {deck.cards[0]?.title}
              </p>
              <p className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-ink">
                {resumeCard !== null ? `Continue from card ${resumeCard + 1}` : "Study cards"}
                <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover/deck:translate-x-1">→</span>
              </p>
            </div>
          </div>
        </div>
      </button>

      {/* ⚠ WHERE THE PROGRESS LIVES, SAID PLAINLY (§13). No claim of
          cross-device sync while the table is a parked migration. */}
      <p className="mt-3 text-xs leading-relaxed text-ink/50">
        Your place in these cards is kept in this browser.
      </p>
    </div>
  );
}

/**
 * Full-screen study (§14, §37).
 *
 * ⚠ DESIGNED, NOT A BIG MODAL. Its own header, its own footer, its own focus
 * trap entry point, and dvh units so mobile browser chrome cannot crop the
 * bottom control out of reach — the failure that makes web study tools feel
 * unusable on a phone.
 */
function StudyMode({
  deck,
  onClose,
  onPractice,
}: {
  deck: Deck;
  onClose: () => void;
  onPractice?: () => void;
}) {
  const colour = subjectColour(deck.subject);

  // Focus the study surface on open so Escape and the arrow keys work without
  // the student first having to click something (§49).
  const [shell, setShell] = useState<HTMLDivElement | null>(null);
  useEffect(() => { shell?.focus(); }, [shell]);

  return (
    <div
      ref={setShell}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`${deck.title} — study cards`}
      style={subjectVars(colour)}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      className="fixed inset-0 z-50 flex flex-col bg-parchment outline-none"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
            {deck.topic ?? "Revision cards"}
          </p>
          <p className="truncate font-display text-base font-medium tracking-tight">{deck.title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-ink/15 px-3.5 py-1.5 text-sm transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Close
        </button>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <StudyCardDeck
          deck={deck}
          fullscreen
          onExitFullscreen={onClose}
          onPractice={onPractice}
        />
      </div>
    </div>
  );
}
