"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { LessonForm, type LessonInitial } from "@/app/admin/lessons/_form";
import {
  PastPaperForm,
  type PaperInitial,
} from "@/app/admin/past-papers/_form";
import type {
  LessonFormOptions,
  PaperFormOptions,
} from "@/lib/admin/inline-data";

type OpenEditor =
  | { kind: "lesson"; mode: "create" | "edit"; initial: LessonInitial }
  | { kind: "paper"; mode: "create" | "edit"; initial: PaperInitial };

type InlineEditApi = {
  openLessonEdit: (id: string) => void;
  /** `overrides` carries the surrounding context (e.g. the unit being added to). */
  openLessonCreate: (overrides?: Partial<LessonInitial>) => void;
  openPaperEdit: (id: string) => void;
  openPaperCreate: (overrides?: Partial<PaperInitial>) => void;
  hasLessonSupport: boolean;
  hasPaperSupport: boolean;
};

const InlineEditContext = createContext<InlineEditApi | null>(null);

/**
 * Consumed by the pencil/＋ controls. Returns null when there is no provider
 * above — which is exactly the case for a student, since the provider is only
 * rendered by the server when edit mode is on. Controls render nothing then.
 */
export function useInlineEdit(): InlineEditApi | null {
  return useContext(InlineEditContext);
}

export function InlineEditProvider({
  lessonOptions,
  lessonRows,
  lessonBlank,
  paperOptions,
  paperRows,
  paperBlank,
  children,
}: {
  lessonOptions?: LessonFormOptions;
  lessonRows?: Record<string, LessonInitial>;
  lessonBlank?: LessonInitial;
  paperOptions?: PaperFormOptions;
  paperRows?: Record<string, PaperInitial>;
  paperBlank?: PaperInitial;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<OpenEditor | null>(null);

  const close = useCallback(() => setEditor(null), []);

  // Close on Escape.
  useEffect(() => {
    if (!editor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, close]);

  const api = useMemo<InlineEditApi>(
    () => ({
      hasLessonSupport: Boolean(lessonOptions && lessonBlank),
      hasPaperSupport: Boolean(paperOptions && paperBlank),
      openLessonEdit: (id) => {
        const initial = lessonRows?.[id];
        if (!initial) {
          alert("This lesson's editable data was not loaded. Refresh and retry.");
          return;
        }
        setEditor({ kind: "lesson", mode: "edit", initial });
      },
      openLessonCreate: (overrides) => {
        if (!lessonBlank) return;
        setEditor({
          kind: "lesson",
          mode: "create",
          initial: { ...lessonBlank, ...overrides },
        });
      },
      openPaperEdit: (id) => {
        const initial = paperRows?.[id];
        if (!initial) {
          alert("This paper's editable data was not loaded. Refresh and retry.");
          return;
        }
        setEditor({ kind: "paper", mode: "edit", initial });
      },
      openPaperCreate: (overrides) => {
        if (!paperBlank) return;
        setEditor({
          kind: "paper",
          mode: "create",
          initial: { ...paperBlank, ...overrides },
        });
      },
    }),
    [lessonOptions, lessonRows, lessonBlank, paperOptions, paperRows, paperBlank],
  );

  const onSaved = useCallback(() => {
    close();
    router.refresh();
  }, [close, router]);

  return (
    <InlineEditContext.Provider value={api}>
      {children}

      {editor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            editor.mode === "create"
              ? `New ${editor.kind}`
              : `Edit ${editor.kind}`
          }
          className="fixed inset-0 z-[9998] flex justify-end"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close editor"
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />

          {/* Panel */}
          <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editor.mode === "create" ? "New" : "Edit"}{" "}
                {editor.kind === "lesson" ? "lesson" : "past paper"}
              </h2>
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-slate-900">
              {editor.kind === "lesson" && lessonOptions && (
                <LessonForm
                  mode={editor.mode}
                  initial={editor.initial}
                  courses={lessonOptions.courses}
                  units={lessonOptions.units}
                  topics={lessonOptions.topics}
                  specPoints={lessonOptions.specPoints}
                  onDone={onSaved}
                  redirectAfterCreate={false}
                  showCancel={false}
                />
              )}
              {editor.kind === "paper" && paperOptions && (
                <PastPaperForm
                  mode={editor.mode}
                  initial={editor.initial}
                  courses={paperOptions.courses}
                  units={paperOptions.units}
                  onDone={onSaved}
                  redirectAfterCreate={false}
                  showCancel={false}
                  optionsError={paperOptions.error}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </InlineEditContext.Provider>
  );
}
