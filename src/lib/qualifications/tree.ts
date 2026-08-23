import { createClient } from "@/lib/supabase/server";
import { PATHWAY_COPY, type Pathway } from "@/lib/catalogue/pathways";

import {
  LEVELS,
  LEVEL_COPY,
  LEVEL_PATHWAYS,
  SCOPE_PATHWAY,
  QUALIFICATION_SCOPES,
  qualificationName,
  type Level,
  type QualificationScope,
} from "./model.ts";
import {
  stageOf,
  unitSummary,
  strongestStatus,
  type SubjectHoldings,
} from "./derive.ts";
export {
  stageOf, unitSummary, strongestStatus, holdingsLabel, resourcesBlurb,
  type SubjectHoldings,
} from "./derive.ts";
import {
  boardSupport,
  orderBoards,
  supportStatusFor,
  capabilitiesFor,
  EMPTY_COVERAGE,
  type BoardSupport,
  type Capability,
  type CoverageCounts,
  type SupportStatus,
} from "./support.ts";

/**
 * The whole browsable shape of one subject, in one read (§29, §3).
 *
 * ============================================================================
 * ⚠ THIS IS A PROJECTION OF THE CATALOGUE, NOT A SECOND COPY OF IT
 * ============================================================================
 * The selector needs Level → Qualification → Board → Course. The database
 * already holds every one of those facts: `courses.pathway` gives the level
 * and scope, `curricula.slug` gives the board through CURRICULUM_BOARD, and
 * the course rows themselves are the leaves. So nothing here is typed — the
 * tree is assembled from the same tables `coverageForPathway` reads, and
 * every status comes from `supportStatusFor()`.
 *
 * The alternative — a hand-written config listing the 14 Chemistry courses
 * under their levels — would be a second representation of the catalogue that
 * is correct until the day somebody adds the fifteenth course. §29 forbids it
 * and the qualification build already learned it: a typed status is true only
 * on the day it is typed.
 *
 * ⚠ ONE PASS, NOT TWELVE. coverageForPathway issues three queries per pathway;
 * asking it for four pathways to draw one page would be twelve round trips for
 * facts that come out of the same three tables. This reads the subject once.
 *
 * ⚠ IT ASKS ONLY WHAT THE VIEWER MAY READ. `paper_questions` refuses anon with
 * 42501 — it is admin-gated so exam content cannot be scraped — and counting it
 * from a public page is what turned every logged-out student's board list into
 * an empty page during the qualification build. Marking is derived from past
 * papers, which the same student can read.
 *
 * ⚠ A FAILED READ IS AN ERROR, NEVER AN EMPTY TREE. Returning `levels: []` on
 * a query failure would render "no courses yet" about a catalogue of fourteen.
 * Every failure lands in `error` and the page is required to show it.
 */

// ── the shape the selector consumes ─────────────────────────────────────────

export type CourseNode = {
  /** The existing course slug. /resources/<subject>/<slug> — §37, unchanged. */
  slug: string;
  name: string;
  /**
   * "AS", "A2", "SL", "HL" — the stage WITHIN a board, or null when the board
   * has nothing to distinguish. See stageOf().
   */
  stage: string | null;
  /** Real unit codes, e.g. "Units 1–3". Null when the course has no units. */
  unitSummary: string | null;
  status: SupportStatus;
  capabilities: Capability[];
  counts: CoverageCounts;
};

export type BoardNode = Omit<BoardSupport, "counts"> & {
  counts: CoverageCounts;
  /** §11 — AS and A2 are CHILDREN of Edexcel IAL, not its peers. */
  courses: CourseNode[];
};

export type ScopeNode = {
  scope: QualificationScope;
  /** "International A-Level" — the student-facing name (§30). */
  name: string;
  pathway: Pathway;
  boards: BoardNode[];
};

export type LevelNode = {
  level: Level;
  name: string;
  subtitle: string;
  scopes: ScopeNode[];
  /** Strongest status anywhere under this level. */
  status: SupportStatus;
};

/**
 * ⚠ IB AND AP ARE NOT LEVELS, AND THIS IS THE FOUNDER'S RULING (§2).
 * They are neither GCSE nor A-Level qualifications, so model.ts refuses to
 * hang them under either — a refusal the qualification build made
 * deliberately and /learn/[subject] already honours with a two-card chooser.
 * Promoting them to level peers here would have made the two doors into
 * Chemistry disagree, which is the exact defect §2 names.
 *
 * They keep their routes and their courses, and appear as a quieter secondary
 * row: reachable, honest about what they are, and not competing with the two
 * levels most students are actually choosing between.
 */
export type OtherQualificationNode = {
  pathway: Pathway;
  name: string;
  courses: CourseNode[];
  status: SupportStatus;
};

export type SubjectTree = {
  subject: string;
  levels: LevelNode[];
  other: OtherQualificationNode[];
  /** Non-null when a count could not be read. The UI must say so, not guess. */
  error: string | null;
};

// ── the read ────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  slug: string;
  name: string;
  pathway: string | null;
  curricula: { slug: string; name: string } | null;
};

