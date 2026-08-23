"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Check } from "lucide-react";

import { track } from "@/lib/analytics/posthog";
import { setSectionState } from "@/lib/lesson/completion";
import type { CompletionStore } from "@/lib/lesson/completion";
import {
  SECTION_META,
  mergeStates,
  summarise,
  type CompletionSource,
  type LessonSectionKey,
  type SectionState,
} from "@/lib/lesson/sections.ts";

/**
 * The lesson journey: one shared completion state for the whole page.
 *
 * ============================================================================
 * ⚠ ONE STATE, TWO KINDS OF WRITER, AND A STORE THAT MAY NOT EXIST YET
 * ============================================================================
 * The journey tracker and every section's "Mark complete" control read and
 * write the SAME state through this context, so a tick can never appear in one
 * place and not the other. Writers are of two kinds and they are not equal:
 *   - MANUAL: the student says so. Always allowed.
 *   - AUTO: the app OBSERVED the evidence (every slide reached, an attempt
 *     submitted). Only fired from a real event, never from "the section was on
 *     screen" — see SECTION_META.autoEvidence, which is deliberately null for
 *     video and notes because nothing in this app can currently observe them.
 *
 * ⚠ AN AUTO TICK NEVER OVERWRITES A MANUAL ONE, AND NEITHER RE-FIRES. The deck
 * player's completion callback re-fires on every mount for a returning student
 * (its `completedFired` ref resets with the component), so without the guard
 * below every page load would rewrite completed_at and a student's completion
 * date would silently become today's date, forever.
 *
 * ⚠ WHERE THE TICK LIVES IS PART OF THE TRUTH (§26). If the server store
 * answered, completion follows the student to any device. If it did not — the
 * table is a parked _PROPOSED_ migration, or they are signed out — the tick is
 * kept in this browser and the UI SAYS SO. §26 asks for cross-device
 * persistence; where we cannot deliver it, we do not pretend to.
 */

type Ctx = {
  present: readonly LessonSectionKey[];
  states: Partial<Record<LessonSectionKey, SectionState>>;
  store: CompletionStore;
  storeReason: string | null;
  mark: (section: LessonSectionKey, source: CompletionSource, evidence?: Record<string, string | number>) => void;
  pending: LessonSectionKey | null;
  error: string | null;
};

const LessonProgressCtx = createContext<Ctx | null>(null);

export function useLessonProgress(): Ctx {
  const ctx = useContext(LessonProgressCtx);
  if (!ctx) throw new Error("useLessonProgress must be used inside <LessonProgressProvider>");
  return ctx;
}

const deviceKey = (lessonId: string) => `ailemy:lesson-sections:${lessonId}`;

function loadDevice(lessonId: string): Partial<Record<LessonSectionKey, SectionState>> {
  try {
    const raw = localStorage.getItem(deviceKey(lessonId));
    return raw ? (JSON.parse(raw) as Partial<Record<LessonSectionKey, SectionState>>) : {};
  } catch {
    return {};
  }
}

export function LessonProgressProvider({
  lessonId,
  lessonSlug,
  present,
  initialStates,
  initialStore,
  initialReason,
  children,
}: {
  lessonId: string;
  lessonSlug: string;
  present: readonly LessonSectionKey[];
  initialStates: Partial<Record<LessonSectionKey, SectionState>>;
  initialStore: CompletionStore;
  initialReason?: string;
  children: React.ReactNode;
}) {
  const [states, setStates] = useState(initialStates);
  const [store, setStore] = useState<CompletionStore>(initialStore);
  const [pending, setPending] = useState<LessonSectionKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Device-kept ticks are merged in on mount only when the server store did not
  // answer — a server row always wins over a browser's memory of one.
  useEffect(() => {
    if (initialStore === "server") return;
    const local = loadDevice(lessonId);
    if (Object.keys(local).length > 0) setStates((s) => mergeStates(local, s));
  }, [lessonId, initialStore]);

  const mark = useCallback(
    (section: LessonSectionKey, source: CompletionSource, evidence?: Record<string, string | number>) => {
      setStates((current) => {
        const existing = current[section];
        // ⚠ THE RE-FIRE GUARD (see header). Already complete stays complete,
        // with its original date and its original source.
        if (existing?.status === "complete") return current;
        const next: SectionState = {
          key: section,
          status: "complete",
          completedAt: new Date().toISOString(),
          source,
        };
        const merged = { ...current, [section]: next };
        try {
          localStorage.setItem(deviceKey(lessonId), JSON.stringify(merged));
        } catch {
          /* storage blocked — the server write below is the real record */
        }
        return merged;
      });

      // Fire-and-report: the tick is already visible; the write decides where
      // it LIVES, and a refusal downgrades the badge rather than the tick.
      setPending(section);
      setError(null);
      void setSectionState({ lessonId, section, status: "complete", source, evidence: evidence ?? null })
        .then((res) => {
          if (res.ok) {
            setStore(res.store);
          } else {
            setStore("device");
            setError(res.reason);
          }
        })
        .catch((e: unknown) => {
          setStore("device");
          setError(e instanceof Error ? e.message : "could not save");
        })
        .finally(() => setPending(null));

      track("lesson_section_completed", { lesson: lessonSlug, section, source });
    },
    [lessonId, lessonSlug],
  );

  const value = useMemo<Ctx>(
    () => ({ present, states, store, storeReason: initialReason ?? null, mark, pending, error }),
    [present, states, store, initialReason, mark, pending, error],
  );

  return <LessonProgressCtx.Provider value={value}>{children}</LessonProgressCtx.Provider>;
}

