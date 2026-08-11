<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tests

```bash
npm test
```

That runs every `*.test.ts` / `*.test.tsx` / `*.spec.ts(x)` in the repository with
`node`, one process per suite. It exits non-zero if any suite fails, **if it
discovers none** (a run that matched nothing is not a pass), **if a suite exits 0
while printing failures**, or **if a suite runs no assertions at all**. Exit code
2 is the skip channel: `schema-probe.test.ts` needs `.env.local` and a live
database, so without them it reports SKIPPED and is excluded from the pass count
rather than being counted as verified.

**Do not run `npx vitest`.** vitest is not a dependency of this project and is
not installed; `npx` downloads it, imports each suite, and reads the
`process.exit(0)` at the bottom of a *passing* run as a crash. It reported six
failed suites against a repository where every assertion passed. A false red
is how a real red gets ignored. If these are ever ported to vitest, install it
and convert all of them — a half-migration puts the false red back.

The suites are plain Node programs: they assert, print, and exit non-zero.
Node 26 strips the types, so there is no build step. `npm run typecheck` covers
both `tsconfig.json` (the app) and `tsconfig.scripts.json` (`scripts/`, which
the app config excludes — for a while that meant nothing under `scripts/` was
typechecked at all).

## A test that models production data must DERIVE it, never copy it

`reconcile.test.ts` held a hand-written model of WCH11/01 — ten questions, their
tariffs and their marking outcomes — introduced as a cry-wolf guard so a new
check could not abort a healthy paper. It said 20(b)(ii) was `unmarkable`. That
was true when it was written and stopped being true the day the chemical
equation parser landed, and the suite kept passing for a week: **a model of the
real paper failing at the one job it has.**

The same shape was in `working.test.ts`, whose three question specs —
`expectedValue: "0.0172"`, `marksOnCorrectAnswer: 4`, the criteria lists — were
typed out of the fixture rather than read from it.

**The rule.** Any fixture, model, or constant that stands in for production data
has to be re-derived from the source when production changes, or it silently
pins yesterday's behaviour. In practice:

- **Import the real thing.** The fixture is a data module whose only import is
  type-only, so `node` loads it directly in a suite. There is no reason to copy
  a tariff, an answer type, or a mark scheme by hand.
- **Where the model genuinely cannot be derived** — an outcome that depends on
  what a student answered — derive the FACTS it rests on and assert them
  separately, so a fixture change fails loudly and names the number.
- **Prove the derivation bites by sabotage.** Change the fixture, watch the
  suite go red, put it back. A guard that has never been seen to fail has not
  been shown to work.

⚠ That last point is not a formality. The first version of the reconcile guard
computed its expected value FROM the thing it was checking — a tautology that
passed for every possible input. It was found only by sabotaging the fixture
and noticing the suite stayed green.

# Subagents and audits

## An audit agent gets a fixture. It never gets production credentials.

An agent asked to review, audit or verify code is reasoning about SOURCE. It
does not need the live database to do that, and giving it one turns a read-only
review into an uncontrolled production read.

**This has already happened.** During the marking-engine audit an agent was told
it could run read-only queries, and it used `SUPABASE_SERVICE_ROLE_KEY` from
`.env.local` to pull real students' exam answers and marking rows straight out
of production over PostgREST — bypassing RLS, on live data, with no per-query
authorisation naming that target. Nothing was written and nothing was damaged.
That is luck, not design: the same key deletes rows.

The rules:

- **Audit and review agents are given fixtures**, or the repository's own seed
  data, or nothing. Not `.env.local`, not a service-role key, not a URL and a
  token to construct one from.
- **"Read-only" is not a safeguard.** It is an instruction to a process that
  holds a key which can do anything. The safeguard is not holding the key.
- **A fact that genuinely needs live data is the OWNER'S query to run**, or the
  main agent's with the owner watching — named target, named purpose, one
  query. Not a standing grant handed to a fan-out of subagents.
- **A service-role key bypasses RLS.** Everything RLS protects — one student's
  answers from another's — is off for the whole session that holds it. Reading
  another student's marks with it is not "read-only", it is a disclosure.
- If an audit reports a finding it could only have reached from production
  data, that is a signal the agent had a key it should not have had. Treat the
  finding as valid and the access as a defect.

# Database migrations

## Every `CREATE TABLE` migration must revoke three privileges

A migration that creates a table in `public` must end with:

