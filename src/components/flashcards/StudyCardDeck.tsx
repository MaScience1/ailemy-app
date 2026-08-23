"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Star, X } from "lucide-react";

import { track } from "@/lib/analytics/posthog";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";
import type { Deck } from "@/lib/flashcards/types.ts";
import { CardFace } from "./CardFace";
import {
  loadDeckProgress,
  saveDeckProgress,
  toggleSavedCard,
  loadSavedCards,
} from "@/lib/flashcards/progress.ts";

/**
 * The reusable flashcard engine — one component, three subjects (§4).
 *
 * ============================================================================
 * ⚠ NO ANIMATION LIBRARY. The project has none, and a deck of cards does not
 * justify adding one (§50): the whole interaction is a CSS transform driven by
 * pointer events. Dragging writes translate/rotate directly to the element and
 * skips React state entirely — a re-render per pointermove is what makes a
 * drag feel cheap — and React is told only when the card settles.
 *
 * ⚠ DIRECTIONAL LOCK, BECAUSE THE PAGE MUST STILL SCROLL (§34). The first few
 * pixels of a gesture decide whether it is a horizontal card drag or a
 * vertical page scroll, and once decided it does not change. Without that,
 * every attempt to scroll past a deck on a phone snags a card, which is the
 * single fastest way to make a study page infuriating.
 *
 * ⚠ REDUCED MOTION IS OBEYED, NOT DECORATED (§36). With it set, the card
 * changes without travelling and the flip has no turn — the deck stays fully
 * usable, which is the point of the preference.
 */

const SWIPE_COMMIT_PX = 90;
const SWIPE_COMMIT_VELOCITY = 0.45; // px per ms — a flick counts even if short
const DIRECTION_LOCK_PX = 10;

