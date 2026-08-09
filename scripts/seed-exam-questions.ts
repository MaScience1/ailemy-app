/**
 * seed-exam-questions.ts — load a hand-authored question set into the Phase 1
 * interactive-exam tables created by migration 0028.
 *
 * NOT part of the Next.js build. `scripts` is excluded in tsconfig.json, so
 * this file is typechecked only when you run it. Node 26 strips the types.
 *
 *   # plan only — the default, writes nothing
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/seed-exam-questions.ts --set=wch11-01-2025-may-june
 *
 *   # write
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/seed-exam-questions.ts --set=wch11-01-2025-may-june --commit
 *
 * FLAGS
 *   --set=<name>         which fixture (required; see FIXTURES below)
 *   --commit             actually write. Without it nothing is sent.
 *   --replace-children   for the child tables that have no natural key
 *                        (regions, model answers, examiner insights), delete
 *                        what is there and re-insert. See "CHILD TABLES".
 *   --discard-approvals  REQUIRED alongside --replace-children when any region
 *                        being replaced carries a human approval. Those
 *                        signatures cannot be restored — see guardApprovals().
 *
 * ============================================================================
 * THE TRANSACTION PROBLEM — READ THIS BEFORE TRUSTING "ALL OR NOTHING"
 * ============================================================================
 * There is no direct Postgres connection in this project: no DATABASE_URL, no
 * `pg` driver, no psql. Every write goes over PostgREST via supabase-js, and
 * PostgREST gives each REQUEST its own transaction. A seventeen-question seed
 * is dozens of requests, so a real BEGIN … COMMIT spanning them is NOT
 * available and this script does not pretend otherwise.
 *
 * What it does instead is a JOURNAL AND COMPENSATE:
 *
 *   • Everything checkable is checked BEFORE the first write — the fixture
 *     against the validator, the paper against its expected identity, the
 *     existing rows against what we are about to do. The overwhelmingly
 *     likely failure is a bad fixture, and a bad fixture never reaches the
 *     network at all.
 *   • Every write appends an undo to a journal: DELETE for a row this run
 *     created, UPDATE-back-to-the-snapshot for a row it modified.
 *   • Any failure replays the journal in reverse and reports each undo
 *     individually.
 *
 * The residual risk is honest and small: if the process is killed between a
 * write and its journal entry, or a compensating undo itself fails, the
 * database is left partially seeded. The script says so, in full, naming
 * every row it could not undo. It does not print "rolled back" and leave you
 * to find out otherwise.
 *
 * THE PROPER FIX, when this graduates from a one-off to the admin tool, is a
 * SECURITY DEFINER function that takes the whole set as one jsonb argument and
 * does the work in a single statement — one PostgREST request, therefore one
 * genuine transaction, and reusable by the UI. That is a migration of its own,
 * still unwritten: the shape of the payload should be settled by seeding a
 * real paper first, which is what this script is for. (0029 is NOT that
 * migration — see MIGRATIONS REQUIRED below.)
 *
 * ============================================================================
 * MIGRATIONS REQUIRED
 * ============================================================================
 *   0028  the nine Phase 1 tables.
 *   0029  paper_questions.question_text, and mark_scheme_items.guidance /
 *         accept[] / reject[]. This script WRITES ALL FOUR and checks they
 *         exist before touching anything, so running against a database that
 *         has only 0028 fails with a message naming the migration rather than
 *         a PostgREST column error halfway through the run.
 *
 * It does NOT write mark_scheme_items.accepted_alternatives, which 0029
 * deprecated. That column is left empty on purpose so a later migration can
 * drop it without losing anything; validateQuestionSet() errors on a fixture
 * that still populates the corresponding field, so no transcribed content can
 * be stranded there silently.
 *
 * ============================================================================
 * IDEMPOTENCY
 * ============================================================================
 * Re-running is safe and is the expected way to apply a fixture edit.
 *
 *   paper_questions    UPSERT on (paper_id, question_number) — the unique key
 *                      0028 declares. Re-running updates marks / type / topic
 *                      / question_text in place, never duplicating a question.
 *   mark_scheme_items  UPSERT on (question_id, point_code) — also a real
 *                      unique key, so criterion / guidance / accept / reject
 *                      update in place.
 *
 * See CHILD TABLES for the three that have no natural key.
 *
 * ============================================================================
 * WHERE THE DOMAIN BOUNDARY SITS
 * ============================================================================
 * The types and the validator live in src/lib/exam/question-set.ts and are
 * IMPORTED, never re-implemented here — the same rule bulk-import-papers.ts
 * follows for isValidPaperPath. The admin extraction UI will produce the same
 * QuestionSet shape and call the same validateQuestionSet(). This file owns
 * only the things a script owns: argv, credentials, ordering, and the journal.
 * It contains no rule about what a valid question is.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  leafMarkTotal,
  validateQuestionSet,
  type QuestionInput,
  type QuestionSet,
} from "../src/lib/exam/question-set.ts";
import { WCH11_01_2025_MAY_JUNE } from "./exam-seed/wch11-01-2025-may-june.ts";
import {
  verifyRequiredColumns,
  type RequiredColumn,
} from "./exam-seed/schema-probe.ts";
import {
  auditRegion,
  describeAudit,
  type RegionAuditProblem,
} from "../src/lib/exam/region-audit.ts";
import { extractPageLines, linesInside } from "./exam-seed/pdf-lines.ts";

// ============================================================================
// FIXTURES
// ============================================================================

const FIXTURES: Record<string, QuestionSet> = {
  "wch11-01-2025-may-june": WCH11_01_2025_MAY_JUNE,
};

// ============================================================================
// OUTPUT
// ============================================================================

const BOLD = "[1m";
const DIM = "[2m";
const RED = "[31m";
const GREEN = "[32m";
const YELLOW = "[33m";
const RESET = "[0m";

function fail(message: string): never {
  console.error(`\n${RED}${BOLD}FAILED${RESET} ${message}\n`);
  process.exit(1);
}

function heading(text: string) {
  console.log(`\n${BOLD}${text}${RESET}`);
  console.log("─".repeat(Math.max(text.length, 60)));
}

// ============================================================================
// ARGUMENTS
// ============================================================================

type Options = {
  setName: string;
  commit: boolean;
  replaceChildren: boolean;
  /**
   * Consent to destroying human approvals. See guardApprovals().
   *
   * A SECOND flag, and named for the consequence rather than the mechanism:
   * --replace-children says what it does to the database, this says what it
   * does to someone's signature. You have to type the destructive thing.
   */
  discardApprovals: boolean;
};

