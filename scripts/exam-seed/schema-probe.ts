import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Does this table/column actually exist?
 *
 * ============================================================================
 * WHY THIS IS A MODULE AND NOT THREE LINES INSIDE THE IMPORTER
 * ============================================================================
 * The importer's original guard was:
 *
 *   await db.from(table).select(column, { head: true, count: "exact" }).limit(0)
 *
 * That shape issues a HEAD request and DID NOT SURFACE PGRST205 — the guard
 * passed a table that did not exist, the seed then ran, and it failed
 * mid-write on the exact error the guard was written to prevent, leaving a
 * partially-seeded database and an un-undoable journal entry.
 *
 * So the probe now issues a real GET, and it lives here — importable, and
 * therefore testable against a table that is guaranteed not to exist. A guard
 * with no test is a guard nobody knows is broken.
 *
 * ============================================================================
 * THE CODES THAT MATTER
 * ============================================================================
 *   PGRST205  table not in PostgREST's schema cache — it does not exist, or
 *             the cache is stale after a migration. Either way: STOP.
 *   PGRST204  column not in the schema cache.
 *   42P01     undefined_table, raw from Postgres.
 *   42703     undefined_column, raw from Postgres.
 *   42501     insufficient_privilege — the table EXISTS and the role cannot
 *             read it. Distinct from missing, and reported as such: those two
 *             look identical to a careless caller and mean opposite things.
 */

export type ProbeResult =
  | { ok: true }
  | {
      ok: false;
      kind: "missing_table" | "missing_column" | "forbidden" | "other";
      code: string;
      message: string;
    };

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
const MISSING_COLUMN = new Set(["PGRST204", "42703"]);
const FORBIDDEN = new Set(["42501"]);

/**
 * A REAL GET, deliberately. `head: true` would make this fast and useless —
 * see the header. `.limit(1)` keeps it cheap without changing what it proves.
 */
export async function probeColumn(
  db: SupabaseClient,
  table: string,
  column: string,
): Promise<ProbeResult> {
  const { error } = await db.from(table).select(column).limit(1);
  if (!error) return { ok: true };

  const code = error.code ?? "";
  const kind = MISSING_TABLE.has(code)
    ? "missing_table"
    : MISSING_COLUMN.has(code)
      ? "missing_column"
      : FORBIDDEN.has(code)
        ? "forbidden"
        : "other";
  return { ok: false, kind, code: code || "(no code)", message: error.message };
}

export type RequiredColumn = { table: string; column: string; migration: string };

export type SchemaVerdict = {
  ok: boolean;
  /** One human line per failure, each quoting the PostgREST code. */
  failures: string[];
};

/**
 * Check every column a writer depends on, and report ALL failures rather than
 * the first — running a migration, re-running, and hitting the next missing
 * column is a worse loop than being told everything at once.
 */
export async function verifyRequiredColumns(
  db: SupabaseClient,
  required: RequiredColumn[],
): Promise<SchemaVerdict> {
  const failures: string[] = [];
  // A missing table produces one failure per column on it; collapse those so
  // the message names the table once.
  const reportedTables = new Set<string>();

  for (const { table, column, migration } of required) {
    const result = await probeColumn(db, table, column);
    if (result.ok) continue;

    if (result.kind === "missing_table") {
      if (reportedTables.has(table)) continue;
      reportedTables.add(table);
      failures.push(
        `TABLE ${table} does not exist (${result.code}: ${result.message}). Apply ${migration}.`,
      );
      continue;
    }
    if (result.kind === "missing_column") {
      failures.push(
        `${table}.${column} is missing (${result.code}: ${result.message}). Apply ${migration}.`,
      );
      continue;
    }
    if (result.kind === "forbidden") {
      failures.push(
        `${table} exists but this role cannot read it (${result.code}). This is a grant/RLS problem, NOT a missing migration.`,
      );
      continue;
    }
    failures.push(`${table}.${column} could not be verified (${result.code}: ${result.message}).`);
  }

  return { ok: failures.length === 0, failures };
}
