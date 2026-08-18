"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight,
  Loader2, Maximize2, Minimize2, X,
} from "lucide-react";

import { isResolved } from "@/lib/exam/markscheme-proposals";
import type {
  LineKind,
  LineRuling,
  PointRuling,
  ProposedLine,
  QuestionRulings,
  ReviewItem,
} from "@/lib/exam/markscheme-proposals";
import type { ReviewData, EmitResultReport } from "@/lib/exam/markscheme-review";
import {
  locateBlock,
  toViewerPage,
  toViewerTarget,
  navMove,
  sortByQuestionNumber,
  type SourceLocation,
} from "@/lib/exam/question-nav";
import {
  resolveDistractorOption,
  isValidOption,
  OPTION_ALPHABET,
} from "@/lib/exam/distractor";
import { extractMcqKey } from "@/lib/exam/deterministic";
import {
  suggestFor,
  planBatch,
  canAutoVerify,
  spotCheckIndices,
  type Suggestion,
  type BatchPlan,
  type BatchCandidate,
} from "@/lib/exam/precedent";
import {
  BatchPanel,
  VerifyPanel,
  BulkApprovePanel,
  ManualBlockPanel,
  ManualLinePanel,
  MisfiledPanel,
  type MisfiledLine,
  type VerifyCandidate,
} from "@/components/admin/AcceleratorPanels";
import {
  saveQuestionRulingsAction,
  emitFixtureAction,
  applyBatchAction,
  bulkApproveAction,
  addManualBlockAction,
  addManualLineAction,
  convertMisfiledLinesAction,
} from "@/app/admin/papers/[paper]/markscheme/actions";

/**
 * Rule on extracted mark-scheme proposals against the published PDF.
 *
 * ============================================================================
 * THE BOTTLENECK THIS EXISTS FOR
 * ============================================================================
 * Extraction is solved: the extractor reads a paper in seconds and refuses to
 * classify the lines that carry an examiner ruling. 68 of those are sitting in
 * WCH11/01 with nowhere to make one. That, not extraction, is what stands
 * between this and every remaining paper.
 *
 * ============================================================================
 * ⚠ A RULING IS PRESENTED AS A CHOICE, NEVER AS A DEFAULT
 * ============================================================================
 * Every flagged line asks the actual question — is this a criterion, an accept,
 * a reject, or guidance — with NOTHING pre-selected. The person answering will
 * be tired and there will be 68 of them; a pre-selected radio is a decision
 * made by the layout rather than by the reviewer, and "Do not accept X" filed
 * as a concession is precisely the failure that shipped once already.
 *
 * The same reason the count of remaining rulings is on screen at all times: a
 * queue you cannot see the end of gets abandoned in the middle, and a
 * half-reviewed mark scheme looks exactly like a finished one.
 *
 * ============================================================================
 * ⚠ NOTHING IS CONCLUDED FROM AN UNPAINTED PAGE
 * ============================================================================
 * The region mapper refuses to accept a drawn box until the canvas has actually
 * painted, because a box drawn over blank white is a box in the wrong place. The
 * same rule applies here for the same reason: approving a question means "I
 * checked this against the page", and the page has to be ON THE SCREEN. Approve
 * is disabled until the source page for that question has painted, and says so.
 */

type Draft = { points: Record<string, PointRuling>; lines: Record<string, LineRuling> };

/** Where the pane layout is remembered. Display state only — never rulings. */
const LAYOUT_KEY = "markscheme-review:layout";

/**
 * ⚠ THE REVIEW COLUMN NEVER DISAPPEARS BY DRAGGING. Below about 30% the
 * ruling buttons start wrapping into an unusable stack, and a reviewer who
 * dragged too far would think the tool had broken. Losing the column entirely
 * is what the expand toggle is for, and that is reversible by one click.
 */
const clampSplit = (pct: number): number => Math.min(80, Math.max(30, Math.round(pct)));

const LINE_CHOICES: { kind: LineKind; label: string; hint: string }[] = [
  { kind: "criterion", label: "Criterion", hint: "this line IS a marking point" },
  { kind: "accept", label: "Accept", hint: "still earns the mark" },
  { kind: "reject", label: "Reject", hint: "must NOT earn the mark" },
  { kind: "guidance", label: "Guidance", hint: "neither — examiner prose" },
  // ⚠ BEFORE Discard, DELIBERATELY. These lines — "A is incorrect because…" —
  // are the ones a reviewer was previously forced to throw away, and the
  // button next to the one you would otherwise press is the one that gets
  // pressed. Keyboard 1–6 follows this array, so Discard moves from 5 to 6.
  {
    kind: "distractor_feedback",
    label: "Distractor feedback",
    hint: "why a specific wrong option is wrong — kept for the student, never marked",
  },
  { kind: "discard", label: "Discard", hint: "carries nothing we should store" },
];

/**
 * The correct option letter, read from the question's own criterion.
 *
 * ⚠ THE MARK SCHEME, NOT A SEEDED ROW. Rulings happen before seeding — 25 of
 * 80 marks are seeded — so an answer key usually does not exist yet. The
 * criterion ("The only correct answer is B") is the record that always does,
 * and it is the same one the marking layer refuses to mark without. Null when
 * the question is not an MCQ, which simply skips the cross-check.
 */
function correctOptionOf(item: ReviewItem): string | null {
  for (const p of item.question.points) {
    const key = extractMcqKey(p.criterion);
    if (key) return key;
  }
  return null;
}

/**
 * Turn what is stored on disk back into the shape the editor holds.
 *
 * Stored rulings and the in-progress draft are deliberately the SAME shape, so
 * a reload is a seed rather than a merge. A merge would need a rule for what
 * happens when the two disagree, and the honest rule — disk wins, because it
 * is the only copy that survived — is what seeding already does.
 */
function seedDraft(rulings: ReviewData["rulings"]): Record<string, Draft> {
  const out: Record<string, Draft> = {};
  for (const [qn, book] of Object.entries(rulings ?? {})) {
    out[qn] = { points: book.points ?? {}, lines: book.lines ?? {} };
  }
  return out;
}