export function StudyCardDeck({
  deck,
  fullscreen = false,
  onRequestFullscreen,
  onExitFullscreen,
  onReachedEnd,
  onPractice,
}: {
  deck: Deck;
  fullscreen?: boolean;
  onRequestFullscreen?: () => void;
  onExitFullscreen?: () => void;
  /** Fires once when the last card is reached (§41) — never a completion claim. */
  onReachedEnd?: () => void;
  onPractice?: () => void;
}) {
  const total = deck.cards.length;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const touched = useRef(false);
  const drag = useRef<{ x: number; y: number; t: number; axis: null | "x" | "y" } | null>(null);

  const card = deck.cards[index];
  const colour = subjectColour(deck.subject);

  // ── resume (§13) ─────────────────────────────────────────────────────────
  useEffect(() => {
    const p = loadDeckProgress(deck.id);
    if (p && p.lastCard > 0 && p.lastCard < total) setResumeAt(p.lastCard);
    setSaved(new Set(loadSavedCards()));
    track("notes_deck_opened", { deck: deck.id, subject: deck.subject });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  /**
   * ⚠ THE SAME ORDERING BUG THE SLIDE PLAYER HAD, NOT REPEATED. Writing
   * progress on mount would store card 0 over a real saved position before the
   * student has decided whether to resume — which is precisely how the deck
   * player destroyed its own resume record until it was fixed. Nothing is
   * written until the student moves.
   */
  useEffect(() => {
    if (!touched.current) return;
    saveDeckProgress(deck.id, { lastCard: index, cardsViewed: index + 1, total });
  }, [index, deck.id, total]);

  useEffect(() => {
    if (index === total - 1 && !reachedEnd) {
      setReachedEnd(true);
      onReachedEnd?.();
      track("notes_deck_completed", { deck: deck.id, subject: deck.subject });
    }
  }, [index, total, reachedEnd, onReachedEnd, deck.id, deck.subject]);

  const go = useCallback(
    (next: number, how: "next" | "previous") => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      if (clamped === index) return;
      touched.current = true;
      setIndex(clamped);
      setFlipped(false);
      track(how === "next" ? "notes_next" : "notes_previous", { deck: deck.id });
      track("notes_card_viewed", { deck: deck.id, cardIndex: clamped });
    },
    [index, total, deck.id],
  );

  const flip = useCallback(() => {
    if (!card.back) return;
    touched.current = true;
    setFlipped((f) => !f);
    track("notes_card_flipped", { deck: deck.id, cardIndex: index });
  }, [card, deck.id, index]);

  // ── keyboard (§10) ───────────────────────────────────────────────────────
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // ⚠ NEVER HIJACK A FIELD. A student typing in a search box must keep
      // their arrow keys; this only acts when focus is on the deck itself.
      const el = e.target as HTMLElement;
      if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;

      if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1, "next"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1, "previous"); }
      else if ((e.key === " " || e.key === "Enter") && card.back) { e.preventDefault(); flip(); }
      else if (e.key === "Escape" && fullscreen) { e.preventDefault(); onExitFullscreen?.(); }
    },
    [go, index, card, flip, fullscreen, onExitFullscreen],
  );

  // ── pointer drag: touch and mouse, one path (§8, §9) ─────────────────────
  const setTransform = (dx: number, settling: boolean) => {
    const el = cardRef.current;
    if (!el) return;
    const rot = Math.max(-6, Math.min(6, dx / 26)); // restrained, not Tinder
    el.style.transition = settling ? "transform 220ms cubic-bezier(0.22,1,0.36,1)" : "none";
    el.style.transform = `translate3d(${dx}px,0,0) rotate(${rot}deg)`;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), axis: null };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;

    if (d.axis === null) {
      if (Math.abs(dx) < DIRECTION_LOCK_PX && Math.abs(dy) < DIRECTION_LOCK_PX) return;
      // Locked once, for the life of the gesture — see the header.
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") {
        // Only capture the pointer for a horizontal gesture, so a vertical one
        // stays with the page and scrolling is never stolen.
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }
    }
    if (d.axis !== "x") return;

    // Resist at the ends rather than refusing — the card should feel like it
    // is being held back, not broken.
    const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === total - 1);
    setTransform(atEdge ? dx * 0.25 : dx, false);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.axis !== "x") return;
    const dx = e.clientX - d.x;
    const velocity = Math.abs(dx) / Math.max(1, performance.now() - d.t);
    const commit = Math.abs(dx) > SWIPE_COMMIT_PX || velocity > SWIPE_COMMIT_VELOCITY;

    setTransform(0, true);
    if (!commit) return;
    if (dx < 0) go(index + 1, "next");
    else go(index - 1, "previous");
  };

  // A new card always starts square, whatever the last gesture left behind.
  useEffect(() => { setTransform(0, false); }, [index]);

  const onSave = () => {
    const next = toggleSavedCard(card.id);
    setSaved(new Set(next));
    track("notes_card_saved", { deck: deck.id, cardIndex: index });
  };

  const isSaved = saved.has(card.id);
  const progressPct = total <= 1 ? 100 : ((index + 1) / total) * 100;

  return (
    <div
      ref={shellRef}
      style={subjectVars(colour)}
      tabIndex={0}
      role="group"
      aria-roledescription="flashcard deck"
      aria-label={`${deck.title} — ${total} cards`}
      onKeyDown={onKeyDown}
      className={[
        "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink",
        fullscreen ? "flex h-full w-full flex-col" : "",
      ].join(" ")}
    >
      {/* resume offer — an offer, never a redirect */}
      {resumeAt !== null && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/12 bg-snow px-4 py-2.5 text-sm">
          <span className="text-ink/75">Continue from card {resumeAt + 1}?</span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => { touched.current = true; setIndex(resumeAt); setResumeAt(null); }}
              className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-parchment hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => { touched.current = true; setResumeAt(null); }}
              className="rounded-full border border-ink/20 px-3.5 py-1.5 text-xs hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Start over
            </button>
          </span>
        </div>
      )}

      {/* ── the stack (§6, §60, §61) ─────────────────────────────────────── */}
      <div className={fullscreen ? "relative flex min-h-0 flex-1 items-center justify-center" : "relative"}>
        <div className={fullscreen ? "relative mx-auto flex h-full w-full max-w-2xl flex-col justify-center" : "relative"}>
          {/* Two cards behind, no more — a stack, not a fan (§60). */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {index < total - 2 && (
              <div className="absolute inset-x-3 top-2.5 h-full rounded-xl border border-ink/10 bg-[#FBF8F3] opacity-60 shadow-[0_1px_2px_rgba(15,20,25,0.04)]" />
            )}
            {index < total - 1 && (
              <div className="absolute inset-x-1.5 top-1.5 h-full rounded-xl border border-ink/10 bg-[#FDFBF7] shadow-[0_1px_2px_rgba(15,20,25,0.05)]" />
            )}
          </div>

          <div
            ref={cardRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={card.back ? flip : undefined}
            /* touch-action pan-y hands vertical scrolling to the browser
               outright — the most reliable half of the directional lock. */
            className={[
              "relative touch-pan-y select-none",
              fullscreen ? "h-[min(78vh,720px)]" : "h-[clamp(360px,52vh,560px)]",
              card.back ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
              "motion-reduce:transition-none",
            ].join(" ")}
          >
            <CardFace
              card={card}
              subject={deck.subject}
              index={index}
              total={total}
              side={flipped ? "back" : "front"}
              showSubject={!fullscreen}
            />
          </div>

          {/* reveal affordance — only where a back genuinely exists (§15) */}
          {card.back && (
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
              {flipped ? "Tap to return" : card.reveal ?? "Tap to reveal"}
            </p>
          )}
        </div>
      </div>

      {/* ── controls and progress (§11, §12) ──────────────────────────────── */}
      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => go(index - 1, "previous")}
          disabled={index === 0}
          aria-label="Previous card"
          className="rounded-full border border-ink/15 p-2.5 transition-colors hover:border-ink/40 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <p aria-live="polite" className="font-mono text-[11px] tracking-[0.14em] text-ink/55">
            {index + 1} / {total}
          </p>
          {/* thin, not a game bar (§12) */}
          <div className="h-[2px] w-full max-w-[220px] overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-[var(--subject-accent)] transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            aria-pressed={isSaved}
            aria-label={isSaved ? "Saved — remove from saved cards" : "Save this card"}
            className="rounded-full border border-ink/15 p-2.5 transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Star
              className={`h-4 w-4 ${isSaved ? "fill-[var(--subject-accent)] text-[var(--subject-accent)]" : ""}`}
              aria-hidden
            />
          </button>
          {!fullscreen && onRequestFullscreen && (
            <button
              type="button"
              onClick={() => { onRequestFullscreen(); track("notes_fullscreen_opened", { deck: deck.id }); }}
              aria-label="Study cards full screen"
              className="rounded-full border border-ink/15 p-2.5 transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <Maximize2 className="h-4 w-4" aria-hidden />
            </button>
          )}
          {fullscreen && onExitFullscreen && (
            <button
              type="button"
              onClick={onExitFullscreen}
              aria-label="Close study mode"
              className="rounded-full border border-ink/15 p-2.5 transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => go(index + 1, "next")}
            disabled={index === total - 1}
            aria-label="Next card"
            className="rounded-full border border-ink/15 p-2.5 transition-colors hover:border-ink/40 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* ── end of deck (§41, §42) ────────────────────────────────────────── */}
      {index === total - 1 && (
        <div className="mt-6 rounded-lg border border-ink/12 bg-snow p-5">
          <p className="font-display text-lg font-medium tracking-tight">Notes reviewed</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/70">
            {/* ⚠ IT REPORTS WHAT HAPPENED AND CLAIMS NOTHING MORE (§40, §44).
                Reaching the last card means these cards were seen. It is not a
                score, not mastery, and it does not complete the lesson. */}
            You have been through all {total} cards in {deck.title}.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { touched.current = true; setIndex(0); setFlipped(false); }}
              className="rounded-full border border-ink/20 px-4 py-2 text-sm transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Review again
            </button>
            {onPractice && (
              <button
                type="button"
                onClick={() => { onPractice(); track("notes_practice_clicked", { deck: deck.id }); }}
                className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Start practice →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
