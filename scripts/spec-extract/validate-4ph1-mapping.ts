/**
 * 4PH1 question-mapping fixture validator — DRY-RUN ONLY, writes nothing.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/spec-extract/validate-4ph1-mapping.ts <fixture.json>
 *
 * ============================================================================
 * ⚠ PREPARATION FOR THE FUTURE QUESTION BANK MAPPING PHASE — NOT A MAPPER
 * ============================================================================
 * This tool validates a hand-authored mapping fixture BEFORE any mapping row
 * is ever proposed for question_spec_points. It talks to no database, needs
 * no credentials, and its authority is the committed official extraction
 * (4ph1-issue4.json) — the same artefact production's 195 points are seeded
 * from. Academic judgement (WHICH spec point a question assesses) stays
 * human; this tool only refuses fixtures that are mechanically wrong:
 *
 *   - a spec code that does not exist in the official 4PH1 specification
 *   - a malformed code shape
 *   - a duplicate (question, code) pair — 0035's UNIQUE would reject it
 *     later, at apply time, which is the wrong time to find out
 *   - ⚠ a P-suffix (Paper 2-only) code mapped onto a PAPER 1 question.
 *     The official rule (spec pp.1, 8-9): Paper 1 "assesses core content
 *     that is not in bold and does not have a 'P' reference". A Paper 1
 *     question mapped to a P-only point contradicts the document itself and
 *     is ALWAYS a mistake, whatever the marker thought they saw.
 *   - a fixture aimed at any course but edexcel-igcse-physics
 *
 * The 4BI1 sibling (validate-4bi1-mapping.ts) is deliberately left
 * untouched — Service 2 already consumes its contract; this file is the
 * additive Physics counterpart, byte-parallel where semantics allow.
 *
 * Fixture shape (see 4ph1-mapping-fixture.example.json):
 *   {
 *     "course": "edexcel-igcse-physics",
 *     "paper": { "code": "4PH1", "component": "1P"|"1PR"|"2P"|"2PR", "session": "0619" },
 *     "mappings": [ { "questionNumber": "1(a)", "specCodes": ["1.1", "1.25P"] } ]
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

const CODE_SHAPE = /^[1-8]\.\d{1,2}P?$/;
const COMPONENT_SHAPE = /^[12]PR?$/;
const SESSION_SHAPE = /^(0[16]|11)\d{2}$/; // 01/06/11 + 2-digit year, the archive's naming

/** Ambiguity threshold: a question mapped to more codes than this is not
 *  invalid (multi-point questions are intentional and common — a Physics
 *  calculation often assesses a relationship plus its units), but it is
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
  if (fixture.course !== "edexcel-igcse-physics") {
    problems.push(`course is ${JSON.stringify(fixture.course)} — this validator only accepts edexcel-igcse-physics`);
  }
  if (fixture.paper?.code !== "4PH1") {
    problems.push(`paper.code is ${JSON.stringify(fixture.paper?.code)} — expected 4PH1`);
  }
  if (!COMPONENT_SHAPE.test(fixture.paper?.component ?? "")) {
    problems.push(`paper.component ${JSON.stringify(fixture.paper?.component)} is not one of 1P/1PR/2P/2PR`);
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
        problems.push(`${m.questionNumber}: code ${code} is not in the official 4PH1 specification (195 codes)`);
      }
      if (isPaper1 && code.endsWith("P")) {
        problems.push(
          `${m.questionNumber}: P-suffix code ${code} mapped on Paper ${fixture.paper.component} — ` +
          "Paper 1 assesses only non-P content (spec pp.1, 8-9); this mapping contradicts the official document",
        );
      }
    }
  }
  return problems;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: validate-4ph1-mapping.ts <fixture.json>");
    process.exit(2);
  }
  const fixture: MappingFixture = JSON.parse(readFileSync(path, "utf8"));
  const extraction = JSON.parse(readFileSync(join(HERE, "4ph1-issue4.json"), "utf8")) as {
    points: { code: string }[];
  };
  const officialCodes = new Set(extraction.points.map((p) => p.code));

  const problems = validateMappingFixture(fixture, officialCodes);
  const warnings = warnMappingFixture(fixture);
  const pairs = fixture.mappings?.reduce((n, m) => n + (m.specCodes?.length ?? 0), 0) ?? 0;
  for (const w of warnings) console.log("  ⚠ review: " + w);
  if (problems.length === 0) {
    console.log(`OK — ${fixture.paper.code} ${fixture.paper.component} ${fixture.paper.session}: ` +
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
