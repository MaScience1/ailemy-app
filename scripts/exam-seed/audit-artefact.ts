/**
 * Print the misfiled-line audit for a proposal set. READ-ONLY.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/audit-artefact.ts <slug>
 *
 * ⚠ IT OPENS THE ARTEFACT AND NEVER WRITES IT. The whole point is a list a
 * person acts on; a script that "fixed" what it found would be the extractor's
 * mistake repeated one level up.
 */
import { readFileSync } from "node:fs";
import { auditArtefact } from "../../src/lib/exam/artefact-audit.ts";

const slug = process.argv[2] ?? "unit-1-may-june-2025";
const path = `scripts/exam-seed/proposals/${slug}.markscheme.json`;
const set = JSON.parse(readFileSync(path, "utf8")) as {
  questions: Parameters<typeof auditArtefact>[0];
};

const report = auditArtefact(set.questions);

console.log(`ARTEFACT AUDIT — ${slug}`);
console.log(`${set.questions.length} blocks · ${report.findings.length} finding(s) across ${report.byQuestion.length} question(s)\n`);

for (const q of report.byQuestion) {
  console.log(`── ${q.questionNumber}  (${q.count})`);
  for (const f of report.findings.filter((x) => x.questionNumber === q.questionNumber)) {
    console.log(`     [${f.cls}] in ${f.bucket}`);
    console.log(`     ${JSON.stringify(f.text)}`);
    console.log(`     ${f.why}`);
  }
  console.log();
}

const byClass: Record<string, number> = {};
for (const f of report.findings) byClass[f.cls] = (byClass[f.cls] ?? 0) + 1;
console.log("by class:");
for (const [k, v] of Object.entries(byClass).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(3)}  ${k}`);
}
