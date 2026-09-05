# IGCSE Biology (4BI1) — Service 3 Mastery: owner runbook & readiness

Written 2026-09-05 at the end of the autonomous deep-work session on
`feature/igcse-biology-mastery`. State at writing: seed **008 is APPLIED**
to production (22 topics / 176 points / 42 B-suffix, all `draft` +
`verified_at NULL`); seed **009 is written, tested and NOT applied**.

Authority for everything here: Pearson Edexcel International GCSE in Biology
(4BI1) Specification, **Issue 3**, © Pearson Education Limited 2024, pdf
sha256 `9f474a0ef0e93ef3c3107b568956d163454cdb476bb2017189e8dd12c0d58cef`.
Production course: slug `edexcel-igcse-biology`,
uuid `35702dec-b1b9-487f-b74e-2b99500af285`, status `live` (seeds target the
slug, never the uuid).

---

## 1. Owner runbook — applying seed 009 (the only remaining production step)

### 1a. PRE-APPLY check (read-only, one statement, one result table)

```sql
WITH
  bio   AS (SELECT id, slug, name, status FROM courses WHERE slug = 'edexcel-igcse-biology'),
  bio_t AS (SELECT t.id, t.unit_id FROM topics t WHERE t.course_id IN (SELECT id FROM bio)),
  bio_p AS (SELECT p.id, p.code, p.status, p.verified_at FROM spec_points p
             WHERE p.topic_id IN (SELECT id FROM bio_t)),
  chem  AS (SELECT id FROM courses WHERE slug = 'edexcel-igcse-chemistry'),
  chem_t AS (SELECT t.id FROM topics t WHERE t.course_id IN (SELECT id FROM chem)),
  chem_p AS (SELECT p.code, p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM chem_t)),
  ial   AS (SELECT id FROM courses WHERE slug = 'edexcel-ial-as-chemistry'),
  ial_t AS (SELECT t.id FROM topics t WHERE t.course_id IN (SELECT id FROM ial)),
  ial_p AS (SELECT p.status, p.verified_at FROM spec_points p
             WHERE p.topic_id IN (SELECT id FROM ial_t))
SELECT * FROM (
  SELECT 01 AS chk, 'biology course identity' AS check_name,
         (SELECT string_agg(id::text || ' · ' || status, ' | ') FROM bio) AS result,
         '35702dec-b1b9-487f-b74e-2b99500af285 · live' AS expected
  UNION ALL SELECT 02, 'biology topics',
         (SELECT count(*) FROM bio_t)::text, '22'
  UNION ALL SELECT 03, 'biology topics with unit_id set',
         (SELECT count(*) FROM bio_t WHERE unit_id IS NOT NULL)::text, '0'
  UNION ALL SELECT 04, 'biology total points',
         (SELECT count(*) FROM bio_p)::text, '176'
  UNION ALL SELECT 05, 'biology B-suffix points',
         (SELECT count(*) FROM bio_p WHERE code LIKE '%B')::text, '42'
  UNION ALL SELECT 06, 'biology ELIGIBLE (draft + verified_at NULL)',
         (SELECT count(*) FROM bio_p WHERE status = 'draft' AND verified_at IS NULL)::text, '176'
  UNION ALL SELECT 07, 'biology outside expected lifecycle',
         (SELECT count(*) FROM bio_p WHERE status <> 'draft' OR verified_at IS NOT NULL)::text, '0'
  UNION ALL SELECT 08, 'biology lesson mappings',
         (SELECT count(*) FROM lesson_spec_points
           WHERE spec_point_id IN (SELECT id FROM bio_p))::text, '0'
  UNION ALL SELECT 09, 'biology question mappings (paper_questions -> past_papers)',
         (SELECT count(*) FROM question_spec_points qsp
            JOIN paper_questions pq ON pq.id = qsp.question_id
            JOIN past_papers pp    ON pp.id = pq.paper_id
           WHERE pp.course_id IN (SELECT id FROM bio))::text, '0'
  UNION ALL SELECT 10, 'chemistry topics / points / live+verified / C-suffix',
         (SELECT count(*) FROM chem_t)::text || ' / ' ||
         (SELECT count(*) FROM chem_p)::text || ' / ' ||
         (SELECT count(*) FROM chem_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM chem_p WHERE code LIKE '%C')::text, '28 / 182 / 182 / 52'
  UNION ALL SELECT 11, 'IAL live+verified / archived',
         (SELECT count(*) FROM ial_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM ial_p WHERE status = 'archived')::text, '157 / 1'
  UNION ALL SELECT 12, 'non-biology spec points total',
         (SELECT count(*) FROM spec_points p JOIN topics t ON t.id = p.topic_id
            JOIN courses c ON c.id = t.course_id
           WHERE c.slug <> 'edexcel-igcse-biology')::text, '340'
  UNION ALL SELECT 99, 'END OF PRECHECK', 'seen', 'seen - if missing, the paste was truncated'
) checks ORDER BY chk;
```