// ── the journey tracker ─────────────────────────────────────────────────────

function scrollToSection(key: LessonSectionKey) {
  const el = document.getElementById(SECTION_META[key].anchor);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // Move focus too, or the keyboard user is left where they were (§97).
  el.setAttribute("tabindex", "-1");
  (el as HTMLElement).focus({ preventScroll: true });
}

/**
 * The journey: a compact stage list with completion state.
 *
 * ⚠ COMPLETION IS NEVER COLOUR ALONE (§97). Every state carries a glyph — ✓ for
 * complete, a hollow ring for not — and a text label in the accessible name, so
 * the tracker reads correctly in greyscale and to a screen reader.
 */
export function LessonJourney({ variant = "rail" }: { variant?: "rail" | "strip" }) {
  const { present, states, store, storeReason } = useLessonProgress();
  const { complete, total, percent } = summarise(present, states);

  if (variant === "strip") {
    return (
      <nav
        aria-label="Lesson progress"
        className="sticky top-0 z-30 -mx-6 border-b border-ink/10 bg-parchment/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-parchment/80 lg:hidden"
      >
        <div className="flex items-center gap-3">
          <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
            {complete}/{total}
          </p>
          <ol className="flex flex-1 gap-1.5 overflow-x-auto pb-1">
            {present.map((k) => {
              const done = states[k]?.status === "complete";
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(k)}
                    aria-label={`${SECTION_META[k].label} — ${done ? "complete" : "not complete"}`}
                    className={[
                      "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      done ? "border-ink/30 bg-ink/[0.07] text-ink" : "border-ink/15 text-ink/60",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                    ].join(" ")}
                  >
                    <span aria-hidden>{done ? "✓" : "○"}</span>
                    {SECTION_META[k].label}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Lesson progress" className="rounded-lg border border-ink/10 bg-snow p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">Your lesson</h2>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-2xl font-medium tracking-tight">{complete}</span>
        <span className="text-sm text-ink/60">of {total} complete</span>
      </p>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Lesson progress: ${percent} percent`}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className="h-full rounded-full bg-ink motion-safe:transition-[width] motion-safe:duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="mt-4 grid gap-1">
        {present.map((k) => {
          const done = states[k]?.status === "complete";
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => scrollToSection(k)}
                aria-label={`${SECTION_META[k].label} — ${done ? "complete" : "not complete"}. Jump to section.`}
                className="flex w-full items-center gap-2.5 rounded px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span
                  aria-hidden
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    done ? "border-ink bg-ink text-parchment" : "border-ink/25 text-transparent",
                  ].join(" ")}
                >
                  {done ? <Check className="h-3 w-3" /> : "○"}
                </span>
                <span className={done ? "text-ink" : "text-ink/70"}>{SECTION_META[k].label}</span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-ink/35">
                  {SECTION_META[k].stage}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* ⚠ WHERE THE TICKS LIVE — stated, not implied (§26). */}
      {store === "device" && (
        <p className="mt-4 border-t border-ink/10 pt-3 text-xs leading-relaxed text-ink/55">
          Kept in this browser only{storeReason ? ` — ${storeReason}` : ""}. Sign in on this
          device to keep your place; cross-device progress is not switched on yet.
        </p>
      )}
    </nav>
  );
}

// ── the per-section control ─────────────────────────────────────────────────

/**
 * "Mark complete" / "✓ Completed" for one section.
 *
 * ⚠ AN AUTO-COMPLETABLE SECTION STILL GETS THIS CONTROL (§25). A student who
 * read the notes on paper, or watched the video elsewhere, is not lying — and
 * the app has no way to know. The manual route is always open; automatic
 * evidence just saves the click when we genuinely observed it.
 */
export function SectionComplete({ section }: { section: LessonSectionKey }) {
  const { states, mark, pending, error, store } = useLessonProgress();
  const state = states[section];
  const done = state?.status === "complete";
  const busy = pending === section;

  if (done) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink/70">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.07] px-2.5 py-1 text-xs font-medium text-ink">
          <Check className="h-3.5 w-3.5" aria-hidden />
          Completed
        </span>
        {state?.source === "auto" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
            {SECTION_META[section].autoEvidence ?? "automatically"}
          </span>
        )}
        {store === "device" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
            this browser only
          </span>
        )}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => mark(section, "manual")}
        disabled={busy}
        className="rounded-full border border-ink/25 px-4 py-1.5 text-sm transition-colors hover:border-ink hover:bg-ink/[0.04] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {busy ? "Saving…" : "Mark complete"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-ink/60">
          Kept in this browser — {error}
        </span>
      )}
    </div>
  );
}