/** Wired here for the same reason reader.ts wires it: `cohorts` carries no
 *  curriculum link until the parked migration lands (§29 of the qualification
 *  brief). Kept identical so the two readers cannot disagree. */
const TUITION_CURRICULA = new Set<string>(["edexcel-ial"]);

const EMPTY: SubjectTree = { subject: "", levels: [], other: [], error: null };

export async function loadSubjectTree(subjectSlug: string): Promise<SubjectTree> {
  const fail = (error: string): SubjectTree => ({ ...EMPTY, subject: subjectSlug, error });
  const db = await createClient();

  const { data: subject, error: sErr } = await db
    .from("subjects").select("id").eq("slug", subjectSlug).maybeSingle();
  if (sErr) return fail(`subject lookup failed: ${sErr.message}`);
  if (!subject) return { ...EMPTY, subject: subjectSlug };

  const { data: courses, error: cErr } = await db
    .from("courses")
    .select("id, slug, name, pathway, curricula(slug, name)")
    .eq("subject_id", subject.id);
  if (cErr) return fail(`course lookup failed: ${cErr.message}`);

  const rows = (courses ?? []) as unknown as Row[];
  if (rows.length === 0) return { ...EMPTY, subject: subjectSlug };
  const ids = rows.map((r) => r.id);

  const [lessonsRes, papersRes, unitsRes] = await Promise.all([
    db.from("lessons").select("course_id, status, deck_path").in("course_id", ids),
    db.from("past_papers").select("course_id").in("course_id", ids),
    db.from("units").select("course_id, name").in("course_id", ids),
  ]);
  if (lessonsRes.error) return fail(`lesson counts failed: ${lessonsRes.error.message}`);
  if (papersRes.error) return fail(`past paper counts failed: ${papersRes.error.message}`);
  if (unitsRes.error) return fail(`unit lookup failed: ${unitsRes.error.message}`);

  // ── fold the flat rows into per-course counts, once ───────────────────────
  const countsByCourse = new Map<string, CoverageCounts>();
  const unitNames = new Map<string, string[]>();
  for (const r of rows) {
    countsByCourse.set(r.id, {
      ...EMPTY_COVERAGE,
      courses: 1,
      hasTuition: TUITION_CURRICULA.has(r.curricula?.slug ?? ""),
    });
  }
  for (const l of lessonsRes.data ?? []) {
    const c = countsByCourse.get(l.course_id as string);
    if (!c) continue;
    c.lessons += 1;
    if (l.status === "live") c.liveLessons += 1;
    if (l.deck_path) c.lessonsWithDecks += 1;
  }
  for (const p of papersRes.data ?? []) {
    const c = countsByCourse.get(p.course_id as string);
    if (c) c.pastPapers += 1;
  }
  for (const u of unitsRes.data ?? []) {
    const list = unitNames.get(u.course_id as string) ?? [];
    // ⚠ NAMES, NOT CODES. `code` is the paper code (WCH11); the unit number
    // lives in the name. See unitSummary in derive.ts.
    if (u.name) list.push(u.name as string);
    unitNames.set(u.course_id as string, list);
  }

  const nodeFor = (r: Row): CourseNode => {
    const counts = countsByCourse.get(r.id) ?? { ...EMPTY_COVERAGE };
    return {
      slug: r.slug,
      name: r.name,
      stage: stageOf(r.name),
      unitSummary: unitSummary(unitNames.get(r.id) ?? []),
      status: supportStatusFor(counts),
      capabilities: capabilitiesFor(counts),
      counts,
    };
  };

  const sum = (list: CoverageCounts[]): CoverageCounts =>
    list.reduce<CoverageCounts>((a, c) => ({
      courses: a.courses + c.courses,
      lessons: a.lessons + c.lessons,
      liveLessons: a.liveLessons + c.liveLessons,
      lessonsWithDecks: a.lessonsWithDecks + c.lessonsWithDecks,
      pastPapers: a.pastPapers + c.pastPapers,
      hasTuition: a.hasTuition || c.hasTuition,
    }), { ...EMPTY_COVERAGE });

  // ── levels → scopes → boards → courses ────────────────────────────────────
  const levels: LevelNode[] = LEVELS.map((level) => {
    const scopes: ScopeNode[] = QUALIFICATION_SCOPES.map((scope) => {
      const pathway = SCOPE_PATHWAY[level][scope];
      const mine = rows.filter((r) => r.pathway === pathway && r.curricula?.slug);

      // group by curriculum — a board's answer is the sum of its courses
      const byCurriculum = new Map<string, { name: string; rows: Row[] }>();
      for (const r of mine) {
        const slug = r.curricula!.slug;
        const e = byCurriculum.get(slug) ?? { name: r.curricula!.name, rows: [] };
        e.rows.push(r);
        byCurriculum.set(slug, e);
      }

      const boards: BoardNode[] = [];
      for (const [curriculumSlug, e] of byCurriculum) {
        const courseNodes = e.rows.map(nodeFor);
        const counts = sum(courseNodes.map((c) => c.counts));
        const support = boardSupport({ curriculumSlug, curriculumName: e.name, counts });
        // ⚠ null means the curriculum maps to no board (ib, ap) — those do not
        // belong in a "which exam board?" step, so they are dropped here and
        // picked up by the `other` pass below.
        if (!support) continue;
        boards.push({
          ...support,
          courses: courseNodes.sort(
            (a, b) => b.counts.liveLessons - a.counts.liveLessons || a.name.localeCompare(b.name),
          ),
        });
      }

      return {
        scope,
        name: qualificationName(level, scope),
        pathway,
        boards: orderBoards(boards) as BoardNode[],
      };
    }).filter((s) => s.boards.length > 0);

    return {
      level,
      name: LEVEL_COPY[level].name,
      subtitle: LEVEL_COPY[level].subtitle,
      scopes,
      status: strongestStatus(scopes.flatMap((s) => s.boards)),
    };
  }).filter((l) => l.scopes.length > 0);

  // ── everything that is not a GCSE or an A-Level (§2) ──────────────────────
  const levelPathways = new Set<string>(LEVELS.flatMap((l) => [...LEVEL_PATHWAYS[l]]));
  const other: OtherQualificationNode[] = [];
  for (const r of rows) {
    if (!r.pathway || levelPathways.has(r.pathway)) continue;
    const pathway = r.pathway as Pathway;
    const copy = PATHWAY_COPY[pathway];
    if (!copy) continue;
    let node = other.find((o) => o.pathway === pathway);
    if (!node) {
      node = { pathway, name: copy.name, courses: [], status: "coming_soon" };
      other.push(node);
    }
    node.courses.push(nodeFor(r));
  }
  for (const o of other) {
    o.courses.sort((a, b) => a.name.localeCompare(b.name));
    o.status = strongestStatus(o.courses);
  }
  other.sort((a, b) => a.name.localeCompare(b.name));

  return { subject: subjectSlug, levels, other, error: null };
}