export function MarkSchemeReview({ data }: { data: ReviewData }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [shellWidth, setShellWidth] = useState(0);
  const [pageHeightPt, setPageHeightPt] = useState(0);

  /**
   * ⚠ TRUE ONLY ONCE INK IS ON THE CANVAS. `status === "ready"` says the
   * document loaded, which is a different claim: the canvas is resized (and so
   * cleared) before every render, so between those two moments the page is
   * blank while the chrome would happily say it is showing page 12.
   */
  const [painted, setPainted] = useState(false);

  /**
   * How much of the width the evidence pane gets, and whether it has the lot.
   *
   * ⚠ THE PDF IS THE THING BEING READ. A reviewer is comparing a printed table
   * against a proposal; half a screen was an even split between the document
   * and the form, which is not what the work is. It starts at 58% and the
   * splitter goes to 80.
   *
   * ⚠ INITIALISED TO THE DEFAULT, THEN LOADED IN AN EFFECT. Reading
   * localStorage in the initialiser would render 58 on the server and 74 on
   * the client, which is a hydration mismatch — React discards the tree and
   * remounts, and a remount here means the PDF loads a second time.
   */
  const [splitPct, setSplitPct] = useState(58);
  const [expanded, setExpanded] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAYOUT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { splitPct?: number; expanded?: boolean };
      if (typeof parsed.splitPct === "number") setSplitPct(clampSplit(parsed.splitPct));
      if (typeof parsed.expanded === "boolean") setExpanded(parsed.expanded);
    } catch {
      // A corrupt or unavailable store is not a reason to fail to render a
      // review surface. The default layout is a perfectly good layout.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ splitPct, expanded }));
    } catch {
      /* private browsing, quota — the layout simply does not persist. */
    }
  }, [splitPct, expanded]);

  /**
   * Drag the splitter.
   *
   * ⚠ POINTER EVENTS ON `window`, NOT ON THE HANDLE. A drag that leaves the
   * 10px handle — which every drag does — would otherwise stop receiving moves
   * and stick. Capture on the window and release on pointerup.
   */
  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const el = gridRef.current;
    if (!el) return;
    const onMove = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return;
      setSplitPct(clampSplit(((ev.clientX - r.left) / r.width) * 100));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
    // Without this a drag selects the mark-scheme text under the pointer.
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  /**
   * The questions in canonical exam order — 2 before 10, 20 before 20(a),
   * 20(a)(i) before 20(a)(ii) before 20(b).
   *
   * ⚠ THE ONE ORDERED LIST, AND EVERYTHING READS IT. The navigator, j/k, the
   * "first question" this opens on and the fallback when a selection goes
   * stale all derive from `ordered`, so there is no way for the list on screen
   * and the order the keys walk to drift apart.
   *
   * ⚠ DISPLAY ONLY. sortByQuestionNumber copies; `data.items` keeps the order
   * the extractor read the paper in, which is provenance, and nothing here
   * writes to the artefact or the database.
   */
  const ordered = useMemo(
    () => sortByQuestionNumber(data.items, (i) => i.question.questionNumber),
    [data.items],
  );

  const [selected, setSelected] = useState<string>(
    () => ordered[0]?.question.questionNumber ?? "",
  );

  /**
   * Which accelerator screen is open, if any.
   *
   * ⚠ null IS THE ONLY STATE IN WHICH ANYTHING HAS HAPPENED. Every panel is a
   * question: opening one computes, closing one discards. Nothing is written
   * until its confirm handler calls a server action.
   */
  const [panel, setPanel] = useState<
    | { kind: "batch"; plan: BatchPlan }
    | { kind: "verify"; eligible: VerifyCandidate[]; excluded: { questionNumber: string; pointCode: string; criterion: string; reason: string }[] }
    | { kind: "bulk"; candidates: { questionNumber: string; marks: number; points: number; lines: number }[] }
    | { kind: "block" }
    | { kind: "line"; questionNumber: string; isApproved: boolean }
    | { kind: "misfiled" }
    | null
  >(null);
  const [panelBusy, setPanelBusy] = useState(false);
  /** Auto-verified points the founder has been asked to eyeball. */
  const [spotCheck, setSpotCheck] = useState<VerifyCandidate[]>([]);
  const [spotChecked, setSpotChecked] = useState<Record<string, true>>({});

  /**
   * Where the selected question's evidence is, in the SOURCE document's own
   * coordinates — page (1-based, converted once by question-nav) and a band in
   * PDF points.
   *
   * ⚠ POINTS, NOT PERCENTAGES, IN STATE. The percentage depends on the height
   * of the page currently rendered, which is not known until it renders; keep
   * the source-of-truth in the units the artefact recorded and convert at paint
   * time, so a selection made before the first render is not silently wrong.
   */
  const [locus, setLocus] = useState<SourceLocation | null>(null);
  /** The band as the viewer needs it. Null until a page has been measured. */
  const target = useMemo(
    () => (locus ? toViewerTarget(locus, pageHeightPt) : null),
    [locus, pageHeightPt],
  );
  const bandRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  /**
   * ⚠ SEEDED FROM WHAT IS ON DISK, NOT EMPTY.
   *
   * This used to start `{}`. Rulings persisted correctly and the page reloaded
   * showing none of them: every radio unselected, every line counted as still
   * needing a decision. Nothing was lost — but a reviewer cannot tell "your
   * work is safe, the screen just cannot see it" from "your work is gone", and
   * either way they rule on all 68 lines again.
   */
  const [draft, setDraft] = useState<Record<string, Draft>>(() => seedDraft(data.rulings));

  /**
   * The revision each question was at when this tab last saw it. Sent with
   * every save so a second tab cannot overwrite this one silently, and updated
   * from the server's reply on success.
   */
  const [revisions, setRevisions] = useState<Record<string, number>>(() =>
    Object.fromEntries(Object.entries(data.rulings).map(([qn, r]) => [qn, r.revision ?? 0])),
  );

  /**
   * Questions edited since their last successful save.
   *
   * ⚠ THE COUNT ON SCREEN IS DERIVED FROM STORED STATE; this is what keeps
   * that honest. Without it, ruling a line would decrement "remaining" the
   * instant it was clicked, so a reviewer whose save had failed — or who never
   * pressed save — would watch the number reach zero with the work still only
   * in a browser tab. The number now means "ruled AND on disk", and unsaved
   * work is reported separately rather than folded into it.
   */
  const [dirty, setDirty] = useState<Record<string, true>>({});

  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<
    { kind: "ok" | "bad" | "conflict"; text: string } | null
  >(null);
  const [onlyUnruled, setOnlyUnruled] = useState(false);

  /** Result of the last emit. Refusals are the useful part, so they are kept. */
  // ⚠ THE SERVER'S TYPE, NOT A HAND-COPIED ONE. This was written out inline as
  // `{ ok: true; path; questions }`, so when the emitter gained `refusals` and
  // `marks` the component simply did not see them — a duplicated shape that
  // silently lagged the thing it described. Importing the type means the next
  // field arrives here as a compile error rather than as nothing at all.
  const [emit, setEmit] = useState<EmitResultReport | null>(null);
  const [emitting, setEmitting] = useState(false);

  // ── measure, synchronously on mount ──────────────────────────────────────
  // An observer alone never fires in a browser that reports a stable size, and
  // the pane then stays 0 wide with no error — a blank tool that looks broken.
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    setShellWidth(el.clientWidth);
    // ⚠ DEBOUNCED, because the width is now DRAGGABLE. Every change to
    // shellWidth re-renders the PDF at the new resolution; an undebounced
    // observer turns one splitter drag into dozens of renders a second, each
    // cancelling the last, with `painted` flickering false — which also
    // flickers the Approve gate off. One render when the pointer settles is
    // what was wanted all along; window resizing had the same problem quietly.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShellWidth(width), 120);
    });
    ro.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  // ── load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!data.markSchemeUrl) {
      setStatus("error");
      setLoadError("This paper has no mark-scheme PDF, so there is nothing to check the proposals against.");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ url: data.markSchemeUrl! });
        loadingTaskRef.current = task;
        const doc = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        console.error("[MarkSchemeReview] failed to load the mark scheme", e);
        setStatus("error");
        // ⚠ A FAILURE RENDERS AS A FAILURE. "No proposals selected" is this
        // tool's normal empty state, so a swallowed load error would look
        // identical to a working tool — and someone would rule on 68 lines
        // without ever seeing the page they were meant to be checking.
        setLoadError("The mark scheme could not be loaded, so no page is being shown. Nothing here can be approved until it is.");
      }
    })();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      docRef.current = null;
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
    };
  }, [data.markSchemeUrl]);

  // ── render the current page ──────────────────────────────────────────────
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (status !== "ready" || !doc || !canvas || shellWidth <= 0) return;
    let cancelled = false;
    setPainted(false);
    (async () => {
      try {
        const p = await doc.getPage(page);
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        setPageHeightPt(base.height);
        const scale = shellWidth / base.width;
        const viewport = p.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        renderTaskRef.current?.cancel();
        const task = p.render({ canvas, canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;
        setPainted(true);
      } catch (e) {
        if (cancelled) return;
        if ((e as { name?: string })?.name === "RenderingCancelledException") return;
        console.error("[MarkSchemeReview] render failed", e);
        setStatus("error");
        setLoadError("That page could not be drawn, so nothing is being shown for it.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, page, shellWidth]);

  // Filtering preserves order, so the unruled-only view is still in exam order.
  const items = useMemo(
    () => (onlyUnruled ? ordered.filter((i) => i.unruled.length > 0) : ordered),
    [ordered, onlyUnruled],
  );
  const current = ordered.find((i) => i.question.questionNumber === selected) ?? ordered[0];

  const draftFor = useCallback(
    (qn: string): Draft => draft[qn] ?? { points: {}, lines: {} },
    [draft],
  );

  /**
   * Jump to one recorded line — a point, a flagged line, "show on page".
   *
   * ⚠ THE ARGUMENT IS AN EXTRACTION PAGE, 0-BASED, exactly as the artefact
   * records it, and the ONLY conversion to the viewer's 1-based numbering is
   * locateBlock's. Every caller below passes an artefact page straight through
   * for that reason; none of them may add one themselves.
   */
  const goTo = useCallback((extractionPage: number, y: number | null) => {
    const loc =
      y === null
        ? ({ page: toViewerPage(extractionPage), top: 0, bottom: 0, basis: "block-provenance" } as const)
        : locateBlock({ page: extractionPage, marks: { page: extractionPage, y } });
    if (!loc) return;
    setPage((prev) => (prev === loc.page ? prev : loc.page));
    setLocus(y === null ? null : loc);
  }, []);

  /**
   * Selecting a question moves EVERY evidence surface at once.
   *
   * ⚠ THE BAND SPANS THE WHOLE BLOCK, not just its mark cell. Q1 and Q2 sit on
   * one page: highlighting a single y would leave the reviewer to work out
   * which of two identical-looking regions is the one on the card. The band
   * covers the rows this question actually owns, and the effect below scrolls
   * it to the middle of the viewport, so the answer is never in doubt.
   *
   * ⚠ AND IT NEVER DEAD-ENDS. Only 10 of the 47 blocks have a seeded
   * paper_questions row; all 47 carry their own extraction provenance, which is
   * what locateBlock reads. A question with no seeded row still moves the
   * viewer.
   */
  const selectQuestion = useCallback((item: ReviewItem) => {
    setSelected(item.question.questionNumber);
    const loc = locateBlock(item.question);
    if (!loc) return;
    setPage((prev) => (prev === loc.page ? prev : loc.page));
    setLocus(loc);
  }, []);

  /**
   * Bring the band to the middle of the viewport, and put focus on the panel.
   *
   * ⚠ THIS IS THE HALF THAT WAS MISSING. Selecting a question used to call
   * setPage and stop. When the new question was on the SAME page — Q1 to Q2 —
   * setPage was a no-op and nothing on screen moved at all, which is
   * indistinguishable from a broken click.
   *
   * ⚠ WAITS FOR `painted`. Scrolling to a band drawn over a cleared canvas
   * lands on white; the canvas is resized, and so blanked, before every render.
   *
   * ⚠ FOCUS WITHOUT SCROLLING, and onto the panel rather than a control inside
   * it. `preventScroll` stops the focus from fighting the scroll below, and the
   * panel is a div because the keyboard handler deliberately ignores keystrokes
   * aimed at an INPUT — focusing a radio would silently kill j/k.
   */
  const lastTargetRef = useRef<typeof target>(null);
  useEffect(() => {
    if (!target || !painted) return;
    const move = navMove(lastTargetRef.current, target);
    lastTargetRef.current = target;
    if (move === "none") return;
    panelRef.current?.focus({ preventScroll: true });
    bandRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [target, painted]);

  const ruleLine = (qn: string, line: ProposedLine, kind: LineKind) => {
    setDirty((s) => ({ ...s, [qn]: true }));
    setDraft((d) => {
      const cur = d[qn] ?? { points: {}, lines: {} };
      const prev = cur.lines[line.sourceLine];
      const next: LineRuling = { ...prev, kind };

      // ⚠ THE OPTION IS OFFERED, NEVER ASSUMED. resolveDistractorOption
      // returns `manual` for anything that is not unmistakably "<letter> is
      // incorrect…", and for a letter that contradicts the question's own
      // correct answer. In those cases the ruling is stored WITHOUT an option
      // and the card asks; it is not filled in with a plausible guess, because
      // a wrong letter tells a student they were wrong about something they
      // never said.
      if (kind === "distractor_feedback") {
        const item = ordered.find((i) => i.question.questionNumber === qn);
        const found = resolveDistractorOption(
          prev?.editedText ?? line.text,
          item ? correctOptionOf(item) : null,
        );
        if (found.status === "detected") next.option = found.option;
        else delete next.option;
      } else {
        // Changing the ruling away from distractor feedback drops the option,
        // so a stale letter cannot ride along on an accept or a reject.
        delete next.option;
      }

      return { ...d, [qn]: { ...cur, lines: { ...cur.lines, [line.sourceLine]: next } } };
    });
  };

  /** The reviewer answering the card's question when detection refused. */
  const setLineOption = (qn: string, line: ProposedLine, option: string) => {
    setDirty((s) => ({ ...s, [qn]: true }));
    setDraft((d) => {
      const cur = d[qn] ?? { points: {}, lines: {} };
      const prev = cur.lines[line.sourceLine];
      if (!prev) return d;
      return {
        ...d,
        [qn]: { ...cur, lines: { ...cur.lines, [line.sourceLine]: { ...prev, option } } },
      };
    });
  };

  const editLine = (qn: string, line: ProposedLine, editedText: string) => {
    setDirty((s) => ({ ...s, [qn]: true }));
    setDraft((d) => {
      const cur = d[qn] ?? { points: {}, lines: {} };
      const existing = cur.lines[line.sourceLine];
      if (!existing) return d; // editing before choosing a kind would imply one
      return {
        ...d,
        [qn]: { ...cur, lines: { ...cur.lines, [line.sourceLine]: { ...existing, editedText } } },
      };
    });
  };

  const rulePoint = (qn: string, code: string, ruling: PointRuling) => {
    setDirty((s) => ({ ...s, [qn]: true }));
    setDraft((d) => {
      const cur = d[qn] ?? { points: {}, lines: {} };
      return { ...d, [qn]: { ...cur, points: { ...cur.points, [code]: ruling } } };
    });
  };

  /**
   * Take back an auto-verification.
   *
   * ⚠ ONE CLICK, AND IT RETURNS THE POINT TO UNRULED — not to "accepted by
   * hand". Revoking means "I looked and I am not satisfied", so the card must
   * go back to asking, and the question must stop being approvable until it is
   * answered. Anything less would let a doubt be recorded as a decision.
   */
  const revokePoint = (qn: string, code: string) => {
    setDirty((s) => ({ ...s, [qn]: true }));
    setDraft((d) => {
      const cur = d[qn] ?? { points: {}, lines: {} };
      const points = { ...cur.points };
      delete points[code];
      return { ...d, [qn]: { ...cur, points } };
    });
  };

  /**
   * The suggestion for each unruled line of the CURRENT question.
   *
   * ⚠ SCOPED TO ONE QUESTION, WHICH IS WHY j/k STAYS INSTANT. Suggesting for
   * all 47 blocks on every render would run the matcher over ~68 lines on each
   * keystroke; a question has a handful. The precedent store arrives with the
   * page, so there is no round trip either.
   *
   * ⚠ AND IT IS A VIEW, NOT A DRAFT. Nothing here touches `draft`, so a
   * suggested line is unruled to isResolved, to the Approve gate and to Emit.
   */
  const suggestions = useMemo(() => {
    const out = new Map<string, Suggestion>();
    if (!current) return out;
    const d = draftFor(current.question.questionNumber);
    const key = correctOptionOf(current);
    for (const line of current.question.requiresRuling) {
      if (d.lines[line.sourceLine]) continue;
      const s = suggestFor(line.text, data.precedents, key);
      if (s) out.set(line.sourceLine, s);
    }
    return out;
  }, [current, draftFor, data.precedents]);

  /** Confirm a suggestion — the same write path as pressing its number key. */
  const acceptSuggestion = useCallback((qn: string, line: ProposedLine, s: Suggestion) => {
    ruleLine(qn, line, s.verdict as LineKind);
    if (s.option) setLineOption(qn, line, s.option);
  }, []);

  // ── the accelerator screens ───────────────────────────────────────────
  const openBatch = () => {
    // ⚠ COMPUTED HERE, ON THE CLICK. Never on load: the founder asked for it.
    setPanel({
      kind: "batch",
      plan: planBatch(
        ordered.map((i) => i.question),
        Object.fromEntries(ordered.map((i) => [
          i.question.questionNumber,
          { lines: draftFor(i.question.questionNumber).lines, approvedAt: data.rulings[i.question.questionNumber]?.approvedAt },
        ])),
        data.precedents,
        (q) => { const it = ordered.find((i) => i.question.questionNumber === q.questionNumber); return it ? correctOptionOf(it) : null; },
      ),
    });
  };

  const openVerify = () => {
    const eligible: VerifyCandidate[] = [];
    const excluded: { questionNumber: string; pointCode: string; criterion: string; reason: string }[] = [];
    for (const item of ordered) {
      const qn = item.question.questionNumber;
      if (data.rulings[qn]?.approvedAt) continue;
      const d = draftFor(qn);
      for (const pt of item.question.points) {
        if (d.points[pt.pointCode]) continue;
        const decision = canAutoVerify(pt.criterion, pt.sourceLine);
        if (decision.eligible) {
          eligible.push({ questionNumber: qn, pointCode: pt.pointCode, criterion: pt.criterion, page: pt.page, y: pt.y });
        } else if (decision.risky) {
          excluded.push({ questionNumber: qn, pointCode: pt.pointCode, criterion: pt.criterion, reason: decision.reason });
        }
      }
    }
    setPanel({ kind: "verify", eligible, excluded });
  };

  const openBulk = () => {
    const candidates = ordered
      .filter((item) => {
        const qn = item.question.questionNumber;
        if (data.rulings[qn]?.approvedAt) return false;
        const d = draftFor(qn);
        const linesDone = item.question.requiresRuling.every((l) => isResolved(d.lines[l.sourceLine]));
        const pointsDone = item.question.points.length > 0 &&
          item.question.points.every((pt) => Boolean(d.points[pt.pointCode]));
        return linesDone && pointsDone;
      })
      .map((item) => ({
        questionNumber: item.question.questionNumber,
        marks: item.question.marks?.value ?? 0,
        points: item.question.points.length,
        lines: item.question.requiresRuling.length,
      }));
    setPanel({ kind: "bulk", candidates });
  };

  const confirmBatch = async (chosen: BatchCandidate[]) => {
    setPanelBusy(true);
    const res = await applyBatchAction(data.paperSlug, chosen.map((c) => ({
      questionNumber: c.questionNumber,
      sourceLine: c.sourceLine,
      kind: c.suggestion.verdict as LineKind,
      option: c.suggestion.option,
      precedentId: c.suggestion.precedentId,
    })));
    setPanelBusy(false);
    setPanel(null);
    setNotice({
      kind: res.ok ? "ok" : "bad",
      text: res.ok
        ? `Ruled ${res.applied} line(s)${res.skipped.length ? `; skipped ${res.skipped.length}` : ""}.`
        : `Applied ${res.applied}; ${res.errors.join(" · ")}`,
    });
    if (res.applied > 0) window.location.reload();
  };

  const confirmVerify = (chosen: VerifyCandidate[]) => {
    // ⚠ WRITTEN THROUGH rulePoint, the same call the "Accept as-is" button
    // makes. The only difference on disk is the provenance stamp.
    for (const c of chosen) {
      rulePoint(c.questionNumber, c.pointCode, { verdict: "accept", provenance: { method: "exact-match" } });
    }
    // ⚠ THE SPOT CHECK IS SET UP AT THE MOMENT OF VERIFYING, not later. A queue
    // built on demand would be a queue nobody builds.
    setSpotCheck(spotCheckIndices(chosen.length).map((i) => chosen[i]));
    setPanel(null);
    setNotice({
      kind: "ok",
      text: `${chosen.length} point(s) verified. ${spotCheckIndices(chosen.length).length} queued for a look at the page — they are unsaved until you press save.`,
    });
  };

  const confirmBulk = async (chosen: string[]) => {
    setPanelBusy(true);
    const res = await bulkApproveAction(data.paperSlug, chosen, "self");
    setPanelBusy(false);
    setPanel(null);
    setNotice({
      kind: res.ok ? "ok" : "bad",
      text: res.ok
        ? `Approved ${res.approved.length} question(s)${res.refused.length ? `; refused ${res.refused.map((r) => `${r.questionNumber} (${r.reason})`).join(", ")}` : ""}.`
        : res.errors.join(" · "),
    });
    if (res.approved.length > 0) window.location.reload();
  };

  /**
   * Lines restored during this sitting of the sweep panel.
   *
   * ⚠ THE PANEL STAYS OPEN AND THE PAGE DOES NOT RELOAD PER RESTORE. There are
   * 61 of these; a reload per line is a sweep nobody finishes. The restored
   * keys are held here so the panel can strike them through immediately, and
   * the single reload happens when it is CLOSED — at which point the yellow
   * cards for everything restored appear at once.
   */
  const [restoredKeys, setRestoredKeys] = useState<Set<string>>(new Set());

  const restoreMisfiled = async (chosen: MisfiledLine[]) => {
    if (chosen.length === 0) return;
    setPanelBusy(true);
    const res = await convertMisfiledLinesAction(
      data.paperSlug,
      chosen.map((l) => ({ questionNumber: l.questionNumber, text: l.text })),
    );
    setPanelBusy(false);

    setRestoredKeys((prev) => {
      const next = new Set(prev);
      for (const r of res.restored) next.add(`${r.questionNumber}::${r.text}`);
      return next;
    });

    // ⚠ SKIPS AND ERRORS ARE REPORTED, NOT SWALLOWED. A sweep that restored 40
    // of 58 and said "done" is indistinguishable from one that worked.
    const parts = [`Restored ${res.restored.length} line(s).`];
    if (res.approvalsWithdrawn.length) {
      parts.push(`Approval withdrawn on ${res.approvalsWithdrawn.join(", ")}.`);
    }
    if (res.skipped.length) {
      parts.push(`Skipped ${res.skipped.length}: ${res.skipped.slice(0, 3).map((s2) => `${s2.questionNumber} (${s2.reason})`).join("; ")}${res.skipped.length > 3 ? " …" : ""}`);
    }
    if (res.errors.length) parts.push(res.errors.join(" · "));
    setNotice({ kind: res.ok ? "ok" : "bad", text: parts.join(" ") });
  };

  /**
   * ⚠ THE RELOAD IS DEFERRED TO CLOSING, and only when something changed. The
   * page's own copy of the artefact is stale the moment the first line moves,
   * so it has to be refreshed — but doing it per restore is the bug being
   * fixed here.
   */
  const closeMisfiled = () => {
    setPanel(null);
    if (restoredKeys.size > 0) window.location.reload();
  };

  const confirmLine = async (input: Parameters<typeof addManualLineAction>[1]) => {
    setPanelBusy(true);
    const res = await addManualLineAction(data.paperSlug, input);
    setPanelBusy(false);
    if (!res.ok) { setNotice({ kind: "bad", text: res.error }); return; }
    setPanel(null);
    setNotice({
      kind: "ok",
      text: `Added to ${res.questionNumber}. ${res.approvalWithdrawn ? "Its approval was withdrawn — re-approve once you have ruled the new line. " : ""}${res.unruledNow} line(s) now need a ruling.`,
    });
    window.location.reload();
  };

  const confirmBlock = async (input: Parameters<typeof addManualBlockAction>[1]) => {
    setPanelBusy(true);
    const res = await addManualBlockAction(data.paperSlug, input);
    setPanelBusy(false);
    if (!res.ok) { setNotice({ kind: "bad", text: res.error }); return; }
    setPanel(null);
    setNotice({
      kind: "ok",
      text: `${res.questionNumber} added. ${res.shortfallAfter === 0 ? "That question now adds up." : `Still ${res.shortfallAfter} short.`}`,
    });
    window.location.reload();
  };

  /**
   * Lines this tab has a decision for, saved or not. Drives the editor.
   *
   * ⚠ isResolved, NOT "is there an entry" — THE LIST AND THE CARD MUST NOT BE
   * ABLE TO DISAGREE. This counted mere presence while the question card
   * counted resolution, so the two derived "how much is left" by different
   * rules from the same draft. A distractor ruling with no option letter is
   * present-but-unresolved, and after a reload the badge and the card told the
   * founder different numbers about the same question. They now read the one
   * predicate the Approve gate and Emit also read.
   */
  const localUnruled = (item: ReviewItem) => {
    const d = draftFor(item.question.questionNumber);
    return item.question.requiresRuling.filter((l) => !isResolved(d.lines[l.sourceLine])).length;
  };

  /**
   * ⚠ THE HEADLINE COUNT COMES FROM THE SERVER, NOT FROM THIS TAB.
   *
   * `data.unruled` is computed by countUnruled() over what was read off disk.
   * Counting the draft instead let the number drift from reality in the one
   * direction that matters: downward. A reviewer clicking through lines
   * watched "68 remaining" fall to zero while every one of those decisions
   * lived only in a browser tab, and a refresh would have put it straight back
   * to 68 with no explanation.
   *
   * Unsaved work is REPORTED, never SUBTRACTED.
   */
  const storedRemaining = data.unruled;
  const unsavedQuestions = Object.keys(dirty).length;

  const save = async (item: ReviewItem, approve: boolean) => {
    const qn = item.question.questionNumber;
    const d = draftFor(qn);
    setSaving(qn);
    setNotice(null);
    const rulings: QuestionRulings = {
      points: d.points,
      lines: d.lines,
      ...(approve
        ? { approvedAt: new Date().toISOString(), approvedBy: "self" }
        : {}),
    };
    const res = await saveQuestionRulingsAction(data.paperSlug, qn, rulings, revisions[qn] ?? 0);
    setSaving(null);

    if (res.ok) {
      setRevisions((r) => ({ ...r, [qn]: res.revision }));
      setDirty((s) => {
        const next = { ...s };
        delete next[qn];
        return next;
      });
      setNotice({ kind: "ok", text: `${qn} saved${approve ? " and approved" : ""}.` });
      return;
    }

    // ⚠ THE DRAFT IS NOT TOUCHED ON FAILURE, AND THE QUESTION STAYS DIRTY.
    //
    // Reverting to the last saved state would be the tidy thing to do and
    // would throw away the reviewer's actual work — the ruling they just made,
    // which the server declined to store. It stays on screen so they can
    // retry, copy it out, or resolve the conflict. `dirty` stays set for the
    // same reason: the whole point of that flag is to say this question is not
    // safely on disk, and a failed save is exactly when that is true.
    setNotice({
      kind: res.conflict ? "conflict" : "bad",
      text: res.error,
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // KEYBOARD — because 68 lines with a mouse is an hour that did not need to be
  // ══════════════════════════════════════════════════════════════════════════
  //
  // ⚠ 1-5 RULES THE FIRST LINE THAT STILL NEEDS A DECISION, and the list is
  // ordered doubt-first, so the keys walk down the queue on their own: each
  // press consumes the line it answered and the next one becomes first. That is
  // the whole speed-up — no pointing, no scrolling, no hunting for the next
  // unanswered radio.
  //
  // ⚠ IT DOES NOT SAVE, AND IT DOES NOT APPROVE. Approving needs the source
  // page painted and on screen (see the header of this file); a key that could
  // approve would be a key that skips the one check this tool exists to
  // enforce. Cmd/Ctrl+S saves. Approval stays a deliberate click.
  const keyRef = useRef({ current, ruleLine, save, items, selectQuestion, suggestions, acceptSuggestion, panel });
  keyRef.current = { current, ruleLine, save, items, selectQuestion, suggestions, acceptSuggestion, panel };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Never steal a keystroke from something the reviewer is typing into —
      // the edit-the-criterion textareas are the reason this tool is usable.
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.altKey) return;

      // ⚠ A PANEL IS MODAL, SO THE KEYS BELONG TO IT. Without this, pressing 1
      // while the batch screen is open rules a line on the question hidden
      // behind it — a ruling made on something the reviewer cannot see, by a
      // key they pressed for a different screen. j/k would scroll a question
      // list nobody is looking at, for the same reason.
      if (keyRef.current.panel) {
        if (e.key === "Escape") setPanel(null);
        return;
      }

      const { current: cur, ruleLine: rule, save: doSave, items: list, selectQuestion: pick } =
        keyRef.current;
      if (!cur) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSave(cur, false);
        return;
      }
      if (e.metaKey || e.ctrlKey) return;

      const idx = list.findIndex((i) => i.question.questionNumber === cur.question.questionNumber);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (idx >= 0 && idx < list.length - 1) pick(list[idx + 1]);
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (idx > 0) pick(list[idx - 1]);
        return;
      }

      // ⚠ ENTER AGREES WITH THE SUGGESTION; IT DOES NOT SKIP THE DECISION.
      // It fires only where a suggestion is actually on screen, and it writes
      // exactly what the number key for that verdict would write. A line with
      // no suggestion does nothing at all, rather than falling through to some
      // default — which is the whole reason there is no default.
      if (e.key === "Enter") {
        const qn = cur.question.questionNumber;
        const d = draftFor(qn);
        const next = cur.question.requiresRuling.find(
          (l) => !d.lines[l.sourceLine] && keyRef.current.suggestions.has(l.sourceLine));
        if (!next) return;
        e.preventDefault();
        keyRef.current.acceptSuggestion(qn, next, keyRef.current.suggestions.get(next.sourceLine)!);
        return;
      }

      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= LINE_CHOICES.length) {
        const qn = cur.question.questionNumber;
        const d = draftFor(qn);
        const next = cur.question.requiresRuling.find((l) => !d.lines[l.sourceLine]);
        if (!next) return;
        e.preventDefault();
        rule(qn, next, LINE_CHOICES[n - 1].kind);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draftFor]);

  // ⚠ THE LAST LINE OF DEFENCE AGAINST LOSING A SITTING. A ruling that has not
  // been saved lives only in this tab; a stray Cmd+W or a reload takes it. The
  // browser's own prompt is the only thing that can interrupt that.
  useEffect(() => {
    if (unsavedQuestions === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsavedQuestions]);

  const verified = new Set(data.verifiedQuestions);

  return (
    <div className="space-y-4">
      {/* ── the count, always visible ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
          Rulings remaining
        </span>
        <span className={`font-mono text-2xl ${storedRemaining === 0 ? "text-emerald-700" : "text-slate-900"}`}>
          {storedRemaining}
        </span>
        <span className="text-sm text-slate-600">
          {data.approved} of {data.total} question(s) approved
        </span>

        {/* ⚠ REPORTED SEPARATELY, NEVER SUBTRACTED FROM THE COUNT ABOVE.
            The number on the left means "still needs a ruling, on disk". This
            one means "ruled in this tab and not yet stored" — which is work
            that a refresh would lose, and the reviewer is the only one who can
            decide to press save. Folding the two together is what made the
            count reach zero while nothing had been written. */}
        {/* ⚠ EMIT IS SEPARATE FROM APPROVE, AND DELIBERATELY MANUAL. Approving a
            question records a ruling; emitting turns every approved question
            into the module the seeder reads. Doing it automatically on each
            approval would rewrite that file 47 times during one sitting, and
            the reviewer would never see the refusals that say what is left. */}
        {/* ⚠ EVERY BUTTON HERE OPENS A QUESTION, NOT AN ACTION. Each computes
            a list and shows it; nothing is written until the panel's confirm.
            None of them runs on load. */}
        {data.canWrite && data.canPersist && (
          <>
            <button
              type="button" onClick={openBatch}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-500"
            >
              Apply precedents
            </button>
            <button
              type="button" onClick={openVerify}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-500"
            >
              Verify exact matches
            </button>
            <button
              type="button" onClick={openBulk}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-500"
            >
              Bulk approve
            </button>
            {data.misfiled.length > 0 && (
              <button
                type="button" onClick={() => setPanel({ kind: "misfiled" })}
                className="flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 hover:border-amber-600"
                title="Lines the extractor classified automatically and never showed you"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Filed away ({data.misfiled.length})
              </button>
            )}
            {data.shortfalls.length > 0 && (
              <button
                type="button" onClick={() => setPanel({ kind: "block" })}
                className="flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 hover:border-amber-600"
                title={data.shortfalls.map((r) => `Q${r.question} short ${r.shortfall}`).join(", ")}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Add missing block ({data.shortfalls.length})
              </button>
            )}
          </>
        )}

        <button
          type="button"
          disabled={!data.canWrite || !data.canPersist || emitting}
          onClick={async () => {
            setEmitting(true);
            setEmit(await emitFixtureAction(data.paperSlug));
            setEmitting(false);
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-500 disabled:opacity-40"
        >
          {emitting ? "Emitting…" : "Emit fixture"}
        </button>

        {unsavedQuestions > 0 && (
          <span className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {unsavedQuestions} question{unsavedQuestions === 1 ? "" : "s"} with unsaved rulings
          </span>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyUnruled}
            onChange={(e) => setOnlyUnruled(e.target.checked)}
          />
          only questions needing a ruling
        </label>
      </div>

      {emit && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            emit.ok && emit.refusals.length === 0
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {emit.ok ? (
            <>
              <p>
                Wrote <span className="font-mono">{emit.path}</span> — {emit.questions} question(s),{" "}
                {emit.marks} mark(s). Dry-run the seeder against it before committing.
              </p>
              {/* ⚠ A PARTIAL SUCCESS IS NOT A SUCCESS. These refusals used to be
                  discarded whenever anything emitted, which is how 23(a)(iii)
                  and its two marks left the paper without a word on screen. */}
              {emit.refusals.length > 0 && (
                <>
                  <p className="mt-2 flex items-start gap-1.5 font-medium">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {emit.refusals.length} refusal(s) — those questions are NOT in the file.
                    Check {emit.marks} against the paper&apos;s printed total.
                  </p>
                  <ul className="mt-2 max-h-48 overflow-y-auto font-mono text-xs">
                    {emit.refusals.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <>
              <p className="font-medium">{emit.error}</p>
              {/* ⚠ THE REFUSALS ARE THE ANSWER. Each names a question and why it
                  is not ready, which is the list of what to do next. */}
              {emit.refusals && (
                <ul className="mt-2 max-h-48 overflow-y-auto font-mono text-xs">
                  {emit.refusals.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {!data.canPersist && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This instance cannot save rulings — they are written to the repository
          working tree, which a deployed instance does not have. Run the tool
          locally. Nothing you do here will persist.
        </p>
      )}
      {!data.canWrite && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Read-only: saving needs a marker or admin role, and your session holds{" "}
          {data.roles.length ? data.roles.join(", ") : "none"}.
        </p>
      )}
      {notice && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* ⚠ THE SPLIT IS A CSS VARIABLE, NOT AN INLINE grid-template. Inline
          styles cannot carry a media query, and the two columns must still
          STACK below lg — a 58/42 split on a phone is two unreadable columns.
          The variable feeds a Tailwind arbitrary value that only applies at lg,
          so small screens keep the single-column layout untouched. */}
      <div
        ref={gridRef}
        style={{ "--split": `${splitPct}%` } as React.CSSProperties}
        className={`grid gap-4 ${
          expanded
            ? "lg:grid-cols-[minmax(0,1fr)]"
            : "lg:grid-cols-[var(--split)_10px_minmax(0,1fr)]"
        }`}
      >
        {/* ── the published page ──────────────────────────────────────── */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || status !== "ready"}
              className="rounded border border-slate-300 bg-white p-1 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-xs text-slate-600">
              {status === "ready" ? `page ${page} of ${numPages}` : "…"}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              disabled={page >= numPages || status !== "ready"}
              className="rounded border border-slate-300 bg-white p-1 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {status === "ready" && !painted && (
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" /> drawing
              </span>
            )}

            {/* ⚠ THE WAY BACK IS THE SAME BUTTON, in the same place. Expanding
                hides the ruling column, so a toggle that moved or vanished
                would strand the reviewer on a page with no controls. Hidden
                below lg, where there is only ever one column anyway. */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-pressed={expanded}
              title={expanded ? "Show the review column" : "Give the page the full width"}
              className="ml-auto hidden items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-600 hover:bg-slate-100 lg:flex"
            >
              {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              {expanded ? "exit full width" : "full width"}
            </button>
          </div>

          {status === "error" ? (
            <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              {loadError}
            </div>
          ) : (
            <div ref={shellRef} className="relative w-full overflow-hidden">
              <canvas ref={canvasRef} className="block w-full" />
              {/* The highlight is a percentage band, so it stays on the same
                  ink at any width — the mapper's reasoning, same trick. */}
              {painted && target && target.page === page && (
                <div
                  ref={bandRef}
                  className="pointer-events-none absolute left-0 right-0 border-y-2 border-amber-500 bg-amber-300/25 transition-all duration-200"
                  style={{
                    // A row's recorded y is its baseline, so the band starts
                    // just above it — the same 1.2% lead the mapper uses.
                    top: `${Math.max(0, target.topPct - 1.2)}%`,
                    height: `${Math.max(2.6, target.heightPct + 2.4)}%`,
                  }}
                />
              )}
              {status === "loading" && (
                <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> loading the mark scheme…
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── the splitter ────────────────────────────────────────────────
            Hidden below lg, where the columns stack and there is nothing to
            split. role="separator" with aria-valuenow so the ratio is
            announced rather than being a mystery grey bar.

            ⚠ ARROW LEFT/RIGHT ONLY. Up/Down are bound globally to j/k
            question navigation, and a focused splitter that swallowed them
            would break the keyboard walk this surface is built around. */}
        {!expanded && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the evidence pane"
            aria-valuenow={splitPct}
            aria-valuemin={30}
            aria-valuemax={80}
            tabIndex={0}
            onPointerDown={startDrag}
            onDoubleClick={() => setSplitPct(58)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") { e.preventDefault(); setSplitPct((p) => clampSplit(p - 2)); }
              if (e.key === "ArrowRight") { e.preventDefault(); setSplitPct((p) => clampSplit(p + 2)); }
            }}
            title="Drag to resize · double-click to reset"
            className="group hidden cursor-col-resize items-center justify-center rounded outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400 lg:flex"
          >
            <span className="h-16 w-1 rounded-full bg-slate-300 group-hover:bg-slate-500" />
          </div>
        )}

        {/* ── the proposals ───────────────────────────────────────────── */}
        <div className={`space-y-3 ${expanded ? "hidden" : ""}`}>
          <div className="max-h-[22rem] overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-slate-600">
                Nothing left needing a ruling.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => {
                  const qn = item.question.questionNumber;
                  const remaining = localUnruled(item);
                  return (
                    <li key={qn}>
                      <button
                        type="button"
                        onClick={() => selectQuestion(item)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          qn === selected ? "bg-slate-100" : ""
                        }`}
                      >
                        <span className="font-mono w-20 shrink-0">{qn}</span>
                        {verified.has(qn) && (
                          // ⚠ The five already transcribed by hand. Shown so a
                          // reviewer can watch the extractor agree with them on
                          // a known answer before trusting it on the other 42.
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-800">
                            verified
                          </span>
                        )}
                        <span className="text-slate-600">
                          {item.question.points.length} point(s)
                        </span>
                        {remaining > 0 ? (
                          <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-900">
                            {remaining} to rule
                          </span>
                        ) : item.approved ? (
                          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-emerald-700">
                            approved
                          </span>
                        ) : (
                          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-slate-400">
                            ready
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-400">
                          {item.worstConfidence.toFixed(2)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {current && (
            <>
            <SpotCheckStrip
              items={spotCheck}
              done={spotChecked}
              onLook={(c) => { setSelected(c.questionNumber); goTo(c.page, c.y); }}
              onSatisfied={(c) => setSpotChecked((x) => ({ ...x, [`${c.questionNumber}::${c.pointCode}`]: true }))}
              onRevoke={(c) => {
                revokePoint(c.questionNumber, c.pointCode);
                setSpotCheck((q) => q.filter((i) => !(i.questionNumber === c.questionNumber && i.pointCode === c.pointCode)));
              }}
            />
            <QuestionPanel
              item={current}
              draft={draftFor(current.question.questionNumber)}
              painted={painted}
              panelRef={panelRef}
              // ⚠ THE APPROVAL GATE HAD THE SAME OFF-BY-ONE, and it failed
              // OPEN: `page` is 1-based and `question.page` was 0-based, but
              // goTo had just set `page` FROM `question.page`, so the two were
              // always equal and "the right page is showing" was always true —
              // while the page on screen was the one before it. The gate now
              // compares two numbers in the same numbering.
              onSamePage={page === toViewerPage(current.question.page)}
              canWrite={data.canWrite && data.canPersist}
              saving={saving === current.question.questionNumber}
              onGoTo={goTo}
              onRuleLine={(l, k) => ruleLine(current.question.questionNumber, l, k)}
              onSetOption={(l, o) => setLineOption(current.question.questionNumber, l, o)}
              suggestions={suggestions}
              onAcceptSuggestion={(l, sg) => acceptSuggestion(current.question.questionNumber, l, sg)}
              onRevokePoint={(code) => revokePoint(current.question.questionNumber, code)}
              onAddLine={() => setPanel({
                kind: "line",
                questionNumber: current.question.questionNumber,
                isApproved: Boolean(data.rulings[current.question.questionNumber]?.approvedAt),
              })}
              onEditLine={(l, txt) => editLine(current.question.questionNumber, l, txt)}
              onRulePoint={(code, r) => rulePoint(current.question.questionNumber, code, r)}
              onSave={(approve) => save(current, approve)}
            />
            </>
          )}
        </div>
      </div>

      {/* ── the accelerator screens ─────────────────────────────────────
          Rendered last so they overlay everything. Each one is discarded by
          closing it; nothing is written until its confirm handler runs. */}
      {panel?.kind === "batch" && (
        <BatchPanel plan={panel.plan} busy={panelBusy}
          onCancel={() => setPanel(null)} onConfirm={confirmBatch} />
      )}
      {panel?.kind === "verify" && (
        <VerifyPanel eligible={panel.eligible} excluded={panel.excluded} busy={panelBusy}
          onCancel={() => setPanel(null)} onConfirm={confirmVerify} />
      )}
      {panel?.kind === "bulk" && (
        <BulkApprovePanel candidates={panel.candidates} busy={panelBusy}
          onCancel={() => setPanel(null)} onConfirm={confirmBulk} />
      )}
      {panel?.kind === "misfiled" && (
        <MisfiledPanel
          lines={data.misfiled}
          approvedQuestions={new Set(Object.entries(data.rulings).filter(([, b]) => b.approvedAt).map(([q]) => q))}
          busy={panelBusy}
          restoredKeys={restoredKeys}
          onCancel={closeMisfiled}
          onRestoreMany={restoreMisfiled} />
      )}
      {panel?.kind === "line" && (
        <ManualLinePanel questionNumber={panel.questionNumber} isApproved={panel.isApproved}
          busy={panelBusy} onCancel={() => setPanel(null)} onSubmit={confirmLine} />
      )}
      {panel?.kind === "block" && (
        <ManualBlockPanel shortfalls={data.shortfalls} busy={panelBusy}
          onCancel={() => setPanel(null)} onSubmit={confirmBlock} />
      )}
    </div>
  );
}

/**
 * The spot check: look at the PAGE, not at the text again.
 *
 * ⚠ TEXT-VERSUS-TEXT IS THE CHECK THAT CANNOT FAIL HERE. These points were
 * auto-verified BECAUSE their text matched byte for byte; re-reading that
 * comparison proves nothing. So each entry drives the evidence viewer to its
 * own band — the rendered page, pixels — and the founder looks at the ink.
 * That is the only place a flattened superscript is visible.
 */
function SpotCheckStrip({
  items, done, onLook, onSatisfied, onRevoke,
}: {
  items: VerifyCandidate[];
  done: Record<string, true>;
  onLook: (c: VerifyCandidate) => void;
  onSatisfied: (c: VerifyCandidate) => void;
  onRevoke: (c: VerifyCandidate) => void;
}) {
  if (items.length === 0) return null;
  const remaining = items.filter((c) => !done[`${c.questionNumber}::${c.pointCode}`]);
  return (
    <div className="rounded-lg border border-sky-300 bg-sky-50 p-3">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-900">
        spot check · {remaining.length} of {items.length} left
      </h3>
      <p className="mt-1 text-xs text-sky-900">
        These were verified because the text matched exactly. Check the page itself —
        the text layer flattens superscripts, so matching text cannot show that.
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((c) => {
          const k = `${c.questionNumber}::${c.pointCode}`;
          const settled = done[k];
          return (
            <li key={k} className={`rounded border bg-white p-2 ${settled ? "border-slate-200 opacity-60" : "border-sky-300"}`}>
              <button type="button" onClick={() => onLook(c)}
                className="text-left text-sm text-slate-900 hover:underline">
                {c.criterion}
              </button>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-500">
                  {c.questionNumber} · {c.pointCode} · p{toViewerPage(c.page)}
                </span>
                <button type="button" onClick={() => onLook(c)}
                  className="rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-600 hover:bg-slate-100">
                  show the page
                </button>
                {!settled && (
                  <>
                    <button type="button" onClick={() => onSatisfied(c)}
                      className="rounded border border-emerald-400 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-800 hover:bg-emerald-50">
                      matches the page
                    </button>
                    <button type="button" onClick={() => onRevoke(c)}
                      className="rounded border border-red-400 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-800 hover:bg-red-50">
                      revoke
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QuestionPanel({
  item, draft, painted, panelRef, onSamePage, canWrite, saving,
  onGoTo, onRuleLine, onSetOption, onEditLine, onRulePoint, onSave,
  suggestions, onAcceptSuggestion, onRevokePoint, onAddLine,
}: {
  item: ReviewItem;
  draft: Draft;
  painted: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  onSamePage: boolean;
  canWrite: boolean;
  saving: boolean;
  onGoTo: (page: number, y: number | null) => void;
  onRuleLine: (line: ProposedLine, kind: LineKind) => void;
  onSetOption: (line: ProposedLine, option: string) => void;
  suggestions: Map<string, Suggestion>;
  onAcceptSuggestion: (line: ProposedLine, s: Suggestion) => void;
  onRevokePoint: (pointCode: string) => void;
  onAddLine: () => void;
  onEditLine: (line: ProposedLine, text: string) => void;
  onRulePoint: (code: string, ruling: PointRuling) => void;
  onSave: (approve: boolean) => void;
}) {
  const q = item.question;
  // ⚠ "A VALID CLASSIFICATION", NOT MERELY "A CLASSIFICATION". A distractor
  // ruling with no option is one toFixture will refuse, so counting it as done
  // would enable Approve and then fail at emit — the reviewer would be told
  // the question was finished and find out later that it was not.
  const remaining = q.requiresRuling.filter((l) => !isResolved(draft.lines[l.sourceLine]));
  // ⚠ BOTH CONDITIONS. "Approve" asserts the reviewer checked this against the
  // page, so the page must have painted AND be the right one.
  const pageIsShowing = painted && onSamePage;
  const canApprove = canWrite && remaining.length === 0 && pageIsShowing;

  return (
    // ⚠ tabIndex -1 SO j/k SURVIVE FOCUS. Moving question focuses this panel so
    // the reviewer's controls are under the cursor without a click; it must be
    // a div, not a control, because the key handler ignores INPUT/TEXTAREA.
    <div
      ref={panelRef}
      tabIndex={-1}
      className="rounded-lg border border-slate-200 bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
    >
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-lg font-medium">{q.questionNumber}</h2>
        <span className="font-mono text-xs text-slate-500">
          {/* The page the PAGER shows, not the artefact's 0-based index. */}
          {q.marks ? `${q.marks.value} mark(s)` : "no tariff extracted"} · page{" "}
          {toViewerPage(q.page)}
        </span>
        <button
          type="button"
          onClick={() => onGoTo(q.page, q.marks?.y ?? null)}
          className="ml-auto font-mono text-[10px] uppercase tracking-wider text-slate-500 underline"
        >
          show on page
        </button>
        {/* ⚠ PER QUESTION, BESIDE THE QUESTION. A paper-level control would
            make the founder retype which block they meant, on a screen that
            already knows. */}
        {canWrite && (
          <button
            type="button"
            onClick={onAddLine}
            className="font-mono text-[10px] uppercase tracking-wider text-slate-500 underline"
          >
            add missing line
          </button>
        )}
      </div>

      {q.markingRule && (
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {q.markingRule}
        </p>
      )}

      {/* ── the proposed points ──────────────────────────────────────── */}
      <h3 className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
        Proposed marking points
      </h3>
      <ul className="mt-2 space-y-2">
        {q.points.map((p) => {
          const r = draft.points[p.pointCode];
          return (
            <li key={p.pointCode} className="rounded border border-slate-200 p-2">
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs text-slate-500">{p.pointCode}</span>
                {p.route > 1 && (
                  <span className="rounded bg-slate-100 px-1 font-mono text-[9px] text-slate-600">
                    route {p.route}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onGoTo(p.page, p.y)}
                  className="flex-1 text-left text-sm text-slate-800 hover:underline"
                >
                  {r?.verdict === "edit" ? r.criterion : p.criterion}
                </button>
                <span className="font-mono text-[10px] text-slate-400">{p.confidence.toFixed(2)}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-slate-400">
                p{toViewerPage(p.page)} · {p.derivedFrom}
              </p>
              <p className="mt-1 border-l-2 border-slate-200 pl-2 font-mono text-[10px] text-slate-500">
                {p.sourceLine}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {/* ⚠ "AS-IS" ON A BLANK CARD ACCEPTS THE EMPTY STRING. The
                    answer cell for 23(a)(iii) is a drawing, so both its points
                    arrived with no text; both were accepted as-is; the question
                    read as fully ruled, was approved, and then vanished from
                    the fixture for "empty criterion". Accepting nothing is not
                    a ruling — the only way to resolve a point the extractor
                    could not read is to Edit it and supply the words. */}
                {p.criterion.trim() ? (
                  <Choice on={r?.verdict === "accept"} onClick={() => onRulePoint(p.pointCode, { verdict: "accept" })}>
                    Accept as-is
                  </Choice>
                ) : (
                  <span className="rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-900">
                    no text — Edit to transcribe it
                  </span>
                )}
                {/* ⚠ VISUALLY DISTINCT, AND REVOCABLE IN ONE CLICK. An
                    auto-verified point was accepted because its text matched
                    the page byte for byte — a narrower claim than "a person
                    read it" — so it says which it was, and revoking returns it
                    to UNRULED rather than to accepted-by-hand. */}
                {r?.provenance?.method === "exact-match" && (
                  <>
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-sky-900">
                      exact match
                    </span>
                    <button
                      type="button"
                      onClick={() => onRevokePoint(p.pointCode)}
                      className="rounded border border-red-300 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-red-800 hover:bg-red-50"
                    >
                      revoke
                    </button>
                  </>
                )}
                <Choice
                  on={r?.verdict === "edit"}
                  onClick={() => onRulePoint(p.pointCode, { verdict: "edit", criterion: p.criterion })}
                >
                  Edit
                </Choice>
                <Choice
                  on={r?.verdict === "reject"}
                  onClick={() => onRulePoint(p.pointCode, { verdict: "reject", why: "rejected in review" })}
                >
                  Reject
                </Choice>
              </div>
              {r?.verdict === "edit" && (
                <textarea
                  value={r.criterion}
                  onChange={(e) => onRulePoint(p.pointCode, { verdict: "edit", criterion: e.target.value })}
                  rows={2}
                  className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
                />
              )}
            </li>
          );
        })}
      </ul>

      {/* ── the rulings ──────────────────────────────────────────────── */}
      {q.requiresRuling.length > 0 && (
        <>
          <h3 className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-700">
            Needs your ruling — {remaining.length} of {q.requiresRuling.length} left
          </h3>
          <ul className="mt-2 space-y-3">
            {q.requiresRuling.map((line) => {
              const chosen = draft.lines[line.sourceLine];
              return (
                <li
                  key={line.sourceLine}
                  className={`rounded border p-3 ${
                    chosen ? "border-slate-200" : "border-amber-300 bg-amber-50/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onGoTo(line.page, line.y)}
                    className="text-left text-sm font-medium text-slate-900 hover:underline"
                  >
                    “{line.text}”
                  </button>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    p{toViewerPage(line.page)} · confidence {line.confidence.toFixed(2)}
                  </p>
                  {(line.requiresRuling ?? []).map((why) => (
                    <p key={why} className="mt-1 text-xs text-amber-800">
                      ⚠ {why}
                    </p>
                  ))}
                  {/* ⚠ A SUGGESTION, NOT A SELECTION. Nothing below is
                      pre-picked; this is a separate chip that says what the
                      precedents think and offers ONE key to agree. Until it is
                      pressed the line is unruled to isResolved, to the Approve
                      gate and to Emit — the chip changes what is on screen and
                      nothing else. */}
                  {!chosen && suggestions.get(line.sourceLine) && (() => {
                    const sg = suggestions.get(line.sourceLine)!;
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded border border-sky-300 bg-sky-50 px-2 py-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-sky-900">
                          suggested
                        </span>
                        <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-sky-900">
                          {sg.verdict.replace(/_/g, " ")}{sg.option ? ` · ${sg.option}` : ""}
                        </span>
                        <span className="text-[11px] text-sky-900">{sg.reason}</span>
                        <button
                          type="button"
                          onClick={() => onAcceptSuggestion(line, sg)}
                          className="ml-auto rounded border border-sky-500 bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sky-900 hover:bg-sky-100"
                        >
                          accept ⏎
                        </button>
                      </div>
                    );
                  })()}
                  {/* ⚠ NOTHING PRE-SELECTED. See the header. */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {LINE_CHOICES.map((c) => (
                      <Choice
                        key={c.kind}
                        on={chosen?.kind === c.kind}
                        title={c.hint}
                        onClick={() => onRuleLine(line, c.kind)}
                      >
                        {c.label}
                      </Choice>
                    ))}
                  </div>
                  {/* ⚠ THE OPTION IS PART OF THE CLASSIFICATION, so the card
                      shows whether it is settled. Detected: a chip that says
                      which. Not detected: the question, asked plainly, with
                      the reason detection declined — a reviewer told "no
                      pattern found" makes a better decision than one shown a
                      silently empty field. */}
                  {chosen?.kind === "distractor_feedback" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {isValidOption(chosen.option) ? (
                        <span className="rounded bg-sky-100 px-2 py-0.5 font-mono text-[11px] text-sky-900">
                          Distractor feedback · {chosen.option}
                        </span>
                      ) : (
                        <>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
                            which option?
                          </span>
                          {OPTION_ALPHABET.split("").slice(0, 4).map((letter) => (
                            <button
                              key={letter}
                              type="button"
                              onClick={() => onSetOption(line, letter)}
                              className="rounded border border-amber-400 bg-white px-2 py-0.5 font-mono text-[11px] text-amber-900 hover:bg-amber-100"
                            >
                              {letter}
                            </button>
                          ))}
                          <span className="text-[11px] text-amber-800">
                            {resolveDistractorOption(chosen.editedText ?? line.text, null).reason}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  {chosen && chosen.kind !== "discard" && (
                    <input
                      value={chosen.editedText ?? line.text}
                      onChange={(e) => onEditLine(line, e.target.value)}
                      className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ── save / approve ───────────────────────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          disabled={!canWrite || saving}
          onClick={() => onSave(false)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {saving ? "saving…" : "Save progress"}
        </button>
        <button
          type="button"
          disabled={!canApprove || saving}
          onClick={() => onSave(true)}
          className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" /> Approve {q.questionNumber}
        </button>
        {!canApprove && (
          <span className="text-xs text-slate-600">
            {remaining.length > 0
              ? `${remaining.length} line(s) still need a ruling.`
              : !pageIsShowing
                ? `Showing page ${q.page} is part of approving it — the page has to be on screen before you can say you checked it.`
                : "Read-only."}
          </span>
        )}
      </div>
    </div>
  );
}

function Choice({
  on, onClick, children, title,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded border px-2 py-1 font-mono text-[11px] ${
        on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
