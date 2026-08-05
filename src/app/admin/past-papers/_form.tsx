"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { EXAM_SESSIONS, isExamSession } from "@/lib/catalogue/exam-sessions";

import { createPastPaper, updatePastPaper } from "./actions";

/**
 * Structurally mirrors CourseOption in src/lib/admin/paper-form-options.ts.
 * Declared locally rather than imported because that module is `server-only`
 * and this is a client component — a type-only import would be erased, but the
 * codebase has already been bitten once by a types/values split across that
 * boundary (see past-paper-filter-types.ts), so this keeps it unambiguous.
 */
type CourseOption = {
  id: string;
  label: string;
  boardShortName?: string;
  boardName?: string;
  subjectName?: string;
  level?: string;
  courseName?: string;
};
type UnitOption = { id: string; label: string; parentId: string };

export type PaperInitial = {
  id: string;
  course_id: string;
  unit_id: string | null;
  slug: string;
  year: number;
  session: string;
  paper_code: string | null;
  paper_name: string;
  paper_pdf_path: string | null;
  markscheme_pdf_path: string | null;
  /** Optional: absent until migration 0012 is applied. */
  examiner_report_pdf_path?: string | null;
  walkthrough_mux_playback_id: string | null;
  walkthrough_duration_minutes: number | null;
  sort_order: number | null;
  status: string;
};

/**
 * Qualification groups for the Course dropdown, in display order.
 *
 * Keyed on curricula.short_name, which is what loadPaperFormOptions puts in
 * boardShortName. The labels are NOT taken from a single column: three of them
 * ("Edexcel A-Level", "AQA A-Level", "OCR A-Level") are the curricula.name
 * value while the rest are short_name, so neither column alone reproduces the
 * requested list. Hard-coding the mapping is therefore deliberate.
 *
 * All 11 curricula currently in the database are covered. Anything not listed
 * still appears, under a trailing "Other" group — a course must never vanish
 * from the dropdown just because its board is unrecognised.
 */
const QUALIFICATION_GROUPS: { shortName: string; label: string }[] = [
  { shortName: "Edexcel IAL", label: "Edexcel IAL" },
  { shortName: "Edexcel", label: "Edexcel A-Level" },
  { shortName: "AQA", label: "AQA A-Level" },
  { shortName: "OCR", label: "OCR A-Level" },
  { shortName: "IB", label: "IB" },
  { shortName: "Edexcel IGCSE", label: "Edexcel IGCSE" },
  { shortName: "CIE IGCSE", label: "CIE IGCSE" },
  { shortName: "AQA GCSE", label: "AQA GCSE" },
  { shortName: "Edexcel GCSE", label: "Edexcel GCSE" },
  { shortName: "OCR GCSE", label: "OCR GCSE" },
  { shortName: "AP", label: "AP" },
];

/** Within a group: subject A-Z, then level — AS before A2. */
const LEVEL_ORDER: Record<string, number> = {
  AS: 1,
  A2: 2,
  "A-Level": 3,
  SL: 4,
  HL: 5,
  AP: 6,
  IGCSE: 7,
  GCSE: 8,
};

function levelRank(level?: string): number {
  return LEVEL_ORDER[level ?? ""] ?? 99;
}

/**
 * Drop whichever board prefix the course name actually carries, so the option
 * text does not repeat its own optgroup label.
 *
 * Three candidates are needed because no single one covers the data:
 *   "Edexcel IAL AS Chemistry"   carries short_name  "Edexcel IAL"
 *   "AQA A-Level Biology"        carries the GROUP LABEL "AQA A-Level"
 *                                (short_name is only "AQA")
 *   "Cambridge IGCSE Biology"    carries curricula.name "Cambridge IGCSE"
 *                                (short_name is "CIE IGCSE" — no match)
 * Longest match wins, so "AQA A-Level" is preferred over "AQA".
 */
