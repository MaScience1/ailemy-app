/**
 * The schema guard must trip on a table that does not exist.
 *
 * This test exists because the guard it replaced did NOT: the old probe used
 * `.select(col, {head:true, count:"exact"}).limit(0)`, which returned no error
 * for a missing table. The seed importer then ran against a database without
 * question_expected_answers, failed mid-write, and left an un-undoable journal
 * entry — the precise failure the guard was written to prevent.
 *
 * Needs the service-role key, because it asks the database real questions.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/schema-probe.test.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import { probeColumn, verifyRequiredColumns } from "../schema-probe.ts";

/**
 * ⚠ EXIT 2 MEANS SKIPPED, and run-tests.ts knows that.
 *
 * This is the only suite that needs credentials and a network, and `.env.local`
 * is gitignored. Left as-is it made `npm test` impossible to pass on a fresh
 * clone or in CI — an ENOENT rendered identically to a broken assertion, which
 * is the same false-red habit the runner was written to end. Crashing on a
 * missing file would be worse than useless here; so would passing, which would
 * report a schema guard as verified when it never ran.
 */
if (!existsSync(".env.local")) {
  console.log(
    "  SKIPPED — .env.local not found. This suite asks the live database real\n" +
      "  questions and needs SUPABASE_SERVICE_ROLE_KEY. Nothing was verified.",
  );
  process.exit(2);
}

const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  env.set(t.slice(0, i).trim(), v);
}

const db = createClient(
  env.get("NEXT_PUBLIC_SUPABASE_URL")!,
  env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let pass = 0;
let fail = 0;
const t = (name: string, cond: boolean, got?: unknown) => {
  if (cond) {
    pass++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.log("  ✗ " + name + (got !== undefined ? "  got: " + JSON.stringify(got) : ""));
  }
};

const NONEXISTENT = "table_that_does_not_exist_" + "aaaaaaaa";

console.log("── a table that does not exist MUST trip the guard ──");
{
  const r = await probeColumn(db, NONEXISTENT, "anything");
  t("probeColumn reports not-ok", r.ok === false, r);
  t("...classified missing_table", !r.ok && r.kind === "missing_table", r);
  t("...carries the PostgREST code", !r.ok && /PGRST205|42P01/.test(r.code), r);

  const v = await verifyRequiredColumns(db, [
    { table: NONEXISTENT, column: "anything", migration: "9999" },
  ]);
  t("verifyRequiredColumns fails", v.ok === false, v);
  t("...names the table", v.failures.some((f) => f.includes(NONEXISTENT)));
  t("...quotes the code", v.failures.some((f) => /PGRST205|42P01/.test(f)));
  t("...names the migration to apply", v.failures.some((f) => f.includes("9999")));
}

console.log("\n── a column that does not exist on a real table MUST trip it ──");
{
  const r = await probeColumn(db, "paper_questions", "column_that_does_not_exist_bbbb");
  t("reports not-ok", r.ok === false, r);
  t("...classified missing_column", !r.ok && r.kind === "missing_column", r);
}

console.log("\n── a table and column that DO exist must pass ──");
{
  const r = await probeColumn(db, "paper_questions", "question_number");
  t("paper_questions.question_number → ok", r.ok === true, r);
  const v = await verifyRequiredColumns(db, [
    { table: "paper_questions", column: "question_number", migration: "0028" },
    { table: "mark_scheme_items", column: "criterion", migration: "0028" },
  ]);
  t("verifyRequiredColumns passes on real columns", v.ok === true, v.failures);
}

console.log("\n── one failure per missing table, not one per column ──");
{
  const v = await verifyRequiredColumns(db, [
    { table: NONEXISTENT, column: "a", migration: "9999" },
    { table: NONEXISTENT, column: "b", migration: "9999" },
    { table: NONEXISTENT, column: "c", migration: "9999" },
  ]);
  t("three missing columns on one missing table → 1 message", v.failures.length === 1, v.failures);
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
