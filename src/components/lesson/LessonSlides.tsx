"use client";

import { useCallback } from "react";

import { useLessonProgress } from "./LessonProgress";
import { LessonPlayer, type PlayerFrame } from "./LessonPlayer";
import { SpecJump } from "./SpecJump";

/**
 * The client half of the slides section.
 *
 * ============================================================================
 * ⚠ THIS FILE EXISTS BECAUSE A CALLBACK CANNOT CROSS THE SERVER BOUNDARY
 * ============================================================================
 * The page is a server component; the completion context is client state. A
 * server component cannot hand `onAllSlidesViewed` to the player, because a
 * function is not serialisable in an RSC payload. So the server computes the
 * frames (data, serialisable) and this thin client wrapper owns the callback.
 *
 * ⚠ THE CALLBACK RE-FIRES ON EVERY MOUNT AND THAT IS HANDLED ELSEWHERE. The
 * player's `completedFired` ref resets whenever the component remounts, so a
 * returning student whose visited-set is restored fires "all slides viewed"
 * again on every page load. The provider's mark() ignores a section that is
 * already complete — without that guard, this callback would rewrite the
 * student's completion date to today, every single visit.
 */

export function LessonSlides({
  lessonSlug,
  version,
  frames,
  slideCount,
  watermark,
  specTargets,
}: {
  lessonSlug: string;
  version: number;
  frames: PlayerFrame[];
  slideCount: number;
  watermark: string | null;
  specTargets: { code: string; slideN: number }[];
}) {
  const { mark } = useLessonProgress();

  const onAllSlidesViewed = useCallback(() => {
    mark("slides", "auto", { slides: slideCount });
  }, [mark, slideCount]);

  return (
    <div className="grid gap-4" data-lesson-deck>
      <LessonPlayer
        lessonSlug={lessonSlug}
        version={version}
        frames={frames}
        slideCount={slideCount}
        watermark={watermark}
        onAllSlidesViewed={onAllSlidesViewed}
      />
      <SpecJump targets={specTargets} />
    </div>
  );
}
