/**
 * The generated mark scheme, turned into a seedable QuestionSet.
 *
 * ============================================================================
 * ⚠ NOTHING IN THIS FILE IS HAND-MAINTAINED PER PAPER
 * ============================================================================
 * Three inputs, all generated or founder-supplied through a validated file:
 *
 *   unit-1-may-june-2025.generated.ts   the emitter's output — criteria,
 *                                       tariffs, and the paper's natural keys
 *   answer-types.<slug>.json            the seventeen answerTypes the mark
 *                                       scheme cannot state, supplied once
 *   fixture-adapter                     parent, displayOrder, answerType and
 *                                       the MCQ answer key, derived
 *
 * A new paper costs an emit and (if it has prose questions) an overlay file.
 * No constants are typed here.
 *
 * ⚠ paperId IS DELIBERATELY EMPTY. The seeder resolves it at run time from the
 * natural keys below, refusing on zero or multiple matches — so no generated
 * artefact carries a uuid that is wrong the moment it moves environment.
 */
import {
  UNIT_1_MAY_JUNE_2025,
  UNIT_1_MAY_JUNE_2025_PAPER,
} from "./unit-1-may-june-2025.generated.ts";
import { deriveWithOverlay, type PaperMeta } from "../../src/lib/exam/fixture-adapter.ts";
import type { QuestionSet } from "../../src/lib/exam/question-set.ts";
import overlay from "./answer-types.unit-1-may-june-2025.json" with { type: "json" };

const derived = deriveWithOverlay(
  UNIT_1_MAY_JUNE_2025,
  UNIT_1_MAY_JUNE_2025_PAPER,
  overlay as { answerTypes: Record<string, string> },
);

/**
 * ⚠ A REFUSAL HERE IS A THROW, NOT A WARNING.
 *
 * This module is imported by the seeder at startup. A set that silently
 * dropped the questions it could not derive would seed a partial paper and
 * report success — the failure this whole pipeline keeps having to relearn.
 */
if (derived.refusals.length > 0) {
  throw new Error(
    `unit-1-may-june-2025 cannot be seeded — ${derived.refusals.length} refusal(s):\n  ` +
      derived.refusals.join("\n  "),
  );
}

export const UNIT_1_MAY_JUNE_2025_NATURAL_KEY: PaperMeta = {
  paperCode: UNIT_1_MAY_JUNE_2025_PAPER.paperCode,
  session: UNIT_1_MAY_JUNE_2025_PAPER.session,
  year: UNIT_1_MAY_JUNE_2025_PAPER.year,
  totalMarks: UNIT_1_MAY_JUNE_2025_PAPER.totalMarks,
};

/** Where each answerType came from, for the seeder's report. */
export const UNIT_1_MAY_JUNE_2025_SOURCES = derived.sources;

export const UNIT_1_MAY_JUNE_2025_SET: QuestionSet = {
  // ⚠ RESOLVED AT RUN TIME. See the header.
  paperId: "",
  expect: {
    paperCode: UNIT_1_MAY_JUNE_2025_PAPER.paperCode,
    session: UNIT_1_MAY_JUNE_2025_PAPER.session,
    year: UNIT_1_MAY_JUNE_2025_PAPER.year,
    totalMarks: UNIT_1_MAY_JUNE_2025_PAPER.totalMarks,
  },
  // ⚠ TRUE: every question on the paper is present, so the seeder's
  // "leaf marks must sum to totalMarks" check runs rather than being skipped.
  complete: true,
  questions: derived.questions.map((q) => ({
    questionNumber: q.questionNumber,
    parentQuestionNumber: q.parentQuestionNumber,
    displayOrder: q.displayOrder,
    marks: q.marks,
    answerType: q.answerType,
    ...(q.expectedAnswer
      ? {
          expectedAnswer: {
            value: q.expectedAnswer.value,
            marksOnCorrectAnswer: q.expectedAnswer.marksOnCorrectAnswer,
          },
        }
      : {}),
    markScheme: q.markScheme,
  })),
};
