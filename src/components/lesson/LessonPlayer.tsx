"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";

import { track } from "@/lib/analytics/posthog";

/**
 * The interactive lesson player (§14–§18, §25–§30, §95).
 *
 * ============================================================================
 * ⚠ ONE LINEAR FRAME LIST — "NEXT" IS index+1 AND NOTHING ELSE (§16)
 * ============================================================================
 * The server flattens deck → slides → build frames into one ordered list, so
 * the PowerPoint presenter behaviour — Next reveals the slide's next build
 * step until the slide is exhausted, then advances the slide — is a property
 * of the DATA, not a special case in the handler. There is no "am I mid-build"
 * branch to get wrong; Previous is index−1 and reverses through builds for
 * free (§16's "where technically possible" is: always, because frames are
 * pre-rendered images, not replayed animations).
 *
 * ⚠ FRAMES ARE <img> SWAPS, NOT ANIMATIONS. The deck's own effects are all
 * "appear", so a swap IS the faithful rendering — and it is also what
 * prefers-reduced-motion wants. The only motion this component adds is a
 * motion-safe opacity cross-fade.
 *
 * ⚠ RESUME IS device-local (§25) — localStorage keyed by slug+version, offered
 * as a banner, never forced. The wiring point for server-side progress is
 * VISITED/onProgress below: when the lesson_view_state table lands, the same
 * callback posts a server action; nothing else changes.
 *
 * ⚠ THE WATERMARK (§7) is a restrained ownership line, configurable via prop,
 * rendered as a low-opacity overlay the player does not let images cover. It
 * is honest deterrence, not DRM — the header of the asset route says the rest.
 */

export type PlayerFrame = {
  index: number;
  slideN: number;
  step: number;
  stepCount: number;
  url: string;
  buildLabel: string | null;
};

const storageKey = (slug: string, version: number) => `ailemy:deck:${slug}:v${version}`;

type Saved = { index: number; visited: number[] };

function loadSaved(key: string): Saved | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Saved;
    if (typeof p.index !== "number" || !Array.isArray(p.visited)) return null;
    return p;
  } catch {
    return null;
  }
}

