<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
- **Hand-applied migrations must be written into this folder the same day.** The folder is the only rebuild path. `0021`–`0023` and `0025` were all applied by hand first; until they were recorded, a rebuild silently produced a different database.