// ── what a subject actually holds, for the Resources index (§4) ─────────────


/**
 * One read for several subjects, so the Resources index can say what it has.
 *
 * ============================================================================
 * ⚠ WRITTEN TO KILL A LABEL THAT SAID "REGISTER INTEREST" IN A LIBRARY
 * ============================================================================
 * /resources reused SubjectCard, which renders the subject's TUITION status —
 * `interest` → "Register interest". On the homepage that is correct, because
 * the card leads to an interest form. On /resources the card opens
 * /resources/biology, so the eyebrow promised an action the card does not
 * perform, and it understated the truth twice over: Biology carries ~90 live
 * past papers, which is a real library, not an empty shelf awaiting demand.
 *
 * A study library should say what is ON it. So this counts.
 *
 * ⚠ ONE QUERY SET FOR ALL SUBJECTS, NOT ONE PER CARD. Calling loadSubjectTree
 * three times to draw three cards would be twelve round trips for two numbers.
 */
export async function loadSubjectHoldings(
  subjectSlugs: readonly string[],
): Promise<Record<string, SubjectHoldings>> {
  const empty = (error: string | null): Record<string, SubjectHoldings> =>
    Object.fromEntries(subjectSlugs.map((s) => [s, { liveLessons: 0, pastPapers: 0, error }]));

  const db = await createClient();
  const { data: subjects, error: sErr } = await db
    .from("subjects").select("id, slug").in("slug", [...subjectSlugs]);
  if (sErr) return empty(`subject lookup failed: ${sErr.message}`);
  if (!subjects?.length) return empty(null);

  const subjectOf = new Map<string, string>(subjects.map((s) => [s.id as string, s.slug as string]));

  const { data: courses, error: cErr } = await db
    .from("courses").select("id, subject_id").in("subject_id", [...subjectOf.keys()]);
  if (cErr) return empty(`course lookup failed: ${cErr.message}`);
  if (!courses?.length) return empty(null);

  const courseSubject = new Map<string, string>();
  for (const c of courses) {
    const slug = subjectOf.get(c.subject_id as string);
    if (slug) courseSubject.set(c.id as string, slug);
  }
  const ids = [...courseSubject.keys()];

  const [lessonsRes, papersRes] = await Promise.all([
    db.from("lessons").select("course_id").in("course_id", ids).eq("status", "live"),
    db.from("past_papers").select("course_id").in("course_id", ids),
  ]);
  // ⚠ A FAILURE IS REPORTED, NOT COUNTED AS ZERO. "0 past papers" and "we
  // could not ask" are different sentences, and only one of them is true.
  if (lessonsRes.error) return empty(`lesson counts failed: ${lessonsRes.error.message}`);
  if (papersRes.error) return empty(`past paper counts failed: ${papersRes.error.message}`);

  const out = empty(null);
  for (const l of lessonsRes.data ?? []) {
    const s = courseSubject.get(l.course_id as string);
    if (s && out[s]) out[s].liveLessons += 1;
  }
  for (const p of papersRes.data ?? []) {
    const s = courseSubject.get(p.course_id as string);
    if (s && out[s]) out[s].pastPapers += 1;
  }
  return out;
}