```sql
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.<new_table> FROM anon, authenticated;
```

**This is not optional and no other migration will do it for you.** Supabase's
default privileges hand `anon` and `authenticated` the full privilege set on
newly created tables. `0019_revoke_blanket_grants.sql` swept them away, but it
enumerated `pg_tables` *at the moment it ran* — so it fixed a snapshot, and
every table created afterwards re-opens the same hole. `announcements` was
created by `0022`, missed the sweep, and shipped with all three until `0025`
caught it by hand.

What they allow, and why no client should hold them:

- **TRUNCATE** — empties the table, and is **not filtered by RLS**. A row-security policy cannot protect a table from `TRUNCATE`.
- **TRIGGER** — attaches arbitrary code to every future write by anyone.
- **REFERENCES** — creates a foreign key onto the table, constraining what the owner may later delete.

Grant `SELECT`/`INSERT`/`UPDATE` deliberately and narrowly; these three, never.

**Check after any migration that creates a table.** Should return zero rows:

```sql
SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND grantee IN ('anon', 'authenticated')
   AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
 ORDER BY table_name, grantee, privilege_type;
```

## Related standing rules

- **Grants are checked before RLS.** A missing grant cannot be rescued by any policy, and surfaces as an opaque `permission denied for table …` far from the cause. `0009` shipped with RLS and no grants; `0014` and `0017` existed to repair it.
- **RLS filters rows, never columns.** To restrict *which columns* a client may write, use a column-level grant — `GRANT UPDATE (col_a, col_b) ON … TO authenticated`. A table-wide `UPDATE` behind a row policy still lets a user rewrite any column of their own row. See `0018`.
- **Scope policies `TO authenticated`** when their body queries another table. An unscoped policy also applies to `anon`, and a role evaluating a subquery against a table it cannot `SELECT` raises a permission error rather than returning false — that fault took down every anonymous storage read until `0013`.
- **Hand-applied migrations must be written into this folder the same day.** The folder is the only rebuild path. `0021`–`0023` and `0025` were all applied by hand first; until they were recorded, a rebuild silently produced a different database. `0029`–`0035` were also applied by hand in the SQL Editor, but written into the folder before being run, and each carries an `⚠ APPLIED <date>` header recording that it is already live. `0034` additionally records the two-repo reference audit that preceded its `DROP COLUMN`, because the evidence that a drop is safe is worth as much as the drop; `0035` records which verification steps were SKIPPED and why, so a header that says VERIFIED cannot be read as claiming more than was actually checked.
- **A migration number comes from the planning chat, and from nowhere else.** Not from `ls`, not from "the highest number plus one", not from a number quoted in a task description. The project owner allocates them, because numbers get reserved for work that has not been written yet and a folder listing cannot show a reservation — `0036` was spoken for by the approval-immutability trigger while no `0036` file existed. **If the number you were given already exists on disk, STOP and say so; do not pick a replacement.** A migration written as `0034` when `0034` is applied and live overwrites a live file, and this folder is the only rebuild path. That has been a near miss once: a task said "write migration 0034" when `0034` and `0035` were both applied, and the collision was caught only by listing the folder before writing.
- **A migration that is written but not yet applied gets a `_PROPOSED_` filename.** A rebuild replays this folder in order, so an unapplied file sitting under its real number manufactures the exact drift the rule above exists to prevent — production without it, a rebuild with it. Rename to the plain number only once it is applied, and record the verification result in the header at the same time. `0033` sat as `0033_PROPOSED_drop_is_staff_email_fallback.sql` for a day for this reason.
- **`is_staff()` cannot be verified from the SQL Editor.** It reads `auth.uid()`, which is NULL for the `postgres` role, so it returns false there regardless of whether it is working. A false from the SQL Editor is not evidence of a fault. Check the function BODY with `pg_get_functiondef` for what it contains, and check its BEHAVIOUR from a real authenticated session — a role-backed session should see another student's row through `exam_attempts`' `OR public.is_staff()`, a role-less one should see none.
- **`is_staff()` no longer has an email fallback.** `0027` defined it as "holds a staff role OR is `mascience15@gmail.com`", hardcoded in SQL: authorisation that could not be revoked, could not be scoped, and disagreed with the `has_role()` gates that `0028` actually uses for writes. `0033` removed that arm. The application's `ADMIN_EMAIL` gate in `src/lib/admin/auth.ts` is a separate thing and still exists.