function stripBoardPrefix(course: CourseOption, groupLabel?: string): string {
  const name = course.courseName ?? course.label;
  const candidates = [groupLabel, course.boardName, course.boardShortName]
    .filter((c): c is string => Boolean(c))
    .sort((a, b) => b.length - a.length);
  for (const prefix of candidates) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase() + " ")) {
      return name.slice(prefix.length + 1);
    }
  }
  return name;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function PastPaperForm({
  mode,
  initial,
  courses,
  units,
  onDone,
  redirectAfterCreate = true,
  showCancel = true,
  optionsError = null,
}: {
  mode: "create" | "edit";
  initial: PaperInitial | null;
  courses: CourseOption[];
  units: UnitOption[];
  /** Called after a successful save — lets a slide-over close itself. */
  onDone?: () => void;
  /** /admin/past-papers/new navigates after create; a slide-over does not. */
  redirectAfterCreate?: boolean;
  /** The slide-over provides its own close affordance. */
  showCancel?: boolean;
  /**
   * Set when the course/unit option lists could not be loaded. Rendered as a
   * banner and blocks submission — an empty Course dropdown otherwise looks
   * like "no courses exist" rather than "the admin client is misconfigured".
   */
  optionsError?: string | null;
}) {
  const router = useRouter();

  const [courseId, setCourseId] = useState(initial?.course_id ?? "");
  const [unitId, setUnitId] = useState(initial?.unit_id ?? "");
  const [session, setSession] = useState(initial?.session ?? "");
  const [year, setYear] = useState(
    String(initial?.year ?? new Date().getFullYear()),
  );
  const [slug, setSlug] = useState(initial?.slug ?? "");
  // An existing paper's slug is load-bearing (it is in URLs), so never
  // regenerate over it. Only a fresh, untouched create field auto-fills.
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  const boundAction =
    mode === "create"
      ? createPastPaper
      : (prev: unknown, fd: FormData) =>
          updatePastPaper(initial!.id, prev as never, fd);

  const [state, formAction, isPending] = useActionState(
    boundAction as never,
    null,
  );

  // Post-save navigation belongs in an effect, not the render body: calling
  // router.push()/refresh() while rendering re-enters React's render phase and
  // loops when this form is mounted inside a long-lived slide-over.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!state || !(state as { ok?: boolean }).ok) return;
    if (mode === "create" && redirectAfterCreate) {
      const id = (state as { ok: true; data?: { id: string } }).data?.id;
      if (id) {
        router.push(`/admin/past-papers/${id}`);
        return;
      }
    }
    router.refresh();
    onDoneRef.current?.();
  }, [state, mode, redirectAfterCreate, router]);

  // --- Course dropdown: grouped by qualification, sorted within each group.
  const grouped = useMemo(() => {
    const byBoard = new Map<string, CourseOption[]>();
    for (const c of courses) {
      const key = c.boardShortName ?? "";
      const list = byBoard.get(key);
      if (list) list.push(c);
      else byBoard.set(key, [c]);
    }
    const sortWithin = (list: CourseOption[], groupLabel?: string) =>
      [...list].sort(
        (a, b) =>
          (a.subjectName ?? "").localeCompare(b.subjectName ?? "") ||
          levelRank(a.level) - levelRank(b.level) ||
          stripBoardPrefix(a, groupLabel).localeCompare(
            stripBoardPrefix(b, groupLabel),
          ),
      );

    const out = QUALIFICATION_GROUPS.filter((g) => byBoard.has(g.shortName)).map(
      (g) => ({
        label: g.label,
        courses: sortWithin(byBoard.get(g.shortName)!, g.label),
      }),
    );

    // Anything whose board is not in the list above still has to be reachable.
    const known = new Set(QUALIFICATION_GROUPS.map((g) => g.shortName));
    const leftovers = [...byBoard.entries()]
      .filter(([k]) => !known.has(k))
      .flatMap(([, v]) => v);
    if (leftovers.length) {
      out.push({ label: "Other", courses: sortWithin(leftovers) });
    }
    return out;
  }, [courses]);

  // --- Unit dropdown: only units belonging to the selected course.
  const unitsForCourse = useMemo(
    () => (courseId ? units.filter((u) => u.parentId === courseId) : []),
    [units, courseId],
  );

  function onCourseChange(next: string) {
    setCourseId(next);
    // A unit chosen under the old course almost certainly does not belong to
    // the new one, and past_papers.unit_id has no cross-course guard.
    setUnitId("");
  }

  // --- Slug auto-generation from course + session + year.
  const selectedCourse = courses.find((c) => c.id === courseId);
  const suggestedSlug = useMemo(() => {
    // Nothing until BOTH a course and a session are chosen. Generating from a
    // year alone produced a slug of just "2026" on a fresh form, which reads
    // as broken and would be a meaningless identifier if submitted.
    if (!selectedCourse || !session) return "";
    // Full course name — it already carries the board, so the slug is
    // self-describing rather than needing the parts reassembled.
    const name = selectedCourse.courseName ?? selectedCourse.label;
    return slugify([name, session, year].filter(Boolean).join(" "));
  }, [selectedCourse, session, year]);

  useEffect(() => {
    if (slugTouched) return;
    setSlug(suggestedSlug);
  }, [suggestedSlug, slugTouched]);

  // A row whose stored session is off-list — entered out of band, e.g. by hand
  // in SQL — must not have that value silently rewritten just because an admin
  // opened the form, so it is offered as an extra, clearly-labelled option.
  // Saving it still fails: the server action rejects anything outside
  // EXAM_SESSIONS. That is the intent — the error names the legal values and
  // forces the cleanup, rather than letting a second spelling of one session
  // quietly persist and split the /past-papers filters.
  const sessionOptions = useMemo(() => {
    const stored = initial?.session?.trim();
    return stored && !isExamSession(stored)
      ? [...EXAM_SESSIONS, stored]
      : [...EXAM_SESSIONS];
  }, [initial?.session]);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {optionsError && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-semibold">{optionsError}</p>
          <p className="mt-1 text-red-800">
            The catalogue itself is fine, so this is a credentials problem, not
            missing data. Saving is disabled until the courses list loads.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course" required>
          <select
            name="course_id"
            value={courseId}
            onChange={(e) => onCourseChange(e.target.value)}
            required
            className={INPUT}
          >
            <option value="">
              {optionsError ? "— unavailable —" : "— select course —"}
            </option>
            {grouped.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {stripBoardPrefix(c, g.label)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field
          label="Unit"
          hint={
            courseId
              ? unitsForCourse.length
                ? "optional"
                : "no units defined for this course"
              : undefined
          }
        >
          <select
            name="unit_id"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            disabled={!courseId}
            className={INPUT}
          >
            <option value="">
              {courseId ? "— none —" : "Choose a course first"}
            </option>
            {unitsForCourse.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paper name" hint="displayed to students" required>
          <input
            name="paper_name"
            defaultValue={initial?.paper_name ?? ""}
            required
            className={INPUT}
          />
        </Field>
        <Field
          label="Slug"
          hint={
            slugTouched
              ? "unique within course"
              : "auto-generated from course, session and year — edit to override"
          }
          required
        >
          <input
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
            pattern="[a-z0-9-]+"
            className={INPUT}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Session" required>
          <select
            name="session"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            required
            className={INPUT}
          >
            <option value="">— select session —</option>
            {sessionOptions.map((s) => (
              <option key={s} value={s}>
                {s}
                {isExamSession(s) ? "" : " — legacy value, pick a canonical one to save"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Year" required>
          <input
            name="year"
            type="number"
            min={1900}
            max={2200}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            className={INPUT}
          />
        </Field>
        <Field label="Paper code" hint="e.g. WCH11/01">
          <input
            name="paper_code"
            defaultValue={initial?.paper_code ?? ""}
            className={INPUT}
          />
        </Field>
      </div>

      {/*
        Three stacked FULL-WIDTH rows. These previously sat in a 3-column grid,
        where the three "current: <path>" hints ran together and a file could be
        dropped into the wrong slot. Each row now owns its full line: bold
        label, then the input, then the current filename on its own truncating
        line with a Remove control.
      */}
      <fieldset className="min-w-0 rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          PDFs (public bucket)
        </legend>
        <div className="space-y-5">
          <FileRow
            label="Question paper"
            required
            inputName="paper_file"
            removeName="remove_paper_file"
            currentPath={initial?.paper_pdf_path ?? null}
          />
          <FileRow
            label="Mark scheme"
            inputName="markscheme_file"
            removeName="remove_markscheme_file"
            currentPath={initial?.markscheme_pdf_path ?? null}
          />
          <FileRow
            label="Examiner report (optional)"
            inputName="examiner_report_file"
            removeName="remove_examiner_report_file"
            currentPath={initial?.examiner_report_pdf_path ?? null}
          />
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Leave a field empty to keep the current file. All three slots live in
          the public <code className="mx-1 rounded bg-slate-100 px-1">papers</code>
          bucket; URLs are constructed directly by the /past-papers pages.
        </p>
      </fieldset>

      <fieldset className="min-w-0 rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Walkthrough
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mux playback ID">
            <input
              name="walkthrough_mux_playback_id"
              defaultValue={initial?.walkthrough_mux_playback_id ?? ""}
              className={INPUT}
            />
          </Field>
          <Field label="Duration (minutes)">
            <input
              name="walkthrough_duration_minutes"
              type="number"
              defaultValue={initial?.walkthrough_duration_minutes ?? ""}
              className={INPUT}
            />
          </Field>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <select
            name="status"
            defaultValue={initial?.status ?? "live"}
            className={INPUT}
          >
            <option value="draft">draft</option>
            <option value="live">live</option>
            <option value="in_progress">in_progress</option>
            <option value="coming_soon">coming_soon</option>
            <option value="archived">archived</option>
          </select>
        </Field>
        <Field label="Order index">
          <input
            name="sort_order"
            type="number"
            defaultValue={initial?.sort_order ?? 0}
            className={INPUT}
          />
        </Field>
      </div>

      {state && !(state as { ok?: boolean }).ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {(state as { error?: string }).error ?? "Something went wrong"}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending || Boolean(optionsError)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending
            ? "Saving…"
            : mode === "create"
              ? "Create past paper"
              : "Save changes"}
        </button>
        {showCancel && (
          <Link
            href="/admin/past-papers"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}

/**
 * One full-width PDF slot: bold label, file input, and the current filename on
 * its own truncating line with a Remove checkbox.
 *
 * Remove is a checkbox rather than a button because the surrounding form posts
 * to a server action — a button would need its own round trip, and an
 * unsubmitted "removed" state that a cancelled edit leaves behind is worse than
 * one that only takes effect on save.
 */
function FileRow({
  label,
  required = false,
  inputName,
  removeName,
  currentPath,
}: {
  label: string;
  required?: boolean;
  inputName: string;
  removeName: string;
  currentPath: string | null;
}) {
  const [remove, setRemove] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="w-full">
      <p className="text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </p>

      <input
        name={inputName}
        type="file"
        accept="application/pdf"
        onChange={(e) => setPicked(e.target.files?.[0]?.name ?? null)}
        className="mt-1.5 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-50"
      />

      <div className="mt-1.5 flex min-w-0 items-center gap-3">
        <span
          // title carries the untruncated value — the whole point of this row
          // is that a long storage path must not push anything else around.
          title={picked ?? currentPath ?? undefined}
          className={`min-w-0 flex-1 truncate text-xs ${
            remove && !picked
              ? "text-slate-400 line-through"
              : picked
                ? "text-slate-800"
                : currentPath
                  ? "text-slate-600"
                  : "text-slate-400"
          }`}
        >
          {picked
            ? `New file: ${picked}`
            : currentPath
              ? currentPath
              : "No file"}
        </span>

        {currentPath && !picked && (
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              name={removeName}
              value="1"
              checked={remove}
              onChange={(e) => setRemove(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            Remove
          </label>
        )}
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}
