import { getEditContext } from "@/lib/admin/edit-mode";
import {
  blankLesson,
  blankPaper,
  loadLessonFormOptions,
  loadLessonRows,
  loadPaperFormOptions,
  loadPaperRows,
} from "@/lib/admin/inline-data";

/**
 * Server boundary that mounts the inline-edit provider ONLY for an admin with
 * edit mode on.
 *
 * WHY THIS EXISTS (and why pages must not import the client pieces directly):
 * a static `import { InlineEditProvider } from "./InlineEditProvider"` in a
 * page file puts that client component into the PAGE'S client module graph.
 * The bundler then emits and loads its chunk for every visitor, even when a
 * server-side `if` means it is never rendered. Measured on a production build:
 * /past-papers shipped the provider, the slide-over and the delete modal
 * ("type the title exactly") to logged-out users.
 *
 * Routing every client import through `await import()` AFTER the edit-mode
 * guard keeps those modules out of the page graph entirely, so a student's
 * bundle contains no edit code at all.
 *
 * Pages import only this server component and the server slots in ./slots.
 */
export async function InlineEditBoundary({
  kind,
  courseId = null,
  lessonIds,
  paperIds,
  children,
}: {
  kind: "lesson" | "paper";
  /** Prefills the course picker on "+ Add". */
  courseId?: string | null;
  lessonIds?: string[];
  paperIds?: string[];
  children: React.ReactNode;
}) {
  const { editMode } = await getEditContext();
  if (!editMode) return <>{children}</>;

  const { InlineEditProvider } = await import("./InlineEditProvider");

  if (kind === "lesson") {
    const [options, rows] = await Promise.all([
      loadLessonFormOptions(),
      loadLessonRows(lessonIds ?? []),
    ]);
    return (
      <InlineEditProvider
        lessonOptions={options}
        lessonRows={rows}
        lessonBlank={blankLesson(courseId, null)}
      >
        {children}
      </InlineEditProvider>
    );
  }

  const [options, rows] = await Promise.all([
    loadPaperFormOptions(),
    loadPaperRows(paperIds ?? []),
  ]);
  return (
    <InlineEditProvider
      paperOptions={options}
      paperRows={rows}
      paperBlank={blankPaper(courseId ?? "", null)}
    >
      {children}
    </InlineEditProvider>
  );
}
