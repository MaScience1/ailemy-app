/**
 * IAL AS Biology question-mapping fixture validator — DRY-RUN ONLY, writes
 * nothing.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/spec-extract/validate-wbi-as-mapping.ts <fixture.json>
 *
 * ============================================================================
 * ⚠ PREPARATION FOR THE FUTURE QUESTION BANK MAPPING PHASE — NOT A MAPPER
 * ============================================================================
 * The IAL sibling of validate-4bi1-mapping.ts. It validates a hand-authored
 * mapping fixture BEFORE any mapping row is ever proposed for
 * question_spec_points. It talks to no database, needs no credentials, and
 * its authority is the committed official extraction (wbi-as-issue2.json) —
 * the same artefact seed 012's 80 points were generated from. Academic
 * judgement (WHICH spec point a question assesses) stays human; this tool
 * only refuses fixtures that are mechanically wrong:
 *
 *   - a spec code that does not exist in the official AS specification
 *   - a malformed code shape (IAL AS Biology codes are T.N, topics 1-4,
 *     no letter suffix — 1.5C / 2.5B / 1.2P shapes belong to other courses)
 *   - an A2 code (topics 5-8): AS papers never assess IA2 content, and this
 *     branch holds no A2 vocabulary at all
 *   - a duplicate (question, code) pair — 0035's UNIQUE would reject it
 *     later, at apply time, which is the wrong time to find out
 *   - ⚠ a CROSS-UNIT mapping on a content paper. The official structure
 *     (spec pp.6-7): WBI11 assesses Topics 1-2, WBI12 assesses Topics 3-4.
 *     A WBI11 question mapped to a Topic 3/4 code contradicts the document
 *     itself and is ALWAYS a mistake, whatever the marker thought they saw.
 *     WBI13 (Practical Skills in Biology I) is the deliberate exception:
 *     it "will assess students' knowledge and understanding of experimental
 *     procedures and techniques that were developed in Units 1 and 2"
 *     (spec p.25), so ANY Topic 1-4 code is legitimate there — the practical
 *     paper resolves through the same AS vocabulary, never a fabricated
 *     Unit 3 syllabus (owner decision 3).
 *   - a fixture aimed at any course but edexcel-ial-as-biology
 *
 * Fixture shape (see wbi-as-mapping-fixture.example.json):
 *   {
 *     "course": "edexcel-ial-as-biology",
 *     "paper": { "code": "WBI11"|"WBI12"|"WBI13", "session": "0119" },
 *     "mappings": [ { "questionNumber": "1(a)", "specCodes": ["1.1", "2.6"] } ]
 *   }
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export type MappingFixture = {
  course: string;
  paper: { code: string; session: string };
  mappings: { questionNumber: string; specCodes: string[]; note?: string }[];
};

const CODE_SHAPE = /^[1-4]\.\d{1,2}$/;
const PAPER_SHAPE = /^WBI1[123]$/;
// The archive names sittings MMYY with MM ∈ 01 (January), 06 (May-June),
// 10/11 (October-November) — bulk-import-papers.ts's own month map.
const SESSION_SHAPE = /^(01|06|10|11)\d{2}$/;

/** The official paper → topics map (spec pp.6-7). WBI13 is the practical
 *  paper: it assesses Units 1-2's practicals through the whole AS
 *  vocabulary, so it accepts every AS topic. */
export const TOPICS_OF_PAPER: Record<string, ReadonlySet<number>> = {
  WBI11: new Set([1, 2]),
  WBI12: new Set([3, 4]),
  WBI13: new Set([1, 2, 3, 4]),
};

/** Ambiguity threshold: a question mapped to more codes than this is not
 *  invalid (multi-point questions are intentional and common), but it is
 *  worth a human's second look before it ever becomes rows. */
export const AMBIGUITY_THRESHOLD = 4;

/** Non-fatal review flags. Pure, same contract as validateMappingFixture. */
export function warnMappingFixture(fixture: MappingFixture): string[] {
  const warnings: string[] = [];
  for (const m of fixture.mappings ?? []) {
    if ((m.specCodes?.length ?? 0) > AMBIGUITY_THRESHOLD) {
      warnings.push(
        `${m.questionNumber}: mapped to ${m.specCodes.length} codes (> ${AMBIGUITY_THRESHOLD}) — ` +
        "possibly ambiguous; confirm each code is genuinely assessed, not merely related",
      );
    }
  }
  return warnings;
}

