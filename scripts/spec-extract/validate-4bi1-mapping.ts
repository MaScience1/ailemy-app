/**
 * 4BI1 question-mapping fixture validator — DRY-RUN ONLY, writes nothing.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/spec-extract/validate-4bi1-mapping.ts <fixture.json>
 *
 * ============================================================================
 * ⚠ PREPARATION FOR THE FUTURE QUESTION BANK MAPPING PHASE — NOT A MAPPER
 * ============================================================================
 * This tool validates a hand-authored mapping fixture BEFORE any mapping row
 * is ever proposed for question_spec_points. It talks to no database, needs
 * no credentials, and its authority is the committed official extraction
 * (4bi1-issue3.json) — the same artefact production's 176 points were seeded
 * from. Academic judgement (WHICH spec point a question assesses) stays
 * human; this tool only refuses fixtures that are mechanically wrong:
 *
 *   - a spec code that does not exist in the official 4BI1 specification
 *   - a malformed code shape
 *   - a duplicate (question, code) pair — 0035's UNIQUE would reject it
 *     later, at apply time, which is the wrong time to find out
 *   - ⚠ a B-suffix (Paper 2-only) code mapped onto a PAPER 1 question.
 *     The official rule (spec pp.1, 7-8): Paper 1 "assesses core content
 *     that is not in bold and does not have a 'B' reference". A Paper 1
 *     question mapped to a B-only point contradicts the document itself and
 *     is ALWAYS a mistake, whatever the marker thought they saw.
 *   - a fixture aimed at any course but edexcel-igcse-biology
 *
 * Fixture shape (see 4bi1-mapping-fixture.example.json):
 *   {
 *     "course": "edexcel-igcse-biology",
 *     "paper": { "code": "4BI1", "component": "1B"|"1BR"|"2B"|"2BR", "session": "0619" },
 *     "mappings": [ { "questionNumber": "1(a)", "specCodes": ["1.1", "2.5B"] } ]
 *   }
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export type MappingFixture = {
  course: string;
  paper: { code: string; component: string; session: string };
  mappings: { questionNumber: string; specCodes: string[]; note?: string }[];
};

const CODE_SHAPE = /^[1-5]\.\d{1,2}B?$/;
const COMPONENT_SHAPE = /^[12]BR?$/;
const SESSION_SHAPE = /^(0[16]|11)\d{2}$/; // 01/06/11 + 2-digit year, the archive's naming

/** Validate one fixture against the official extraction. Returns problem
 *  strings; an empty array is a pass. Pure — no I/O, so tests can feed it
 *  synthetic fixtures and synthetic code sets. */
export function validateMappingFixture(
  fixture: MappingFixture,
  officialCodes: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  if (fixture.course !== "edexcel-igcse-biology") {
    problems.push(`course is ${JSON.stringify(fixture.course)} — this validator only accepts edexcel-igcse-biology`);
  }
  if (fixture.paper?.code !== "4BI1") {
    problems.push(`paper.code is ${JSON.stringify(fixture.paper?.code)} — expected 4BI1`);
  }
  if (!COMPONENT_SHAPE.test(fixture.paper?.component ?? "")) {
    problems.push(`paper.component ${JSON.stringify(fixture.paper?.component)} is not one of 1B/1BR/2B/2BR`);
  }
  if (!SESSION_SHAPE.test(fixture.paper?.session ?? "")) {
    problems.push(`paper.session ${JSON.stringify(fixture.paper?.session)} does not look like MMYY (01/06/11 + year)`);
  }
  if (!Array.isArray(fixture.mappings) || fixture.mappings.length === 0) {
    problems.push("mappings is empty — an empty fixture maps nothing and should not exist");
    return problems;
  }

  const isPaper1 = (fixture.paper?.component ?? "").startsWith("1");
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
      if (!CODE_SHAPE.test(code)) {
        problems.push(`${m.questionNumber}: malformed code ${JSON.stringify(code)}`);
        continue;
      }
      if (!officialCodes.has(code)) {
        problems.push(`${m.questionNumber}: code ${code} is not in the official 4BI1 specification (176 codes)`);
      }
      if (isPaper1 && code.endsWith("B")) {
        problems.push(
          `${m.questionNumber}: B-suffix code ${code} mapped on Paper ${fixture.paper.component} — ` +
          "Paper 1 assesses only non-B content (spec pp.1, 7-8); this mapping contradicts the official document",
        );
      }
    }
  }
  return problems;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: validate-4bi1-mapping.ts <fixture.json>");
    process.exit(2);
  }
  const fixture: MappingFixture = JSON.parse(readFileSync(path, "utf8"));
  const extraction = JSON.parse(readFileSync(join(HERE, "4bi1-issue3.json"), "utf8")) as {
    points: { code: string }[];
  };
  const officialCodes = new Set(extraction.points.map((p) => p.code));

  const problems = validateMappingFixture(fixture, officialCodes);
  const pairs = fixture.mappings?.reduce((n, m) => n + (m.specCodes?.length ?? 0), 0) ?? 0;
  if (problems.length === 0) {
    console.log(`OK — ${fixture.paper.code} ${fixture.paper.component} ${fixture.paper.session}: ` +
      `${fixture.mappings.length} questions, ${pairs} (question, code) pairs, all mechanically valid. ` +
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
