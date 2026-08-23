"use client";

import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics/posthog";
import { Markdown } from "@/lib/lesson/markdown";

/**
 * Lesson notes — concise revision content, not a second deck (§11).
 *
 * ⚠ READING IS NOT OBSERVABLE, SO NOTES NEVER AUTO-COMPLETE (§25, §105).
 * Rendering the section proves the page loaded; expanding it proves a click.
 * Neither proves the student read anything, so the tick here is theirs to
 * give. Inferring completion from a scroll position would be the kind of
 * fabricated evidence §105's "no false completion" exists to forbid.
 *
 * Long notes collapse behind "Expand notes" so the section keeps its half of
 * the two-column row (§74's symmetry) instead of stretching it to the height
 * of the longest note in the course.
 */

const COLLAPSE_ABOVE_CHARS = 1200;

export function LessonNotes({ body, lessonSlug }: { body: string; lessonSlug: string }) {
  const longEnoughToCollapse = body.length > COLLAPSE_ABOVE_CHARS;
  const [expanded, setExpanded] = useState(!longEnoughToCollapse);
  const opened = useRef(false);

  useEffect(() => {
    if (expanded && !opened.current) {
      opened.current = true;
      track("notes_opened", { lesson: lessonSlug });
    }
  }, [expanded, lessonSlug]);

  return (
    <div>
      <div
        className={
          expanded
            ? ""
            : "relative max-h-64 overflow-hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-16 after:bg-gradient-to-t after:from-parchment after:to-transparent"
        }
      >
        <Markdown source={body} />
      </div>

      {longEnoughToCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-3 rounded-full border border-ink/25 px-4 py-1.5 text-sm transition-colors hover:border-ink hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {expanded ? "Collapse notes" : "Expand notes"}
        </button>
      )}
    </div>
  );
}