/** Validate one fixture against the official extraction. Returns problem
 *  strings; an empty array is a pass. Pure — no I/O, so tests can feed it
 *  synthetic fixtures and synthetic code sets.
 *
 *  Ordering contract: the fixture's specCodes array order IS the intended
 *  question_spec_points.display_order (0-based) for that question — 0035
 *  stores display_order per (question, code) row, and the future apply
 *  tooling must write it from array position, never resort it. */
export function validateMappingFixture(
  fixture: MappingFixture,
  officialCodes: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  if (fixture.course !== "edexcel-ial-as-biology") {
    problems.push(`course is ${JSON.stringify(fixture.course)} — this validator only accepts edexcel-ial-as-biology`);
  }
  if (!PAPER_SHAPE.test(fixture.paper?.code ?? "")) {
    problems.push(`paper.code is ${JSON.stringify(fixture.paper?.code)} — expected WBI11, WBI12 or WBI13 (WBI14-16 are IA2 and out of AS scope)`);
  }
  if (!SESSION_SHAPE.test(fixture.paper?.session ?? "")) {
    problems.push(`paper.session ${JSON.stringify(fixture.paper?.session)} does not look like MMYY (01/06/10/11 + year)`);
  }
  if (!Array.isArray(fixture.mappings) || fixture.mappings.length === 0) {
    problems.push("mappings is empty — an empty fixture maps nothing and should not exist");
    return problems;
  }

  const allowedTopics = TOPICS_OF_PAPER[fixture.paper?.code ?? ""] ?? null;
  const seen = new Set<string>();
  for (const m of fixture.mappings) {
    if (!m.questionNumber?.trim()) {
      problems.push("a mapping has a blank questionNumber");
      continue;
    }
    if (!Array.isArray(m.specCodes) || m.specCodes.length === 0) {
      problems.push(`${m.questionNumber}: no specCodes — either map it or leave the question out`);
      continue;
    }
    for (const code of m.specCodes) {
      const key = `${m.questionNumber}|${code}`;
      if (seen.has(key)) {
        problems.push(`${m.questionNumber}: duplicate mapping to ${code} (0035's UNIQUE (question_id, spec_code) would refuse this at apply time)`);
      }
      seen.add(key);
      if (/^[5-8]\.\d{1,2}$/.test(code)) {
        problems.push(`${m.questionNumber}: code ${code} is IA2 content (Topics 5-8) — AS papers never assess it, and this branch holds no A2 vocabulary`);
        continue;
      }
      if (!CODE_SHAPE.test(code)) {
        problems.push(`${m.questionNumber}: malformed code ${JSON.stringify(code)} (IAL AS Biology codes are T.N, topics 1-4, no letter suffix)`);
        continue;
      }
      if (!officialCodes.has(code)) {
        problems.push(`${m.questionNumber}: code ${code} is not in the official IAL AS Biology specification (80 codes)`);
      }
      const topic = Number(code.split(".")[0]);
      if (allowedTopics && !allowedTopics.has(topic)) {
        problems.push(
          `${m.questionNumber}: Topic ${topic} code ${code} mapped on ${fixture.paper.code} — ` +
          `${fixture.paper.code} assesses Topics ${[...allowedTopics].join("-")} only (spec pp.6-7); this mapping contradicts the official document`,
        );
      }
    }
  }
  return problems;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: validate-wbi-as-mapping.ts <fixture.json>");
    process.exit(2);
  }
  const fixture: MappingFixture = JSON.parse(readFileSync(path, "utf8"));
  const extraction = JSON.parse(readFileSync(join(HERE, "wbi-as-issue2.json"), "utf8")) as {
    points: { code: string }[];
  };
  const officialCodes = new Set(extraction.points.map((p) => p.code));

  const problems = validateMappingFixture(fixture, officialCodes);
  const warnings = warnMappingFixture(fixture);
  const pairs = fixture.mappings?.reduce((n, m) => n + (m.specCodes?.length ?? 0), 0) ?? 0;
  for (const w of warnings) console.log("  ⚠ review: " + w);
  if (problems.length === 0) {
    console.log(`OK — ${fixture.paper.code} ${fixture.paper.session}: ` +
      `${fixture.mappings.length} questions, ${pairs} (question, code) pairs, all mechanically valid` +
      (warnings.length ? ` (${warnings.length} review flag(s) above)` : "") + ". " +
      "Nothing was written; applying mappings is a later, owner-gated phase.");
    process.exit(0);
  }
  console.error(`${problems.length} problem(s):`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
