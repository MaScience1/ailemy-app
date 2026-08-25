/**
 * ERASE_USER v6 — FIVE COPIES, ONE FUNCTION.
 *
 * ============================================================================
 * ⚠ WHY FIVE COPIES EXIST AT ALL, AND WHAT MAKES THAT SAFE.
 * ============================================================================
 * Each of the five parked migrations must be independently applicable — none
 * may assume the other four have run. A Postgres function has exactly one
 * definition, so five files carrying DIFFERENT v6 bodies would overwrite one
 * another and whichever applied last would silently erase the other four's
 * coverage. The answer is that all five carry the SAME body, with every
 * per-table block guarded by to_regclass.
 *
 * That safety rests entirely on the five staying identical, and nothing about
 * five separate files makes them stay identical. This suite is what does.
 *
 * ⚠ IT ASSERTS ON EXECUTABLE LINES, NEVER ON THE FILE TEXT. Every one of these
 * files talks about erase_user in prose, and it was prose that let all five
 * ship "an erase_user extension" while shipping no DDL. Comments are stripped
 * before anything is counted.
 */
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

/**
 * ⚠ BOTH COMMENT FORMS STRIPPED — `--` to end of line AND block comments.
 * The first draft of this suite stripped only `--`, and the plpgsql body is
 * documented with block comments that themselves say "DELETE FROM auth.users".
 * It counted those and reported a defect that did not exist. Stripping one
 * comment syntax and calling it code is the same mistake this file exists to
 * catch, one level up.
 */
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*--[^\n]*$/gm, "")
  .replace(/\n{2,}/g, "\n");

const FILES = [
  "supabase/migrations/_PROPOSED_tuition_subject_interest.sql",
  "supabase/migrations/_PROPOSED_stripe_purchases.sql",
  "supabase/migrations/PROPOSED_lesson_sections_and_content.sql",
  "supabase/migrations/PROPOSED_qualification_architecture.sql",
  "supabase/migrations/PROPOSED_resources_hub.sql",
];

/** The function body, from its CREATE to its terminator. */
function fnOf(path: string): string {
  const s = readFileSync(path, "utf8");
  const i = s.indexOf("CREATE OR REPLACE FUNCTION public.erase_user");
  if (i < 0) return "";
  const j = s.indexOf("$$;", i);
  return j < 0 ? "" : code(s.slice(i, j + 3));
}

console.log("\n=== 1. every parked file ships EXECUTABLE erase_user DDL ===");
{
  for (const f of FILES) {
    const body = fnOf(f);
    const name = f.split("/").pop();
    t(`${name} defines erase_user in code, not prose`, body.length > 0);
    /**
     * ⚠ THE TEST THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. Before this work
     * every one of these files mentioned erase_user in comments and none
     * contained a single executable reference.
     */
    const execRefs = (code(readFileSync(f, "utf8")).match(/erase_user/g) ?? []).length;
    t(`${name} has ≥1 executable erase_user reference`, execRefs >= 1, `${execRefs}`);
  }
}

console.log("\n=== 2. THE PARITY INVARIANT — the five bodies are identical ===");
{
  const bodies = FILES.map(fnOf);
  const first = bodies[0];
  t("the reference body is non-empty (else parity is vacuous)", first.length > 200, `${first.length} chars`);
  const drifted = FILES.filter((_, i) => bodies[i] !== first).map((f) => f.split("/").pop());
  t("⚠ all five erase_user bodies are byte-identical after comment-stripping",
    drifted.length === 0, drifted.join(", "));
}