function parseArgs(argv: string[]): Options {
  let setName = "";
  let commit = false;
  let replaceChildren = false;
  let discardApprovals = false;

  for (const arg of argv) {
    if (arg.startsWith("--set=")) setName = arg.slice("--set=".length);
    else if (arg === "--commit") commit = true;
    else if (arg === "--replace-children") replaceChildren = true;
    else if (arg === "--discard-approvals") discardApprovals = true;
    else fail(`unrecognised argument ${JSON.stringify(arg)}.`);
  }

  const available = Object.keys(FIXTURES).join(", ");
  if (!setName) fail(`--set=<name> is required. Available: ${available}`);
  if (!FIXTURES[setName]) {
    fail(`no fixture named ${JSON.stringify(setName)}. Available: ${available}`);
  }
  if (discardApprovals && !replaceChildren) {
    fail("--discard-approvals only means anything alongside --replace-children.");
  }
  return { setName, commit, replaceChildren, discardApprovals };
}

// ============================================================================
// CREDENTIALS
// ============================================================================

/**
 * Service role, and it has to be: paper_questions' INSERT policy in 0028 is
 * `public.is_staff()`, and this script has no session. The consequence is that
 * it BYPASSES RLS entirely — so nothing this script does proves anything about
 * whether a student can read the rows. Verify that separately, through the
 * anon key, the way /tmp/patch-test.mjs verified migration 0018.
 */
async function loadEnv(): Promise<{ url: string; serviceKey: string }> {
  const fromFile = new Map<string, string>();
  try {
    const raw = await readFile(resolve(".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      fromFile.set(key, value);
    }
  } catch {
    // Absent .env.local is fine when the variables are already exported.
  }

  const read = (key: string) => process.env[key]?.trim() || fromFile.get(key);
  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = read("SUPABASE_SERVICE_ROLE_KEY");

  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL not found in env or .env.local");
  if (!serviceKey) {
    fail("SUPABASE_SERVICE_ROLE_KEY not found in env or .env.local");
  }
  return { url, serviceKey };
}

// ============================================================================
// THE JOURNAL
// ============================================================================

type UndoEntry =
  | { kind: "reversible"; label: string; undo: () => Promise<void> }
  /**
   * A write that was never snapshotted, so it CANNOT be rolled back — recorded
   * so the failure report is complete, not because there is anything to run.
   */
  | { kind: "irreversible"; label: string; why: string };

/**
 * What actually happened when the run was rolled back.
 *
 * ⚠ THREE OUTCOMES, NOT TWO, AND THE DIFFERENCE IS THE WHOLE POINT.
 *
 * This used to be `{ undone, failed }`, and the irreversible entries were
 * stubs whose undo threw on purpose — so they landed in `failed` and the run
 * printed "THE DATABASE IS PARTIALLY SEEDED. 6 compensation(s) could not be
 * applied" on a rollback where nothing had been lost. A false alarm on the one
 * report you most need to trust, and the reader has no way to tell it from the
 * real thing.
 *
 *   undone         rolled back cleanly. Nothing to say.
 *   failed         an undo was attempted AND ERRORED. This is the alarming
 *                  one: the database is genuinely part-written and a human has
 *                  to look.
 *   irreversible   no undo existed. The write stands. Whether that matters
 *                  depends on what it overwrote, which the journal cannot
 *                  know — so it is reported plainly and NOT counted as a
 *                  failure.
 */
type Compensation = { undone: number; failed: string[]; irreversible: string[] };

class Journal {
  private readonly entries: UndoEntry[] = [];

  record(label: string, undo: () => Promise<void>) {
    this.entries.push({ kind: "reversible", label, undo });
  }

  /**
   * Declare a write that cannot be undone, and say why.
   *
   * Deliberately NOT `record(label, () => { throw ... })`. That shape is what
   * made an unreversible-by-design write indistinguishable from a broken
   * rollback.
   */
  recordIrreversible(label: string, why: string) {
    this.entries.push({ kind: "irreversible", label, why });
  }

  get size() {
    return this.entries.length;
  }

  /** How many entries could actually be rolled back if it came to it. */
  get reversibleSize() {
    return this.entries.filter((e) => e.kind === "reversible").length;
  }

  /**
   * Replay in reverse. Never throws: a compensation that fails is REPORTED,
   * because the point of this method is to tell you the true state of the
   * database, and a throw here would hide the remaining entries.
   */
  async compensate(): Promise<Compensation> {
    const failed: string[] = [];
    const irreversible: string[] = [];
    let undone = 0;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.kind === "irreversible") {
        irreversible.push(`${entry.label} — ${entry.why}`);
        continue;
      }
      try {
        await entry.undo();
        undone += 1;
      } catch (error) {
        failed.push(
          `${entry.label} — ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { undone, failed, irreversible };
  }
}

// ============================================================================
// DATABASE SHAPES
// ============================================================================

type PaperRow = {
  id: string;
  slug: string;
  paper_code: string | null;
  session: string | null;
  year: number | null;
  total_marks: number | null;
  status: string | null;
  /** Needed by the region gate — the document the boxes are checked against. */
  paper_pdf_path: string | null;
};

type QuestionRow = {
  id: string;
  paper_id: string;
  parent_question_id: string | null;
  question_number: string;
  question_text: string | null;
  display_order: number;
  marks: number;
  answer_type: string;
  command_word: string | null;
  topic: string | null;
  spec_point: string | null;
};

/**
 * Every table and column this script writes that migration 0028 did not create.
 *
 * Checked up front so a missing migration reads as "apply 0031", not as a
 * PostgREST error thrown halfway through a write.
 */
const REQUIRED_COLUMNS: RequiredColumn[] = [
  { table: "paper_questions", column: "question_text", migration: "0029" },
  { table: "mark_scheme_items", column: "guidance", migration: "0029" },
  { table: "mark_scheme_items", column: "accept", migration: "0029" },
  { table: "mark_scheme_items", column: "reject", migration: "0029" },
  // 0031 — a separate, staff-only table.
  { table: "question_expected_answers", column: "expected_value", migration: "0031" },
  { table: "question_expected_answers", column: "marks_on_correct_answer", migration: "0031" },
];

/** What the plan says will happen to one fixture question. */
type Disposition = "insert" | "update" | "unchanged";

type PlanRow = {
  question: QuestionInput;
  existing: QuestionRow | null;
  disposition: Disposition;
  /** Human-readable list of the fields an update would change. */
  changes: string[];
};

// ============================================================================
// PREFLIGHT
// ============================================================================

/**
 * The paper must be the one the fixture thinks it is. A uuid is one typo away
 * from a different paper, and seeding Chemistry questions onto a Biology paper
 * would look completely successful.
 */
async function verifyPaper(
  db: SupabaseClient,
  set: QuestionSet,
): Promise<PaperRow> {
  const { data, error } = await db
    .from("past_papers")
    .select("id, slug, paper_code, session, year, total_marks, status, paper_pdf_path")
    .eq("id", set.paperId)
    .maybeSingle();

  if (error) fail(`could not read past_papers: ${error.message}`);
  if (!data) {
    fail(
      `no past_papers row with id ${set.paperId}. The fixture points at a paper that does not exist.`,
    );
  }

  const paper = data as PaperRow;
  const mismatches: string[] = [];
  if (paper.paper_code !== set.expect.paperCode) {
    mismatches.push(
      `paper_code is ${JSON.stringify(paper.paper_code)}, fixture expects ${JSON.stringify(set.expect.paperCode)}`,
    );
  }
  if (paper.session !== set.expect.session) {
    mismatches.push(
      `session is ${JSON.stringify(paper.session)}, fixture expects ${JSON.stringify(set.expect.session)}`,
    );
  }
  if (paper.year !== set.expect.year) {
    mismatches.push(
      `year is ${paper.year}, fixture expects ${set.expect.year}`,
    );
  }
  if (paper.total_marks !== set.expect.totalMarks) {
    mismatches.push(
      `total_marks is ${paper.total_marks}, fixture expects ${set.expect.totalMarks}`,
    );
  }
  if (mismatches.length > 0) {
    fail(
      `the paper at ${set.paperId} is not the one this fixture describes:\n  - ${mismatches.join("\n  - ")}`,
    );
  }
  return paper;
}

/**
 * Prove every table and column this script writes exists, before writing.
 *
 * ⚠ The probe lives in ./exam-seed/schema-probe.ts and is a REAL GET. The
 * original guard here used `.select(col, {head:true, count:"exact"}).limit(0)`,
 * which does NOT surface PGRST205 — it passed a table that did not exist, the
 * seed then ran, and it died mid-write on the exact error this function was
 * written to prevent, leaving a partially-seeded database. See that module,
 * and schema-probe.test.ts, which asserts a non-existent table trips it.
 */
async function verifySchema(db: SupabaseClient): Promise<void> {
  const verdict = await verifyRequiredColumns(db, REQUIRED_COLUMNS);
  if (verdict.ok) return;
  fail(
    `the database is missing schema this script writes:\n  - ${verdict.failures.join("\n  - ")}\n\nNothing was written.`,
  );
}

async function loadExistingQuestions(
  db: SupabaseClient,
  paperId: string,
): Promise<QuestionRow[]> {
  const { data, error } = await db
    .from("paper_questions")
    .select(
      "id, paper_id, parent_question_id, question_number, question_text, display_order, marks, answer_type, command_word, topic, spec_point",
    )
    .eq("paper_id", paperId)
    .order("display_order", { ascending: true });

  if (error) fail(`could not read paper_questions: ${error.message}`);
  return (data ?? []) as QuestionRow[];
}

function buildPlan(set: QuestionSet, existing: QuestionRow[]): PlanRow[] {
  const byNumber = new Map(existing.map((row) => [row.question_number, row]));

  return set.questions.map((question) => {
    const found = byNumber.get(question.questionNumber) ?? null;
    if (!found) {
      return { question, existing: null, disposition: "insert", changes: [] };
    }

    const changes: string[] = [];
    const diff = (field: string, before: unknown, after: unknown) => {
      if (before !== after) {
        changes.push(`${field}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
      }
    };
    diff("question_text", found.question_text, question.questionText ?? null);
    diff("display_order", found.display_order, question.displayOrder);
    diff("marks", found.marks, question.marks);
    diff("answer_type", found.answer_type, question.answerType);
    diff("command_word", found.command_word, question.commandWord ?? null);
    diff("topic", found.topic, question.topic ?? null);
    diff("spec_point", found.spec_point, question.specPoint ?? null);

    return {
      question,
      existing: found,
      disposition: changes.length > 0 ? "update" : "unchanged",
      changes,
    };
  });
}

