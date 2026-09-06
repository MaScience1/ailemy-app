# IGCSE Physics (4PH1) — Service 3 Mastery: owner runbook & readiness

Written 2026-09-06 (Phase 2); updated the same day after the owner applied
both seeds. State now: seed **010 APPLIED** (2026-09-06, "Success. No rows
returned", sentinel confirmed, post-010 17-row check passed) and seed
**011 APPLIED + VERIFIED** (2026-09-06, same discipline, post-011 15-row
check passed) — the verified production state is 30 topics / 195 points /
48 P-suffix, all **live + verified_at set**, 0 draft / 0 unverified /
0 duplicate / 0 malformed, zero lesson and question mappings, siblings
unchanged (Chemistry 28/182/52C, Biology 22/176/42B, IAL 157/157/1,
non-Physics total 516). §1 below is kept as the historical record of the
apply procedure.

Authority for everything here: Pearson Edexcel International GCSE in Physics
(4PH1) Specification, **Issue 4**, © Pearson Education Limited 2024 (ISBN
978 1 446 93119 6), pdf sha256
`bac4b8312d4fbfc84672f909100d66b2b3cda0b25e98c0d11bbc7366dae482b2`,
pinned locally at
`~/Desktop/international-gcse-physics-4ph1-specification-issue4.pdf`.
Pearson serves Issue 4 as the current document; its own change summary lists
only administrative deltas against the previous issue (series availability
pp. 8–9, forbidden combinations p. 33, command word "Which" p. 48) — **no
content-section changes** — so Issue 4 is the correct authority for the whole
2019–2025 paper corpus.

Production course: slug `edexcel-igcse-physics`,
uuid `e63ebefd-1936-4344-9947-2fbc49bfdc66`, status `live` (seeds target the
slug, never the uuid). Verified read-only 2026-09-06 (anon key): 0 units,
0 topics, 0 spec points, 0 lessons, 50 past papers.

---

## 1. Owner runbook — Phase 3, in order

### 1a. PRE-APPLY check before seed 010 (read-only, one statement, one result table)

```sql
WITH
  phys   AS (SELECT id, slug, name, status FROM courses WHERE slug = 'edexcel-igcse-physics'),
  phys_t AS (SELECT t.id, t.unit_id FROM topics t WHERE t.course_id IN (SELECT id FROM phys)),
  phys_p AS (SELECT p.id, p.code, p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM phys_t)),
  chem   AS (SELECT id FROM courses WHERE slug = 'edexcel-igcse-chemistry'),
  chem_t AS (SELECT t.id FROM topics t WHERE t.course_id IN (SELECT id FROM chem)),
  chem_p AS (SELECT p.code, p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM chem_t)),
  bio    AS (SELECT id FROM courses WHERE slug = 'edexcel-igcse-biology'),
  bio_t  AS (SELECT t.id FROM topics t WHERE t.course_id IN (SELECT id FROM bio)),
  bio_p  AS (SELECT p.code, p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM bio_t)),
  ial    AS (SELECT id FROM courses WHERE slug = 'edexcel-ial-as-chemistry'),
  ial_t  AS (SELECT t.id FROM topics t WHERE t.course_id IN (SELECT id FROM ial)),
  ial_p  AS (SELECT p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM ial_t))
SELECT * FROM (
  SELECT 01 AS chk, 'physics course identity (exactly one row)' AS check_name,
         (SELECT string_agg(id::text || ' · ' || status, ' | ') FROM phys) AS result,
         'e63ebefd-1936-4344-9947-2fbc49bfdc66 · live' AS expected
  UNION ALL SELECT 02, 'physics units rows',
         (SELECT count(*)::text FROM units WHERE course_id IN (SELECT id FROM phys)), '0'
  UNION ALL SELECT 03, 'physics topics',
         (SELECT count(*) FROM phys_t)::text, '0'
  UNION ALL SELECT 04, 'physics spec points',
         (SELECT count(*) FROM phys_p)::text, '0'
  UNION ALL SELECT 05, 'physics lessons',
         (SELECT count(*)::text FROM lessons WHERE course_id IN (SELECT id FROM phys)), '0'
  UNION ALL SELECT 06, 'physics lesson mappings',
         (SELECT count(*) FROM lesson_spec_points
           WHERE spec_point_id IN (SELECT id FROM phys_p))::text, '0'
  UNION ALL SELECT 07, 'physics question mappings (paper_questions -> past_papers)',
         (SELECT count(*) FROM question_spec_points qsp
            JOIN paper_questions pq ON pq.id = qsp.question_id
            JOIN past_papers pp    ON pp.id = pq.paper_id
           WHERE pp.course_id IN (SELECT id FROM phys))::text, '0'
  UNION ALL SELECT 08, 'physics past papers',
         (SELECT count(*)::text FROM past_papers WHERE course_id IN (SELECT id FROM phys)), '50'
  UNION ALL SELECT 09, 'chemistry topics / points / live+verified / C-suffix',
         (SELECT count(*) FROM chem_t)::text || ' / ' ||
         (SELECT count(*) FROM chem_p)::text || ' / ' ||
         (SELECT count(*) FROM chem_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM chem_p WHERE code LIKE '%C')::text, '28 / 182 / 182 / 52'
  UNION ALL SELECT 10, 'biology topics / points / live+verified / B-suffix',
         (SELECT count(*) FROM bio_t)::text || ' / ' ||
         (SELECT count(*) FROM bio_p)::text || ' / ' ||
         (SELECT count(*) FROM bio_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM bio_p WHERE code LIKE '%B')::text, '22 / 176 / 176 / 42'
  UNION ALL SELECT 11, 'IAL live / live+verified / archived',
         (SELECT count(*) FROM ial_p WHERE status = 'live')::text || ' / ' ||
         (SELECT count(*) FROM ial_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM ial_p WHERE status = 'archived')::text, '157 / 157 / 1'
  UNION ALL SELECT 12, 'non-physics specification total',
         (SELECT count(*) FROM spec_points p
            JOIN topics t ON t.id = p.topic_id
           WHERE t.course_id NOT IN (SELECT id FROM phys))::text, '516'
  UNION ALL SELECT 13, 'END OF PRECHECK', 'sentinel', 'sentinel'
) checks ORDER BY chk;
```

**If the sentinel row (chk 13) is missing, the paste was truncated — re-run.**
Any `result ≠ expected` means STOP: production is not in the state the seeds
assume; investigate before applying anything. Keep the output.

### 1b. Apply seed 010

Whole-file paste of `supabase/seed/010_igcse_physics_specification.sql` into
the SQL Editor. Before running: confirm the clipboard byte count equals the
file's (150,915 bytes at commit; re-check with `wc -c` if amended) and that
the visible last line of the paste is
`-- END OF 010 — 30 topics, 195 points. If this line is missing, the paste was truncated.`
Expected outcome: `Success. No rows returned` — the in-transaction DO block
has already recounted 30 topics / 195 points / 48 P-suffix and would have
RAISEd (rolling everything back) on any drift. A truncated paste loses
COMMIT and rolls back by itself.

### 1c. POST-APPLY check after 010 (read-only)

Re-run the 1a statement. Expected deltas, everything else identical:
- chk 03 `30` · chk 04 `195` · (chk 02/05/06/07 still `0`, chk 08 still `50`)

Then the lifecycle detail:

```sql
SELECT count(*) FILTER (WHERE p.status = 'draft' AND p.verified_at IS NULL) AS eligible_draft,
       count(*) FILTER (WHERE p.status <> 'draft' OR p.verified_at IS NOT NULL) AS outside_lifecycle,
       count(*) FILTER (WHERE p.code LIKE '%P') AS p_suffix,
       count(*) FILTER (WHERE p.title IS NULL OR p.title = '' OR p.description IS NULL OR p.description = '') AS bad_required
  FROM spec_points p
  JOIN topics t ON t.id = p.topic_id
  JOIN courses c ON c.id = t.course_id
 WHERE c.slug = 'edexcel-igcse-physics';
-- expected: 195 · 0 · 48 · 0
```

From a credentialed checkout, the scripted gate is:
`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/db-checks/igcse-4ph1-spec-verify.ts`
(default mode — asserts every code, wording, title, topic assignment and
sibling regression; `--baseline` before 010 is report-only; add `--verified`
only after 011).

### 1d. Apply seed 011, then its post-check

Only after 1c is clean. Whole-file paste of
`supabase/seed/011_igcse_physics_official_spec_verification.sql` (same byte
and sentinel discipline; `-- END OF 011 —` must be the visible last line).
`Success. No rows returned` here proves, by construction, that every guard in
the DO block held at commit time: exactly 195 rows moved draft→live+verified,
end state 195/0/0/48, and the siblings still 28/182/52 · 22/176/42 ·
157/157/1 with the non-Physics total 516.

Post-check (read-only):

```sql
SELECT count(*) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL) AS live_verified,
       count(*) FILTER (WHERE p.status = 'draft') AS still_draft,
       count(*) FILTER (WHERE p.verified_at IS NULL) AS unverified
  FROM spec_points p
  JOIN topics t ON t.id = p.topic_id
  JOIN courses c ON c.id = t.course_id
 WHERE c.slug = 'edexcel-igcse-physics';
-- expected: 195 · 0 · 0
```

Scripted: `… igcse-4ph1-spec-verify.ts --verified`.

### 1e. After a clean 011 post-check

Amend both seed headers (`NOT YET APPLIED` → `⚠ APPLIED <date> …` with the
clipboard byte count and the post-check results, exactly as 008/009 record
theirs), flip the two header assertions in
`scripts/exam-seed/__tests__/spec-4ph1.test.ts` §4/§7 from `NOT YET APPLIED`
to the applied form, and commit the amendment as its own
`chore(mastery): record 010/011 as APPLIED` commit — the 008→009 precedent
(`53d0f3a → 1722a85 → 39629bf`).

---

## 2. PHYSICS QUESTION BANK MAPPING READINESS (read-only audit, 2026-09-06)

From the live database (anon key) and the disk census
(`docs/import-reports/census-20260829-130922.md`):

| Fact | Value | Status |
|---|---|---|
| past_papers rows | **50**, all `live` | VERIFIED (anon read) |
| Components | 15×1P, 10×1PR, 15×2P, 10×2PR | VERIFIED |
| Sessions | Jun 2019; Jan+Nov 2020–2023 (Jan ends 2023); Jun 2021–2025; Nov 2024, 2025 — 15 sessions | VERIFIED |
| Mark schemes attached | 50 / 50 | VERIFIED |
| Examiner reports attached | 48 / 50 (two missing, matches the census) | VERIFIED |
| paper_questions (transcribed questions) | not anon-readable; **asserted 0** (no import report mentions Physics transcription) | BLOCKED for anon — owner query below |
| question_spec_points | not anon-readable; **asserted 0** | BLOCKED for anon — owner query below |

Owner query to close both gaps (read-only):

```sql
SELECT (SELECT count(*) FROM paper_questions q
          JOIN past_papers pp ON pp.id = q.paper_id
         WHERE pp.course_id = 'e63ebefd-1936-4344-9947-2fbc49bfdc66') AS phys_questions,
       (SELECT count(*) FROM question_spec_points qsp
          JOIN paper_questions q ON q.id = qsp.question_id
          JOIN past_papers pp ON pp.id = q.paper_id
         WHERE pp.course_id = 'e63ebefd-1936-4344-9947-2fbc49bfdc66') AS phys_mappings;
-- expected today: 0 · 0
```

Mapping tooling is prepared, dry-run only, in
`scripts/spec-extract/validate-4ph1-mapping.ts` (see the Service 2 handoff,
`docs/igcse-physics-question-bank-mapping-handoff.md`). **No mappings were
created and none may be until transcription exists and the owner gates the
apply.** Physics-specific note for future transcribers: a large share of
4PH1 marks are calculation questions whose mark schemes credit
substitution/rearrangement/evaluation of the spec-point relationships — the
fixture's `note` field is the place to record which relationship a
calculation exercises; the validator's course-scoped code vocabulary and the
Paper-1-versus-P-suffix impossibility rule are enforced mechanically.

## 3. Lesson readiness

**Zero IGCSE Physics lessons exist** (VERIFIED, anon read: no `lessons` row
carries the Physics course id; global `lesson_spec_points` holds 7 rows, all
IAL pilot). Recorded honestly: no placeholders were created, and Explorer
coverage will honestly render "no lesson yet" per point until real lessons
exist. Lesson mapping is Phase 5, after lessons are authored.

## 4. Generic §29 issues — assessed for Phase 2, all DEFERRED (none required)

Owner instruction: no hygiene bundling; implement only what Physics
correctness requires. Assessment of each audit finding:

1. **Duplicate lexical comparator** — `src/lib/catalogue/queries.ts:795-810`
   (`specCodeCompare`) orders `1.10` before `1.5C`; used by lesson-card spec
   pills (`:347`) and the lesson detail page (`:427`).
   *Required for Physics?* **NO** — it renders only lesson-linked spec
   pills, and Physics has zero lessons; nothing Physics-facing can hit it in
   Phase 3. It already mis-orders Chemistry C and Biology B pills, so it is
   a pre-existing Service 3 hardening item, not a Physics one.
   *Proposed fix (separate task):* delete the duplicate and import
   `compareSpecCodes` from `src/lib/specification/codes.ts` (whose own
   comment `codes.ts:11-14` says to do exactly this when a third consumer
   arrives); regression-test via a pairwise check over a suffixed code set.
   *Merge risk:* low — catalogue file is otherwise untouched by this branch.
2. **`src/app/admin/catalogue/page.tsx:34` `.limit(500)`** — whole-table
   `spec_points` read; 516 live points today, so the admin catalogue page
   is **already truncating** before Physics; 711 after.
   *Required for Physics?* **NO** — admin-only page, no bearing on seed
   correctness or the student surface. Deferred with the note that Physics
   worsens an already-present truncation.
   *Proposed fix:* course-scoped reads or explicit pagination; while there,
   audit the sibling `.limit(2000)` pages (`admin/lessons/new`,
   `admin/lessons/[id]`, `src/lib/admin/inline-data.ts:63-67`) whose
   headroom shrinks to ~1,300.
3. **Unbounded student-evidence reads** —
   `src/lib/specification/queries.ts:226-230` (`lesson_practice_answers`),
   `:289-294` (`exam_attempts`), `:305-312` (`question_attempts`) carry no
   `.range()`, so PostgREST's 1000-row default silently truncates a heavy
   student's evidence and understates mastery.
   *Required for Physics?* **NO** — a Physics student has zero evidence rows
   at launch; this bites only long-lived heavy accounts, equally on every
   course. Genuine correctness risk, Service-3-owned, deserving its own
   change with a sabotage test (a >1000-row synthetic evidence fixture).
4. **`validate-4bi1-mapping.ts` is 4BI1-hardcoded** — *resolved for Physics*
   not by generalising the shared file (which Service 2 consumes and other
   worktrees reference) but by the additive sibling
   `validate-4ph1-mapping.ts` in this branch — zero shared-file edits, zero
   merge risk. Folding the two into one parameterised validator is a
   later refactor, after the Service 2 handoff settles.

## 5. Performance & security notes (this session)

- The 8b8450b course-scoped resource reads keep the Explorer and resources
  taxonomy safe at 711 points (516 + 195); source-gated by
  `specification-unitless.test.ts:278-288`, which still passes.
- Physics rides the existing security model unchanged: public-read
  curriculum grants (SELECT only), staff-gated `question_spec_points`
  writes, double-scoped student evidence, no client-authoritative mastery.
  Seeds 010/011 touch no grants, no policies, no DDL.
- The only live-database access this branch performed was **read-only,
  anon-key**: the Phase 0 baseline probes and
  `igcse-4ph1-spec-verify.ts --baseline` (4PH1 at 0/0/0; siblings exactly
  182 / 176 / 158). No service-role key was read or used.
