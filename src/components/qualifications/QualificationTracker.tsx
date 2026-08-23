"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics/posthog";
import type { Board, Level, QualificationScope } from "@/lib/qualifications/model.ts";
import { writePreference } from "@/lib/qualifications/preference.ts";

/**
 * Analytics for the qualification flow (§40).
 *
 * ============================================================================
 * ⚠ TAXONOMY ONLY — NOTHING ABOUT THE PERSON (§40)
 * ============================================================================
 * Every value sent here is public catalogue vocabulary: a subject slug, a
 * level, "uk" or "international", a board slug. No id, no email, no
 * indication of who chose it. What the funnel needs to know is that a choice
 * was made and which branch it took.
 *
 * ⚠ THE STEP VIEW *IS* THE SELECTION EVENT. Landing on /learn/chemistry/gcse
 * is what "chose GCSE" means — there is no separate click to instrument,
 * because each step is a real URL. Board choice is the exception: it leaves
 * this flow for the pathway route, so it is captured by a delegated listener
 * on the cards rather than by the destination.
 */
export function QualificationTracker({
  subject,
  level,
  scope,
  boards,
}: {
  subject: string;
  level: string;
  scope?: string;
  boards?: readonly Board[];
}) {
  useEffect(() => {
    track(scope ? "qualification_scope_selected" : "qualification_level_selected", {
      subject: subject as "chemistry" | "biology" | "physics",
      level,
      scope,
    });
  }, [subject, level, scope]);

  useEffect(() => {
    if (!boards || boards.length === 0) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-qualification-choice]",
      );
      const value = el?.dataset.qualificationChoice;
      if (!value) return;
      track(value === "unsure" ? "exam_board_unsure" : "exam_board_selected", {
        subject: subject as "chemistry" | "biology" | "physics",
        level,
        scope,
        board: value === "unsure" ? undefined : value,
      });
      // §17 — remember it, so the flow stops asking. "unsure" is stored as a
      // real answer with a null curriculum (§19), not left unsaved: a student
      // who told us they do not know should not be asked again on every visit.
      writePreference({
        subject,
        level: level as Level,
        scope: scope as QualificationScope,
        curriculum: value === "unsure" ? null : value,
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [boards, subject, level, scope]);

  return null;
}