/**
 * Two collisions the database would catch, caught here instead so the message
 * names the question rather than a constraint.
 *
 * The display_order one is the subtle one: 0028 declares
 * UNIQUE (paper_id, display_order), so if a question ALREADY in the database
 * but NOT in this fixture sits on a slot the fixture wants, the upsert fails
 * halfway through with a 23505 and leaves the run to compensate. Better to
 * refuse before writing anything.
 */
function detectCollisions(
  set: QuestionSet,
  existing: QuestionRow[],
  plan: PlanRow[],
): string[] {
  const problems: string[] = [];
  const fixtureNumbers = new Set(set.questions.map((q) => q.questionNumber));
  const wanted = new Map(plan.map((row) => [row.question.displayOrder, row.question.questionNumber]));

  for (const row of existing) {
    if (fixtureNumbers.has(row.question_number)) continue;
    const claimant = wanted.get(row.display_order);
    if (claimant !== undefined) {
      problems.push(
        `display_order ${row.display_order} is held by existing question ${JSON.stringify(row.question_number)}, which this fixture does not contain, but the fixture wants it for ${JSON.stringify(claimant)}. UNIQUE (paper_id, display_order) would reject the write.`,
      );
    }
  }

  // A question the fixture claims is top-level but which the database has
  // parented (or vice versa) means the fixture and the database disagree about
  // the tree, and an upsert would silently reparent live rows.
  const byId = new Map(existing.map((row) => [row.id, row]));
  for (const { question, existing: found } of plan) {
    if (!found) continue;
    const dbParent = found.parent_question_id
      ? (byId.get(found.parent_question_id)?.question_number ?? "<unknown>")
      : null;
    if (dbParent !== question.parentQuestionNumber) {
      problems.push(
        `${question.questionNumber}: parent in the database is ${JSON.stringify(dbParent)}, fixture says ${JSON.stringify(question.parentQuestionNumber)}. Reparenting an existing question is not something a seed should do silently — fix the fixture or move the row by hand.`,
      );
    }
  }

  return problems;
}

// ============================================================================
// CHILD TABLES
// ============================================================================
//
// mark_scheme_items has UNIQUE (question_id, point_code), so it upserts and
// re-running simply updates each point in place.
//
// question_regions, model_answers and examiner_report_insights have NO unique
// key — deliberately, since a question may legitimately have several regions
// and several insights. That means an insert cannot be made idempotent by the
// database, and blindly inserting on a re-run doubles them.
//
// The default is therefore: if a question already has rows in one of those
// three tables, LEAVE THEM ALONE and say so. They may have been placed by the
// admin UI or approved by a human, and a seed script silently overwriting an
// approved region is a worse outcome than a stale one. --replace-children
// opts into delete-then-insert when you know the fixture is authoritative.

type ChildTable = "question_regions" | "model_answers" | "examiner_report_insights";