Every row must match `expected`. Any mismatch → STOP, apply nothing, report.

### 1b. Apply 009

```bash
pbcopy < /Users/muhammed/dev/ailemy-igcse-biology-mastery/supabase/seed/009_igcse_biology_official_spec_verification.sql
```

Paste whole into a fresh SQL Editor tab; confirm the last line of the paste
is the `-- END OF 009 …` sentinel; run once. Expected result:
**`Success. No rows returned`**. Any `009 aborted:` message or other error =
full rollback, nothing applied — report it verbatim.

### 1c. POST-APPLY check (read-only)

```sql
WITH
  bio   AS (SELECT id FROM courses WHERE slug = 'edexcel-igcse-biology'),
  bio_t AS (SELECT t.id FROM topics t WHERE t.course_id IN (SELECT id FROM bio)),
  bio_p AS (SELECT p.id, p.code, p.status, p.verified_at FROM spec_points p
             WHERE p.topic_id IN (SELECT id FROM bio_t)),
  chem  AS (SELECT id FROM courses WHERE slug = 'edexcel-igcse-chemistry'),
  chem_t AS (SELECT t.id FROM topics t WHERE t.course_id IN (SELECT id FROM chem)),
  chem_p AS (SELECT p.code, p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM chem_t)),
  ial   AS (SELECT id FROM courses WHERE slug = 'edexcel-ial-as-chemistry'),
  ial_t AS (SELECT t.id FROM topics t WHERE t.course_id IN (SELECT id FROM ial)),
  ial_p AS (SELECT p.status, p.verified_at FROM spec_points p
             WHERE p.topic_id IN (SELECT id FROM ial_t))
SELECT * FROM (
  SELECT 01 AS chk, 'biology topics' AS check_name,
         (SELECT count(*) FROM bio_t)::text AS result, '22' AS expected
  UNION ALL SELECT 02, 'biology total points',
         (SELECT count(*) FROM bio_p)::text, '176'
  UNION ALL SELECT 03, 'biology live + verified',
         (SELECT count(*) FROM bio_p WHERE status = 'live' AND verified_at IS NOT NULL)::text, '176'
  UNION ALL SELECT 04, 'biology still draft',
         (SELECT count(*) FROM bio_p WHERE status = 'draft')::text, '0'
  UNION ALL SELECT 05, 'biology verified_at NULL',
         (SELECT count(*) FROM bio_p WHERE verified_at IS NULL)::text, '0'
  UNION ALL SELECT 06, 'biology B-suffix points',
         (SELECT count(*) FROM bio_p WHERE code LIKE '%B')::text, '42'
  UNION ALL SELECT 07, 'biology lesson mappings',
         (SELECT count(*) FROM lesson_spec_points
           WHERE spec_point_id IN (SELECT id FROM bio_p))::text, '0'
  UNION ALL SELECT 08, 'biology question mappings',
         (SELECT count(*) FROM question_spec_points qsp
            JOIN paper_questions pq ON pq.id = qsp.question_id
            JOIN past_papers pp    ON pp.id = pq.paper_id
           WHERE pp.course_id IN (SELECT id FROM bio))::text, '0'
  UNION ALL SELECT 09, 'chemistry topics / points / live+verified / C-suffix',
         (SELECT count(*) FROM chem_t)::text || ' / ' ||
         (SELECT count(*) FROM chem_p)::text || ' / ' ||
         (SELECT count(*) FROM chem_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM chem_p WHERE code LIKE '%C')::text, '28 / 182 / 182 / 52'
  UNION ALL SELECT 10, 'IAL live+verified / archived',
         (SELECT count(*) FROM ial_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM ial_p WHERE status = 'archived')::text, '157 / 1'
  UNION ALL SELECT 11, 'non-biology spec points total',
         (SELECT count(*) FROM spec_points p JOIN topics t ON t.id = p.topic_id
            JOIN courses c ON c.id = t.course_id
           WHERE c.slug <> 'edexcel-igcse-biology')::text, '340'
  UNION ALL SELECT 99, 'END OF POSTCHECK', 'seen', 'seen - if missing, the paste was truncated'
) checks ORDER BY chk;
```

### 1d. After a clean post-check

- From a checkout with `.env.local`:
  `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/db-checks/igcse-4bi1-spec-verify.ts --verified`
  → expect `ALL CHECKS PASS` (wording/titles byte-exact, lifecycle complete).
- Tell the session/assistant "009 applied + verified" so the 009 header gains
  its `⚠ APPLIED` record (the 007 convention) in a chore commit.