export function LessonPlayer({
  lessonSlug,
  version,
  frames,
  slideCount,
  watermark,
  onAllSlidesViewed,
}: {
  lessonSlug: string;
  version: number;
  frames: PlayerFrame[];
  slideCount: number;
  watermark: string | null;
  /** Fires once when every slide has been visited (§26, §27). */
  onAllSlidesViewed?: () => void;
}) {
  const key = storageKey(lessonSlug, version);
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([frames[0]?.slideN ?? 1]));
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const completedFired = useRef(false);

  const current = frames[index];
  const slidesVisited = visited.size;

  // ── resume offer (§25) — read once on mount, never forced ───────────────
  useEffect(() => {
    const saved = loadSaved(key);
    if (saved && saved.index > 0 && saved.index < frames.length) {
      setResumeAt(saved.index);
      setVisited(new Set(saved.visited));
      track("lesson_resume_offered", { lesson: lessonSlug });
    }
    track("lesson_opened", { lesson: lessonSlug });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // ── persist position + visited set on every move ────────────────────────
  useEffect(() => {
    if (!current) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ index, visited: [...visited] } satisfies Saved),
      );
    } catch {
      /* storage full or blocked — resume degrades, playback does not */
    }
  }, [index, visited, key, current]);

  // ── completion (§26): every SLIDE visited, not "opened slide 1" ─────────
  useEffect(() => {
    if (slidesVisited >= slideCount && !completedFired.current) {
      completedFired.current = true;
      track("lesson_slides_completed", { lesson: lessonSlug });
      onAllSlidesViewed?.();
    }
  }, [slidesVisited, slideCount, lessonSlug, onAllSlidesViewed]);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(frames.length - 1, next));
      if (clamped === index) return;
      const f = frames[clamped];
      setIndex(clamped);
      setVisited((v) => (v.has(f.slideN) ? v : new Set(v).add(f.slideN)));
      if (f.step > 0 && clamped > index) {
        track("lesson_build_advanced", { lesson: lessonSlug, slide: f.slideN, frame: f.step });
      } else {
        track("lesson_slide_viewed", { lesson: lessonSlug, slide: f.slideN });
      }
    },
    [frames, index, lessonSlug],
  );

  // ── keyboard (§17) — bound to the shell, so it never captures the page ──
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // ⚠ Space only advances when the shell itself is focused — a student
      // tabbed onto a control keeps native button semantics, and the page
      // keeps native scrolling when the player is not focused (§17).
      if (e.key === "ArrowRight" || (e.key === " " && e.target === shellRef.current)) {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index - 1);
      }
    },
    [go, index],
  );

  // ── review-slide jumps from the practice section (§52) ──────────────────
  // The results list dispatches ailemy:lesson-goto-slide; the player answers
  // by jumping to that slide's FIRST frame (its un-built state — the student
  // came to re-learn, so the builds replay) and scrolling itself into view.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const slideN = (e as CustomEvent<{ slideN: number }>).detail?.slideN;
      const target = frames.find((f) => f.slideN === slideN);
      if (!target) return;
      go(target.index);
      shellRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      shellRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("ailemy:lesson-goto-slide", onGoto);
    return () => window.removeEventListener("ailemy:lesson-goto-slide", onGoto);
  }, [frames, go]);

  // ── fullscreen (§29) — Escape is the browser's own exit, not reimplemented
  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
        track("lesson_fullscreen_entered", { lesson: lessonSlug });
      }
    } catch {
      /* fullscreen unsupported (iPhone Safari) — the player still works */
    }
  }, [lessonSlug]);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // ── touch (§18): horizontal swipe, ignored when it is mostly vertical ───
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(index + (dx < 0 ? 1 : -1));
    }
  };

  // ── preload the neighbours (§92): current, next, previous — nothing more ─
  const neighbours = useMemo(
    () => [frames[index + 1], frames[index - 1]].filter(Boolean) as PlayerFrame[],
    [frames, index],
  );

  if (!current) return null;

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      role="region"
      aria-label={`Lesson slides — slide ${current.slideN} of ${slideCount}`}
      aria-roledescription="lesson presentation"
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={[
        "group/player relative overflow-hidden rounded-lg border border-ink/10 bg-ink outline-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        fullscreen ? "flex h-full w-full flex-col justify-center" : "",
      ].join(" ")}
    >
      {/* resume banner — an offer, never a redirect (§25) */}
      {resumeAt !== null && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-ink/90 px-4 py-2.5 text-sm text-parchment">
          <span>
            Pick up where you left off — slide {frames[resumeAt].slideN}
            {frames[resumeAt].step > 0 ? `, step ${frames[resumeAt].step}` : ""}?
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              className="rounded-full bg-parchment px-3 py-1 text-xs font-medium text-ink hover:bg-parchment/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-parchment"
              onClick={() => {
                go(resumeAt);
                setResumeAt(null);
                track("lesson_resume_accepted", { lesson: lessonSlug });
              }}
            >
              Resume
            </button>
            <button
              type="button"
              className="rounded-full border border-parchment/40 px-3 py-1 text-xs text-parchment hover:border-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-parchment"
              onClick={() => setResumeAt(null)}
            >
              Start over
            </button>
          </span>
        </div>
      )}

      {/* the slide itself — contain, never crop (§30) */}
      <div className={fullscreen ? "relative mx-auto w-full max-w-[177.78vh]" : "relative"}>
        {/* eslint-disable-next-line @next/next/no-img-element -- frames come
            through the access-checked route; next/image would re-proxy them */}
        <img
          key={current.url}
          src={current.url}
          alt={`Slide ${current.slideN}${current.step > 0 ? `, build step ${current.step} of ${current.stepCount - 1}` : ""}${current.buildLabel ? ` — ${current.buildLabel}` : ""}`}
          className="block aspect-video w-full select-none object-contain motion-safe:animate-[fadeIn_150ms_ease-out]"
          draggable={false}
        />
        {neighbours.map((f) => (
          // hidden preloads — the next click paints from cache (§93)
          // eslint-disable-next-line @next/next/no-img-element
          <img key={f.url} src={f.url} alt="" aria-hidden className="hidden" />
        ))}

        {watermark && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 right-3 z-10 font-mono text-[10px] tracking-[0.14em] text-parchment/50"
          >
            Ailemy · {watermark}
          </span>
        )}
      </div>

      {/* controls — minimal in fullscreen, same buttons (§29) */}
      <div className="flex items-center justify-between gap-3 bg-ink px-3 py-2.5 text-parchment">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous step or slide"
          className="rounded-full p-2 transition-colors hover:bg-parchment/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-parchment"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>

        {/* the counter announces builds as well as slides (§14, §95) */}
        <p aria-live="polite" className="font-mono text-xs tracking-[0.12em] text-parchment/80">
          Slide {current.slideN} / {slideCount}
          {current.stepCount > 1 && (
            <span className="text-parchment/50">
              {" "}· step {current.step} / {current.stepCount - 1}
            </span>
          )}
        </p>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="rounded-full p-2 transition-colors hover:bg-parchment/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-parchment"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === frames.length - 1}
            aria-label="Next step or slide"
            className="rounded-full p-2 transition-colors hover:bg-parchment/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-parchment"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* quiet progress (§77) — text, not a game bar */}
      <p className="border-t border-parchment/10 bg-ink px-3 py-1.5 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-parchment/40">
        {slidesVisited} / {slideCount} slides viewed
      </p>
    </div>
  );
}