async function countChildren(
  db: SupabaseClient,
  table: ChildTable,
  questionId: string,
): Promise<number> {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("question_id", questionId);
  if (error) throw new Error(`counting ${table}: ${error.message}`);
  return count ?? 0;
}

// ============================================================================
// PAYLOAD BUILDERS
// ============================================================================
//
// Every row this script sends is built HERE and nowhere else, because the dry
// run and the writer both call these. A dry run that constructs its preview
// separately is a dry run that can lie: it drifts the moment someone edits one
// path and not the other, and the whole value of "show me the plan" is that
// the plan is the thing that will happen.
//
// questionId is a parameter rather than something these look up, so the dry
// run can pass a placeholder for a row that does not exist yet.

function buildQuestionPayload(
  set: QuestionSet,
  q: QuestionInput,
  parentId: string | null,
) {
  return {
    paper_id: set.paperId,
    parent_question_id: parentId,
    question_number: q.questionNumber,
    question_text: q.questionText ?? null, // 0029
    display_order: q.displayOrder,
    marks: q.marks,
    answer_type: q.answerType,
    command_word: q.commandWord ?? null,
    topic: q.topic ?? null,
    spec_point: q.specPoint ?? null,
  };
}

/**
 * 0031 — the deterministic marker's comparison target.
 *
 * A SEPARATE TABLE, not columns on paper_questions. paper_questions is
 * student-readable for live papers, so an expected_value column there is the
 * answer key served to the browser. Returns [] when the fixture records no
 * expected answer, which is a legitimate state — see 20(b)(iii).
 */
function buildExpectedAnswerRows(questionId: string, q: QuestionInput) {
  const e = q.expectedAnswer;
  if (!e) return [];
  return [
    {
      question_id: questionId,
      expected_value: e.value,
      expected_unit: e.unit ?? null,
      answer_tolerance: e.tolerance ?? null,
      accepted_values: e.acceptedValues ?? null,
      marks_on_correct_answer: e.marksOnCorrectAnswer ?? null,
      updated_at: new Date().toISOString(),
    },
  ];
}

/**
 * accepted_alternatives is deliberately NOT built. 0029 replaced it with
 * guidance / accept / reject and left the column in place only so its DROP can
 * be its own migration; writing it would give that migration data to lose.
 * validateQuestionSet() errors on a fixture that still populates the
 * corresponding field, so nothing can be stranded there silently.
 */
function buildMarkSchemeRows(questionId: string, q: QuestionInput) {
  return (q.markScheme ?? []).map((point, index) => ({
    question_id: questionId,
    point_code: point.pointCode,
    criterion: point.criterion,
    guidance: point.guidance ?? null, // 0029
    accept: point.accept ?? null, // 0029
    reject: point.reject ?? null, // 0029
    display_order: index,
  }));
}

function buildKeylessRows(
  questionId: string,
  q: QuestionInput,
): Array<{ table: ChildTable; rows: Record<string, unknown>[] }> {
  return [
    {
      table: "question_regions",
      rows: (q.regions ?? []).map((r) => ({
        question_id: questionId,
        page_number: r.pageNumber,
        bbox_x: r.x,
        bbox_y: r.y,
        bbox_width: r.width,
        bbox_height: r.height,
        rotation_applied: r.rotationApplied ?? 0,
        confidence: r.confidence ?? null,
        // approved_by / approved_at deliberately left NULL. A seeded region is
        // a proposal; approval is a human act in the admin UI.
      })),
    },
    {
      table: "examiner_report_insights",
      rows: (q.examinerInsights ?? []).map((i) => ({
        question_id: questionId,
        insight_text: i.insightText,
        insight_type: i.insightType ?? null,
      })),
    },
    {
      table: "model_answers",
      rows: q.modelAnswer
        ? [{ question_id: questionId, answer_text: q.modelAnswer }]
        : [],
    },
  ];
}

// ============================================================================
// DRY-RUN REPORT
// ============================================================================

/** Render a value the way a reviewer needs to see it, not the way JSON does. */
function renderValue(value: unknown, indent: string): string {
  if (value === null || value === undefined) return `${DIM}NULL${RESET}`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `${DIM}[] (empty)${RESET}`;
    return (
      `${value.length} entr${value.length === 1 ? "y" : "ies"}\n` +
      value.map((v) => `${indent}  • ${String(v)}`).join("\n")
    );
  }
  const text = String(value);
  if (!text.includes("\n")) return text;
  return "\n" + text.split("\n").map((l) => `${indent}  │ ${l}`).join("\n");
}

/**
 * Per-table write plan plus one fully-rendered sample row per table.
 *
 * Every row printed here comes from the same builders the writer uses, so this
 * is not a description of what would be written — it IS what would be written,
 * shown before it is sent.
 */
function printWritePlan(set: QuestionSet, plan: PlanRow[]) {
  const PLACEHOLDER = "<uuid assigned on insert>";

  type TablePlan = { table: string; rows: Record<string, unknown>[] };
  const tables: TablePlan[] = [
    { table: "paper_questions", rows: [] },
    { table: "question_regions", rows: [] },
    { table: "mark_scheme_items", rows: [] },
    { table: "question_expected_answers", rows: [] },
    { table: "examiner_report_insights", rows: [] },
    { table: "model_answers", rows: [] },
  ];
  const byName = new Map(tables.map((t) => [t.table, t]));

  for (const { question, existing } of plan) {
    const parentId = question.parentQuestionNumber === null ? null : PLACEHOLDER;
    byName
      .get("paper_questions")!
      .rows.push(buildQuestionPayload(set, question, parentId));

    const qid = existing?.id ?? PLACEHOLDER;
    byName.get("mark_scheme_items")!.rows.push(...buildMarkSchemeRows(qid, question));
    byName
      .get("question_expected_answers")!
      .rows.push(...buildExpectedAnswerRows(qid, question));
    for (const { table, rows } of buildKeylessRows(qid, question)) {
      byName.get(table)!.rows.push(...rows);
    }
  }

  heading("7. Write plan by table");
  const width = Math.max(...tables.map((t) => t.table.length));
  let total = 0;
  for (const t of tables) {
    total += t.rows.length;
    const note =
      t.rows.length === 0
        ? t.table === "question_regions"
          ? `${DIM}— no bbox is authored from a text dump; the admin mapping tool produces these${RESET}`
          : `${DIM}— none in this fixture${RESET}`
        : "";
    console.log(
      `  ${t.table.padEnd(width)}  ${String(t.rows.length).padStart(3)} row(s)  ${note}`,
    );
  }
  console.log(`  ${"".padEnd(width)}  ${String(total).padStart(3)} total`);

  console.log(
    `\n  ${DIM}Untouched by this run: exam_attempts, question_attempts,\n` +
      `  student_responses, marking_results — student-side tables, and\n` +
      `  past_papers, which is only read.${RESET}`,
  );

  // --- sample rows --------------------------------------------------------
  // Chosen to exercise the 0029 columns rather than to look tidy: one point
  // with a reject rule, one with accept + guidance, and one question row whose
  // question_text is multi-line.
  const msRows = byName.get("mark_scheme_items")!.rows;
  const withReject = msRows.find((r) => Array.isArray(r.reject) && r.reject.length > 0);
  const withAcceptAndGuidance = msRows.find(
    (r) => Array.isArray(r.accept) && (r.accept as string[]).length > 0 && r.guidance,
  );

  heading("8. Sample rows — exactly as they would be sent");

  for (const [label, sample] of [
    ["mark_scheme_items — the reject[] case", withReject],
    ["mark_scheme_items — accept[] + guidance", withAcceptAndGuidance],
  ] as const) {
    if (!sample) continue;
    console.log(`\n  ${BOLD}${label}${RESET}`);
    for (const [key, value] of Object.entries(sample)) {
      console.log(`    ${key.padEnd(14)} ${renderValue(value, "    ")}`);
    }
  }

  const sampleQuestion = byName
    .get("paper_questions")!
    .rows.find((r) => typeof r.question_text === "string" && r.question_text.includes("\n"));
  if (sampleQuestion) {
    console.log(`\n  ${BOLD}paper_questions — a multi-line question_text${RESET}`);
    for (const [key, value] of Object.entries(sampleQuestion)) {
      console.log(`    ${key.padEnd(20)} ${renderValue(value, "    ")}`);
    }
  }

  // --- the deprecated column ---------------------------------------------
  const writesLegacy = msRows.some((r) =>
    Object.hasOwn(r, "accepted_alternatives"),
  );
  console.log(
    `\n  ${writesLegacy ? RED + "✗" : GREEN + "✓"}${RESET} accepted_alternatives ` +
      `${writesLegacy ? "IS being written — 0029 deprecated it" : "is not written by any row above (0029 deprecated it; the column stays empty so 0030 can drop it)"}`,
  );
}

