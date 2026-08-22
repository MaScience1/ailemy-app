"use client";

import { useCallback, useRef } from "react";

import { track } from "@/lib/analytics/posthog";
import { useLessonProgress } from "./LessonProgress";
import { MuxLessonPlayer } from "./MuxLessonPlayer";

/**
 * The lesson video, and the only honest way it can complete itself.
 *
 * ============================================================================
 * ⚠ 90% WATCHED IS MEASURED, NOT ASSUMED (§6, §25, §105)
 * ============================================================================
 * The threshold fires from the player's own timeupdate against its own
 * duration. It cannot fire for a video whose duration is unusable, it cannot
 * fire because the section scrolled into view, and it fires at most once —
 * the provider's re-fire guard keeps a returning student's original
 * completion date rather than stamping today's over it on every visit.
 *
 * Seeking to the end does satisfy it. That is a deliberate accepted limit: the
 * alternative is tracking watched INTERVALS, which needs storage this app does
 * not have yet, and the manual control below already exists for the student
 * who genuinely watched elsewhere. What we must not do is call a guess a
 * measurement.
 */

const COMPLETE_AT = 0.9;

export function LessonVideo({
  playbackId,
  title,
  lessonSlug,
}: {
  playbackId: string;
  title: string;
  lessonSlug: string;
}) {
  const { mark } = useLessonProgress();
  const fired = useRef(false);

  const onProgress = useCallback(
    (fraction: number) => {
      if (fired.current || fraction < COMPLETE_AT) return;
      fired.current = true;
      mark("video", "auto", { fraction_watched: Math.round(fraction * 100) });
    },
    [mark],
  );

  return (
    <div
      onPlay={() => track("lesson_section_viewed", { lesson: lessonSlug, section: "video" })}
    >
      <MuxLessonPlayer
        playbackId={playbackId}
        title={title}
        onProgress={onProgress}
        onEnded={() => onProgress(1)}
      />
    </div>
  );
}