console.log("\n=== 3. every guarded table is actually guarded ===");
{
  const body = fnOf(FILES[0]);
  /**
   * ⚠ EACH TABLE THE FIVE FILES INTRODUCE MUST BE BEHIND to_regclass. An
   * unguarded reference makes the function fail on a database where that
   * parked file has not been applied — which is every database today.
   */
  const TABLES = [
    "lesson_section_state", "student_deck_progress", "student_saved_cards",
    "student_subject_qualification", "student_saved_resources",
    "student_recent_resources", "stripe_purchases",
  ];
  for (const tbl of TABLES) {
    t(`${tbl} is referenced only behind to_regclass`,
      body.includes(`to_regclass('public.${tbl}')`) && body.includes(tbl));
  }
  t("the guard count matches the table count",
    (body.match(/to_regclass\(/g) ?? []).length === TABLES.length,
    `${(body.match(/to_regclass\(/g) ?? []).length} guards for ${TABLES.length} tables`);
}

console.log("\n=== 4. interest_registrations — both arms, not one ===");
{
  const body = fnOf(FILES[0]);
  /**
   * ⚠ THE EMAIL ARM ALREADY EXISTED AND MUST SURVIVE. It is what reaches the
   * anonymous rows the funnel writes with no account at all. Losing it while
   * "adding user_id support" would silently stop erasing exactly the people
   * who never signed up.
   */
  t("⚠ the email arm survives — it is what erases account-less leads",
    /DELETE FROM public\.interest_registrations WHERE lower\(email\) = lower\(target_email\)/.test(body));
  t("⚠ and a user_id arm was added, for rows whose email is somebody else's",
    /interest_registrations WHERE user_id = \$1/.test(body));
  t("the user_id arm is behind a column-existence check, not assumed",
    /information_schema\.columns/.test(body) && /column_name\s*=\s*'user_id'/.test(body));
  t("both arms feed one receipt total",
    /interest_removed := interest_removed \+ interest_by_user/.test(body));
}

console.log("\n=== 5. the v5 guarantees are carried forward, not bypassed ===");
{
  const body = fnOf(FILES[0]);
  /** ⚠ THE STAFF REFUSAL. v5 exists because an erasure took out the admin. */
  t("⚠ the staff refusal is preserved", /staff_roles/.test(body) && /RAISE\s+EXCEPTION/.test(body));
  t("⚠ the email residue sweep is preserved", /information_schema\.columns/.test(body) && /residue/.test(body));
  t("⚠ the sweep still drives email_columns_scanned from the catalogue, not a literal",
    /cols_scanned := cols_scanned \+ 1/.test(body) && /'email_columns_scanned', cols_scanned/.test(body));
  t("the auth.users delete still happens exactly once",
    (body.match(/DELETE FROM auth\.users/g) ?? []).length === 1);
}

console.log("\n=== 6. email_columns_scanned must still read 8 ===");
{
  /**
   * ⚠ DERIVED, NOT ASSERTED FROM MEMORY. The live gate counts text columns in
   * `public` named email or %_email. If any parked file added one, the number
   * moves and 0067's `<> 8` assertion fails on the next erasure.
   */
  /**
   * ⚠ THE FUNCTION BODY IS EXCLUDED, AND THAT IS NOT A CONVENIENCE. erase_user
   * DECLAREs plpgsql locals called `target_email` and `v_email`, which match
   * the very pattern the live gate uses to find COLUMNS. Counting those would
   * report every file as moving the gate — the first draft of this suite did
   * exactly that. Only the DDL section, before the function, can add a column.
   */
  const adds = FILES.filter((f) => {
    const raw = readFileSync(f, "utf8");
    const i = raw.indexOf("CREATE OR REPLACE FUNCTION public.erase_user");
    const ddl = code(i < 0 ? raw : raw.slice(0, i));
    return /^\s*[a-z_]*email[a-z_]*\s+(text|varchar)/im.test(ddl)
        || /add\s+column(\s+if\s+not\s+exists)?\s+[a-z_]*email[a-z_]*\s+(text|varchar)/i.test(ddl);
  }).map((f) => f.split("/").pop());
  t("⚠ no parked file adds an email/%_email text column — the gate stays 8",
    adds.length === 0, adds.join(", "));
}

console.log("\n=== 7. still parked — none of this has been numbered ===");
{
  for (const f of FILES) {
    const name = f.split("/").pop() ?? "";
    t(`${name} carries no migration number`, /^_?PROPOSED_/.test(name));
    t(`${name} says NOT APPLIED in its own header`, /NOT APPLIED/.test(readFileSync(f, "utf8")));
  }
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