// ============================================================================
// WRITE
// ============================================================================

type Stats = {
  questionsInserted: number;
  questionsUpdated: number;
  questionsUnchanged: number;
  markSchemePoints: number;
  expectedAnswers: number;
  regions: number;
  insights: number;
  modelAnswers: number;
  skippedChildren: string[];
};

/**
 * ⚠ THE REGION GATE. Runs BEFORE anything is written, and aborts the seed.
 *
 * Two invariants, defined in src/lib/exam/region-audit.ts: a region may contain
 * no marks tally, and at most one mark allocation. Both caught a real fault
 * that had survived extraction, rendering, a visual review, a seed, a re-trim,
 * a re-widen and a second seed — Q1 had swallowed its own "(Total for Question
 * 1 = 1 mark)", and 22(c) had swallowed the whole of the UNSEEDED sub-question
 * 22(d), including a mass-spectrum grid.
 *
 * The second invariant is the valuable one: it detects a swallowed neighbour
 * without knowing the neighbour exists. Every paper is partially seeded, so
 * the unseeded questions are precisely the ones nothing else can see.
 *
 * It reads the ACTUAL PDF, because that is the only way to know what a box
 * contains. The document is fetched using the path on the paper row the
 * fixture has already been checked against, so it cannot be pointed at a
 * different document than the regions were drawn on.
 *
 * A fixture with no regions skips it — nothing to check, and the download
 * would be a round trip for nothing.
 */
/**
 * ⚠ REFUSES --replace-children WHEN IT WOULD DESTROY A HUMAN APPROVAL.
 *
 * question_regions.approved_by / approved_at record that a person looked at
 * that box drawn over the rendered page and signed for it. Producing them is
 * slow and manual — sixteen regions on WCH11/01 took two rounds of extraction
 * fixes, a rendered review of ten pages and an independent re-check before
 * anyone was willing to sign.
 *
 * --replace-children deletes and re-inserts. The deletion is now snapshotted,
 * so a run that FAILS compensates and puts the approvals back — but a run that
 * SUCCEEDS replaces them with fresh, unapproved rows, and no journal helps
 * with that because nothing went wrong. The journal protects the failure path;
 * this guard protects the success path, which is the one that actually loses
 * signatures.
 *
 * The refusal NAMES the rows and the approver, because "16 approved regions"
 * is a number and "signed by mascience15@gmail.com on 9 August" is a person
 * you might want to ask first.
 *
 * ⚠ It reads approvals for THIS PAPER'S questions only. Approvals on other
 * papers are not at risk from this run and listing them would train the reader
 * to skim the warning.
 */
async function guardApprovals(
  db: SupabaseClient,
  set: QuestionSet,
  options: Options,
): Promise<void> {
  if (!options.replaceChildren) {
    console.log(
      `  ${DIM}--replace-children not passed; existing child rows are left alone${RESET}`,
    );
    return;
  }

  const { data: questions, error: qErr } = await db
    .from("paper_questions")
    .select("id, question_number")
    .eq("paper_id", set.paperId);
  if (qErr) fail(`could not read paper_questions to check approvals: ${qErr.message}`);
  const names = new Map((questions ?? []).map((q) => [q.id as string, q.question_number as string]));
  if (names.size === 0) {
    console.log(`  ${DIM}no questions on this paper yet — nothing to protect${RESET}`);
    return;
  }

  const { data: regions, error: rErr } = await db
    .from("question_regions")
    .select("question_id, page_number, bbox_x, bbox_y, bbox_width, bbox_height, approved_by, approved_at")
    .in("question_id", [...names.keys()])
    .not("approved_at", "is", null);
  if (rErr) fail(`could not read question_regions to check approvals: ${rErr.message}`);

  const approved = regions ?? [];
  if (approved.length === 0) {
    console.log(
      `  ${GREEN}✓${RESET} no approved regions on this paper — --replace-children ` +
        `would discard machine proposals only`,
    );
    return;
  }

  // Resolve approvers to addresses. A uuid tells the reader nothing about
  // whose signature they are about to delete.
  const emails = new Map<string, string>();
  for (const id of new Set(approved.map((r) => r.approved_by as string).filter(Boolean))) {
    const { data } = await db.auth.admin.getUserById(id);
    emails.set(id, data?.user?.email ?? id);
  }

  const rows = approved
    .map((r) => ({
      q: names.get(r.question_id as string) ?? "(unknown)",
      page: r.page_number as number,
      box: `${Number(r.bbox_x).toFixed(0)},${Number(r.bbox_y).toFixed(0)} ` +
           `${Number(r.bbox_width).toFixed(0)}x${Number(r.bbox_height).toFixed(0)}`,
      at: String(r.approved_at).slice(0, 19).replace("T", " "),
      by: emails.get(r.approved_by as string) ?? "(unknown)",
    }))
    .sort((a, b) => a.page - b.page || a.q.localeCompare(b.q));

  const w = Math.max(...rows.map((r) => r.q.length), 8);
  const render = (colour: string) => {
    console.error(
      `  ${DIM}${"question".padEnd(w)}  page  box${" ".repeat(18)}approved             approved by${RESET}`,
    );
    for (const r of rows) {
      console.error(
        `  ${colour}${r.q.padEnd(w)}${RESET}  ${String("p" + r.page).padEnd(5)} ` +
          `${r.box.padEnd(20)} ${r.at}  ${r.by}`,
      );
    }
  };

  if (options.discardApprovals) {
    console.error(
      `  ${YELLOW}!${RESET} ${BOLD}--discard-approvals given.${RESET} If this run ` +
        `succeeds, these ${approved.length} human approval(s) are replaced by fresh ` +
        `unapproved rows:`,
    );
    render(YELLOW);
    console.error(
      `  ${YELLOW}A successful run replaces them with unapproved rows. The journal ` +
        `restores them only if the run FAILS. Re-approving means reviewing every ` +
        `box again.${RESET}\n`,
    );
    return;
  }

  console.error(
    `  ${RED}✗${RESET} --replace-children would DELETE ${approved.length} ` +
      `HUMAN-APPROVED region(s) on this paper:`,
  );
  render(RED);
  fail(
    `Refusing to discard ${approved.length} approval(s). If this run SUCCEEDS they ` +
      `are replaced by fresh unapproved rows and every box needs reviewing again. ` +
      `(The journal snapshots the deletion, so a run that FAILS puts them back — ` +
      `but success is not failure.)\n\n` +
      `  If the regions really have changed and must be rewritten, re-run with ` +
      `--discard-approvals alongside --replace-children.\n` +
      `  If you only meant to update questions or the mark scheme, drop ` +
      `--replace-children: child rows are left untouched without it.\n\n` +
      `  Nothing was written.`,
  );
}