- Then the branch is merge-ready (owner-approved merge; nothing else pending).

---

## 2. BIOLOGY QUESTION BANK MAPPING READINESS (read-only audit, 2026-09-05)

**Papers** — production holds **44** 4BI1 past-paper rows (owner baseline).
The archive census (2026-08-29) records 46 QU-bearing paper/session combos —
components **16× 1B, 7× 1BR, 16× 2B, 7× 2BR** — across sessions Jan 2020–23,
Jun 2019 & 2021–25, Nov 2020–21 & 2023–25, all bucket-10 (already
represented in `past_papers`). SAM specimens excluded by policy.

**Mark schemes**: 44 in the archive census. **Examiner reports**: 42.
Both stored as paper PDFs, not structured rows.

**Questions transcribed**: **0** for 4BI1. The only transcription writer
(`scripts/seed-exam-questions.ts`) contains WCH11 content only; live
`paper_questions` rows for Biology papers: expected 0 (unverifiable from
this credential-less worktree — confirm with one query:
`SELECT count(*) FROM paper_questions pq JOIN past_papers pp ON pp.id = pq.paper_id
 JOIN courses c ON c.id = pp.course_id WHERE c.slug = 'edexcel-igcse-biology';`).

**Existing Biology question_spec_points**: **0** (owner baseline).
Live `question_spec_points` overall: 18 pre-existing WCH11 rows (007's
record); 4CH1 also has zero mappings yet.

**Machinery compatibility**: fully reusable, nothing Biology-specific
needed. `question_spec_points` (0035) stores textual codes per question,
UNIQUE `(question_id, spec_code)`, staff-write / live-paper-read RLS —
course scoping arrives through `paper_questions.paper_id →
past_papers.course_id`, which the mastery exam-evidence path already
follows.

**Deterministically checkable**: code existence (against the committed
176-code extraction), duplicate pairs, malformed codes, and the
Biology-specific rule that a **B-suffix code can never be mapped on a
Paper 1 (1B/1BR) question** — the official document forbids it. All four
are enforced by `scripts/spec-extract/validate-4bi1-mapping.ts` (dry-run,
no DB) with `4bi1-mapping-fixture.example.json` as the template and
`spec-4bi1-mapping-validator.test.ts` (13 checks) as its guard.

**Requiring academic review**: every actual question→code choice. No AI
guessing; a human reads the question + mark scheme and writes the fixture;
the validator refuses mechanical impossibilities.

**Blockers**: (1) question transcription for 4BI1 papers has not started —
mapping needs `paper_questions` rows to attach to; (2) the apply path for
mappings (fixture → `question_spec_points` INSERTs) is Question Bank
ownership and deliberately not built here.

**Recommended first paper**: **June 2019 Paper 1B** (`4BI1_1B_0619`) —
the first live assessment of this exact specification, QU+MS+ER all present,
and Paper 1 first lets the B-suffix validator prove its worth (any B-code in
a 1B fixture is definitionally an error). Pair with 2B 0619 next so both
components of one series are covered end-to-end.

---

## 3. Lesson readiness

IGCSE Biology lessons: **zero** exist (confirmed repo-side and by owner
baseline; `003_biology_lesson_catalogue.sql` is IAL only). No placeholder
lessons and no fake mappings were created — the explorer's honest state is
"no lessons yet" per point.

When real lessons exist, connection is exactly the existing generic path:
1. `lessons` row with `course_id` = the Biology course (slug-scoped insert).
2. One `lesson_spec_points (lesson_id, spec_point_id)` row per point the
   lesson genuinely teaches — resolve `spec_point_id` through
   `topics.course_id` = Biology, never by bare textual code (codes collide
   with 4CH1/IAL by design).
3. Nothing else: the explorer, mastery, and coverage counts pick lessons up
   automatically; there is no per-course registry to edit.

---

## 4. Performance & security notes (this session)

- Engine scale test over the real 176-point tree: `groupTopicsByUnit`
  ≈ 0.00 ms, `buildCourseMastery` 0.02 ms (zero evidence) / 0.20 ms
  (500 answers), `buildCourseInsights` 0.01 / 0.27 ms. No risk.
- `loadCourseResources()` previously fetched **all** `spec_points` and
  `lesson_spec_points` unfiltered (516 points across three courses; silent
  truncation at PostgREST's 1000-row default as courses accumulate). Fixed
  this session: both reads now scoped by the course's own topic/point ids,
  with source-text gates in `specification-unitless.test.ts` so the
  whole-table shape cannot return.
- Security surface unchanged: no new tables, grants, or policies; curriculum
  reads are the existing public model; evidence reads stay student-scoped
  with explicit `student_id` filters; textual code collisions cannot leak
  evidence across courses (foreign codes land in `ignoredRows` — tested).