async function gateRegions(
  set: QuestionSet,
  paper: { paper_pdf_path: string | null },
  supabaseUrl: string,
): Promise<void> {
  const withRegions = set.questions.filter((q) => (q.regions?.length ?? 0) > 0);
  if (withRegions.length === 0) {
    console.log(`  ${DIM}no regions in this fixture — nothing to gate${RESET}`);
    return;
  }
  if (!paper.paper_pdf_path) {
    fail(
      `The fixture defines regions on ${withRegions.length} question(s) but the paper ` +
        `row has no paper_pdf_path, so there is no document to check them against. ` +
        `Nothing was written.`,
    );
  }

  // ⚠ The URL is built from the env this script ALREADY loaded, not from
  // getPaperPublicUrl(). That helper reads process.env.NEXT_PUBLIC_SUPABASE_URL,
  // which a Next server has and this script does not — loadEnv() parses
  // .env.local itself and never exports into process.env. Called from here it
  // logged a warning, returned null, and the gate then tried to fetch(null).
  // A gate that cannot fetch the paper must ABORT, not fall through.
  const base = supabaseUrl.replace(/\/$/, "");
  const path = paper.paper_pdf_path.replace(/^\//, "");
  const url = `${base}/storage/v1/object/public/papers/${path}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (e) {
    fail(
      `Could not reach the paper PDF to gate the regions (${e instanceof Error ? e.message : String(e)}). ` +
        `Refusing to write regions that have not been checked. Nothing was written.`,
    );
    return;
  }
  if (!response.ok) {
    fail(
      `Could not fetch the paper PDF (HTTP ${response.status}) to gate the regions. ` +
        `Refusing to write regions that have not been checked. Nothing was written.`,
    );
  }
  const pages = await extractPageLines(new Uint8Array(await response.arrayBuffer()));
  const byNumber = new Map(pages.map((pg) => [pg.pageNumber, pg]));

  const problems: RegionAuditProblem[] = [];
  let checked = 0;
  for (const q of withRegions) {
    for (const r of q.regions ?? []) {
      const page = byNumber.get(r.pageNumber);
      if (!page) {
        problems.push({
          questionNumber: q.questionNumber,
          pageNumber: r.pageNumber,
          problem: `page ${r.pageNumber} is not in the PDF, which has ${pages.length}`,
        });
        continue;
      }
      checked += 1;
      problems.push(
        ...auditRegion({
          questionNumber: q.questionNumber,
          pageNumber: r.pageNumber,
          linesInside: linesInside(page, r),
        }),
      );
    }
  }

  if (problems.length > 0) {
    console.error(`  ${RED}✗${RESET} ${problems.length} region(s) failed the gate:`);
    console.error(describeAudit(problems));
    fail(
      `Region gate failed. NOTHING WAS WRITTEN — not the regions, not the questions, ` +
        `not the mark scheme. Fix the boxes and re-run.`,
    );
  }
  console.log(
    `  ${GREEN}✓${RESET} ${checked} region(s) checked against the PDF — no marks tally, ` +
      `none spanning more than one question`,
  );
}

async function applyPlan(
  db: SupabaseClient,
  set: QuestionSet,
  plan: PlanRow[],
  options: Options,
  journal: Journal,
): Promise<Stats> {
  const stats: Stats = {
    questionsInserted: 0,
    questionsUpdated: 0,
    questionsUnchanged: 0,
    markSchemePoints: 0,
    expectedAnswers: 0,
    regions: 0,
    insights: 0,
    modelAnswers: 0,
    skippedChildren: [],
  };

  /** questionNumber → uuid, filled as we go so children can find their parent. */
  const idByNumber = new Map<string, string>();
  for (const row of plan) {
    if (row.existing) idByNumber.set(row.question.questionNumber, row.existing.id);
  }

  // Array order is insertion order, and the validator has already proved every
  // parent appears before its children — so this loop can always resolve a
  // parent uuid from a row it has already written.
  for (const row of plan) {
    const q = row.question;
    const parentId =
      q.parentQuestionNumber === null
        ? null
        : (idByNumber.get(q.parentQuestionNumber) ?? null);

    if (q.parentQuestionNumber !== null && parentId === null) {
      throw new Error(
        `${q.questionNumber}: parent ${q.parentQuestionNumber} has no id. The validator should have caught this.`,
      );
    }

    const payload = buildQuestionPayload(set, q, parentId);

    const { data, error } = await db
      .from("paper_questions")
      .upsert(payload, { onConflict: "paper_id,question_number" })
      .select("id")
      .single();

    if (error) {
      throw new Error(`upserting question ${q.questionNumber}: ${error.message}`);
    }

    const questionId = (data as { id: string }).id;
    idByNumber.set(q.questionNumber, questionId);

    if (row.existing) {
      if (row.disposition === "update") {
        stats.questionsUpdated += 1;
        // Restore the snapshot, not a delete: this row predates the run.
        const before = row.existing;
        journal.record(`restore question ${q.questionNumber}`, async () => {
          const { error: undoError } = await db
            .from("paper_questions")
            .update({
              parent_question_id: before.parent_question_id,
              question_text: before.question_text,
              display_order: before.display_order,
              marks: before.marks,
              answer_type: before.answer_type,
              command_word: before.command_word,
              topic: before.topic,
              spec_point: before.spec_point,
            })
            .eq("id", before.id);
          if (undoError) throw new Error(undoError.message);
        });
      } else {
        stats.questionsUnchanged += 1;
      }
    } else {
      stats.questionsInserted += 1;
      // ON DELETE CASCADE takes this row's mark scheme, regions, insights and
      // model answer with it, so one delete undoes the whole subtree.
      journal.record(`delete question ${q.questionNumber}`, async () => {
        const { error: undoError } = await db
          .from("paper_questions")
          .delete()
          .eq("id", questionId);
        if (undoError) throw new Error(undoError.message);
      });
    }

    // --- mark scheme: real unique key, so upsert -------------------------
    const rows = buildMarkSchemeRows(questionId, q);
    if (rows.length > 0) {
      const { error: msError } = await db
        .from("mark_scheme_items")
        .upsert(rows, { onConflict: "question_id,point_code" });
      if (msError) {
        throw new Error(`mark scheme for ${q.questionNumber}: ${msError.message}`);
      }
      stats.markSchemePoints += rows.length;
      // No undo for a pre-existing question's points: the previous criterion
      // text is not snapshotted. Recorded here so the failure report is
      // truthful rather than silent.
      if (row.existing) {
        journal.recordIrreversible(
          `mark-scheme upsert on pre-existing question ${q.questionNumber} (${rows.length} point(s))`,
          `the previous criterion text was not snapshotted`,
        );
      }
    }

    // --- expected answer: real unique key on question_id, so upsert -------
    const expectedRows = buildExpectedAnswerRows(questionId, q);
    if (expectedRows.length > 0) {
      const { error: eaError } = await db
        .from("question_expected_answers")
        .upsert(expectedRows, { onConflict: "question_id" });
      if (eaError) {
        throw new Error(`expected answer for ${q.questionNumber}: ${eaError.message}`);
      }
      stats.expectedAnswers += 1;
    }

    // --- keyless child tables --------------------------------------------
    const BUMP: Record<ChildTable, (n: number) => void> = {
      question_regions: (n) => {
        stats.regions += n;
      },
      examiner_report_insights: (n) => {
        stats.insights += n;
      },
      model_answers: (n) => {
        stats.modelAnswers += n;
      },
    };

    for (const { table, rows } of buildKeylessRows(questionId, q)) {
      const bump = () => BUMP[table](rows.length);
      if (rows.length === 0) continue;

      const present = row.existing ? await countChildren(db, table, questionId) : 0;
      if (present > 0 && !options.replaceChildren) {
        stats.skippedChildren.push(
          `${q.questionNumber}: ${table} already has ${present} row(s) — left untouched. Pass --replace-children to overwrite.`,
        );
        continue;
      }
      if (present > 0) {
        // ⚠ SNAPSHOT FIRST, THEN DELETE BY THE IDS WE HOLD.
        //
        // This used to be `.delete().eq("question_id", …)` with nothing kept,
        // and the journal entry for it was a stub that threw "deleted rows
        // were not snapshotted" — the seeder's only genuinely irreversible
        // operation, sitting inside a mechanism whose whole promise is that a
        // failure compensates cleanly.
        //
        // Reading them first fixes two things at once. The delete now
        // addresses rows by id rather than by a filter that matches whatever
        // happens to be there, and the journal can put them BACK — including
        // approved_by / approved_at, which is what made --discard-approvals a
        // one-way door.
        const { data: snapshot, error: snapError } = await db
          .from(table)
          .select("*")
          .eq("question_id", questionId);
        if (snapError) {
          throw new Error(
            `snapshotting ${table} for ${q.questionNumber} before replacing it: ${snapError.message}`,
          );
        }
        const doomed = (snapshot ?? []) as { id: string }[];

        const { error: delError, count: deleted } = await db
          .from(table)
          .delete({ count: "exact" })
          .in("id", doomed.map((r) => r.id));
        if (delError) {
          throw new Error(`clearing ${table} for ${q.questionNumber}: ${delError.message}`);
        }
        // The row count is the proof. A delete whose filter matches nothing
        // returns neither rows nor an error, so "no error" is not "it went".
        if ((deleted ?? 0) !== doomed.length) {
          throw new Error(
            `clearing ${table} for ${q.questionNumber}: deleted ${deleted ?? 0} of ` +
              `${doomed.length} row(s). Refusing to continue with a partial delete.`,
          );
        }

        journal.record(
          `restore ${doomed.length} ${table} row(s) on ${q.questionNumber}`,
          async () => {
            // Re-inserted with their ORIGINAL ids, so anything referencing a
            // region by id still resolves after a compensation.
            const { error: undoError } = await db.from(table).insert(snapshot ?? []);
            if (undoError) throw new Error(undoError.message);
          },
        );
      }

      const { data: inserted, error: insError } = await db
        .from(table)
        .insert(rows)
        .select("id");
      if (insError) {
        throw new Error(`${table} for ${q.questionNumber}: ${insError.message}`);
      }
      bump();

      const ids = ((inserted ?? []) as { id: string }[]).map((r) => r.id);
      if (ids.length > 0 && row.existing) {
        // New question rows need no entry — deleting the question cascades.
        journal.record(`delete ${ids.length} ${table} row(s) on ${q.questionNumber}`, async () => {
          const { error: undoError } = await db.from(table).delete().in("id", ids);
          if (undoError) throw new Error(undoError.message);
        });
      }
    }
  }

  return stats;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const set = FIXTURES[options.setName];

  console.log(
    `\n${BOLD}seed-exam-questions${RESET} — ${options.setName} ` +
      (options.commit
        ? `${RED}${BOLD}--commit (WILL WRITE)${RESET}`
        : `${DIM}dry run, writes nothing${RESET}`),
  );

  // ---- 1. the fixture, checked with no network at all --------------------
  heading("1. Fixture validation");
  const issues = validateQuestionSet(set);
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`  ${RED}✗${RESET} ${issue.where || "(set)"}: ${issue.message}`);
    }
    fail(`${issues.length} validation issue(s). Nothing was sent to the database.`);
  }
  const leaves = leafMarkTotal(set);
  console.log(
    `  ${GREEN}✓${RESET} ${set.questions.length} questions, ${leaves} leaf marks of ${set.expect.totalMarks}`,
  );
  if (!set.complete) {
    console.log(
      `  ${YELLOW}!${RESET} complete: false — this is a PARTIAL set. The ` +
        `"leaf marks sum to the paper total" check was skipped, and the ` +
        `remaining ${set.expect.totalMarks - leaves} marks are not seeded.`,
    );
  }

  // ---- 2. the paper is the one the fixture names -------------------------
  const { url, serviceKey } = await loadEnv();
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  heading("2. Schema");
  await verifySchema(db);
  console.log(
    `  ${GREEN}✓${RESET} 0029 + 0031 applied — every column this script writes resolves`,
  );

  heading("3. Paper identity");
  const paper = await verifyPaper(db, set);
  console.log(
    `  ${GREEN}✓${RESET} ${paper.paper_code}  ${paper.session} ${paper.year}  ` +
      `${paper.total_marks} marks  status=${paper.status}\n     slug ${paper.slug}\n     id   ${paper.id}`,
  );

  heading("4. Region gate");
  await gateRegions(set, paper, url);

  // ---- 3. what is already there ------------------------------------------
  heading("5. Approval guard");
  await guardApprovals(db, set, options);

  heading("6. Plan");
  const existing = await loadExistingQuestions(db, set.paperId);
  const plan = buildPlan(set, existing);

  const collisions = detectCollisions(set, existing, plan);
  if (collisions.length > 0) {
    for (const problem of collisions) console.error(`  ${RED}✗${RESET} ${problem}`);
    fail(`${collisions.length} collision(s) with rows already in the database. Nothing was written.`);
  }

  const orphans = existing.filter(
    (row) => !set.questions.some((q) => q.questionNumber === row.question_number),
  );

  const width = Math.max(...plan.map((r) => r.question.questionNumber.length), 8);
  console.log(
    `  ${DIM}${"question".padEnd(width)}  ord   mk  type                 action${RESET}`,
  );
  for (const row of plan) {
    const q = row.question;
    const mark =
      row.disposition === "insert"
        ? `${GREEN}insert${RESET}`
        : row.disposition === "update"
          ? `${YELLOW}update${RESET}  ${row.changes.join("; ")}`
          : `${DIM}unchanged${RESET}`;
    const kids =
      (q.markScheme?.length ?? 0) +
      (q.regions?.length ?? 0) +
      (q.examinerInsights?.length ?? 0);
    console.log(
      `  ${q.questionNumber.padEnd(width)}  ${String(q.displayOrder).padStart(3)}  ` +
        `${String(q.marks).padStart(2)}  ${q.answerType.padEnd(18)}  ${mark}` +
        (kids ? ` ${DIM}(+${kids} child rows)${RESET}` : ""),
    );
  }

  if (orphans.length > 0) {
    console.log(
      `\n  ${YELLOW}!${RESET} ${orphans.length} question(s) exist on this paper but are not in the fixture. ` +
        `They are LEFT ALONE — this script never deletes a question it did not create:`,
    );
    for (const row of orphans) {
      console.log(`      ${row.question_number}  (display_order ${row.display_order})`);
    }
  }

  const inserts = plan.filter((r) => r.disposition === "insert").length;
  const updates = plan.filter((r) => r.disposition === "update").length;
  const unchanged = plan.filter((r) => r.disposition === "unchanged").length;
  console.log(
    `\n  ${inserts} insert, ${updates} update, ${unchanged} unchanged`,
  );

  // ---- 5/6. what every table receives, and what the rows look like --------
  printWritePlan(set, plan);

  // ---- 7. write, or don't -------------------------------------------------
  if (!options.commit) {
    heading("9. Dry run complete");
    console.log(
      `  Nothing was written. Re-run with ${BOLD}--commit${RESET} to apply.\n`,
    );
    return;
  }

  heading("9. Writing");
  const journal = new Journal();
  let stats: Stats;
  try {
    stats = await applyPlan(db, set, plan, options, journal);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n  ${RED}✗${RESET} ${message}`);
    console.error(
      `  Compensating ${journal.reversibleSize} reversible write(s) of ` +
        `${journal.size} journalled…`,
    );
    const { undone, failed, irreversible } = await journal.compensate();
    console.error(`  ${undone} undone.`);

    // ⚠ ONLY `failed` MEANS PARTIALLY SEEDED. An irreversible entry is a write
    // that never had an undo; reporting it as a failed compensation is what
    // produced "THE DATABASE IS PARTIALLY SEEDED. 6 compensation(s) could not
    // be applied" on a rollback where nothing had been lost.
    if (failed.length > 0) {
      console.error(
        `\n  ${RED}${BOLD}THE DATABASE IS PARTIALLY SEEDED.${RESET} ` +
          `${failed.length} rollback(s) were attempted and FAILED:`,
      );
      for (const f of failed) console.error(`      ${f}`);
      console.error(
        `\n  Inspect paper_questions for paper_id ${set.paperId} before re-running.`,
      );
    }

    if (irreversible.length > 0) {
      console.error(
        `\n  ${YELLOW}${irreversible.length} write(s) had no undo and therefore ` +
          `STAND${RESET} — this is not a rollback failure:`,
      );
      for (const i of irreversible) console.error(`      ${i}`);
      console.error(
        `  ${DIM}Whether that matters depends on what they overwrote, which the ` +
          `journal cannot know.${RESET}`,
      );
    }

    if (failed.length === 0) {
      console.error(
        `\n  ${GREEN}Every reversible write was rolled back.${RESET}` +
          (irreversible.length > 0
            ? ` The ${irreversible.length} above are the only changes still in place.`
            : ` The database is back to its pre-run state.`),
      );
    }
    fail("seed aborted.");
  }

  heading("10. Done");
  console.log(`  questions   ${stats.questionsInserted} inserted, ${stats.questionsUpdated} updated, ${stats.questionsUnchanged} unchanged`);
  console.log(`  mark scheme ${stats.markSchemePoints} point(s) upserted`);
  console.log(`  expected    ${stats.expectedAnswers} answer(s) upserted (staff-only table)`);
  console.log(`  regions     ${stats.regions}`);
  console.log(`  insights    ${stats.insights}`);
  console.log(`  model answ. ${stats.modelAnswers}`);
  if (stats.skippedChildren.length > 0) {
    console.log(`\n  ${YELLOW}Skipped, to avoid duplicating keyless rows:${RESET}`);
    for (const line of stats.skippedChildren) console.log(`      ${line}`);
  }
  console.log(
    `\n  ${DIM}This ran as service role and bypassed RLS. It proves the rows exist;\n` +
      `  it proves nothing about what a student can read. Verify that with the anon key.${RESET}\n`,
  );
}

main().catch((error) => {
  fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
});
