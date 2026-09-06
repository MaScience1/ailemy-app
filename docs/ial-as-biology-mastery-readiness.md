# IAL AS Biology (XBI11 · WBI11–WBI13) — Service 3 Mastery: owner runbook & readiness

Written 2026-09-06 (Phase 2); updated the same day after the owner applied
both seeds. State now: seed **012 APPLIED** (2026-09-06, "Success. No rows
returned", sentinel confirmed, 15-row pre-check and 19-row post-012 check
both exact) and seed **013 APPLIED + VERIFIED** (2026-09-06, same
discipline, 18-row post-013 check exact, scripted `--verified` gate ALL
CHECKS PASS) — the verified production state is 4 unit-linked topics
(2/2/0) / 80 points (38/42 per unit, 9 core practicals), all **live +
verified_at set**, 0 draft / 0 unverified / 0 duplicate / 0 malformed,
zero lesson and question mappings, A2 Biology untouched at 0/0, siblings
unchanged (IAL Chemistry 157/157/1, IGCSE Chemistry 28/182/52C, IGCSE
Biology 22/176/42B, IGCSE Physics 30/195/48P, non-target total 711). §1
below is kept as the historical record of the apply procedure. Build
evidence at commit time: 91 pre-apply checks + 23 validator checks +
22-case sabotage battery all green; full repo suite ALL PASS.

Authority for everything here: Pearson Edexcel **International Advanced
Level Biology Specification**, IAS **XBI11** / IAL **YBI11**, **Issue 2,
February 2021**, © Pearson Education Limited 2021 (ISBN 978 1 446 94575 9),
pdf sha256
`9197bf761e06353b492fa04ee3ac4352a02e7e5baf56f277782f4ca0f53d2703`,
downloaded from qualifications.pearson.com (URL pinned in
`scripts/spec-extract/wbi-as-issue2.json` meta; keep a local copy at
`~/Desktop/international-a-level-biology-spec.pdf` for re-extraction).
Issue 2's own change summary lists exactly one delta against Issue 1 (a
synoptic-questions sentence for Units 4/5) — **no AS content changes** — so
Issue 2 is the correct authority for the whole 2019–2025 WBI11–13 corpus.
First teaching September 2018; first examination from January 2019.

Production course: slug `edexcel-ial-as-biology`, uuid
`cef65cb4-29d6-452c-99d6-95f9921583c5`, status `live` (seeds target the
slug, never the uuid). Verified read-only 2026-09-06 (anon key): **3 units
already present** (`unit-1`=WBI11, `unit-2`=WBI12, `unit-3`=WBI13 — the
seed creates none and refuses to run without them), 0 topics, 0 spec
points, 100 lessons, 0 lesson/question mappings, 48 past papers. A2
sibling `edexcel-ial-a2-biology` (`33f8d079-…`): 0 topics / 0 points, and
013 guards that it stays that way.

What the seeds contain (owner decisions, Phase 2 approval, all honoured):
**4 topics** (Topics 1–2 → unit-1, Topics 3–4 → unit-2) and **80
specification points** (Unit 1: 38 = T1 20 + T2 18; Unit 2: 42 = T3 21 +
T4 21; Unit 3: **none — it defines no syllabus content and nothing was
fabricated**), one point per officially numbered statement (26 statements
carry 60 roman sub-points inside their descriptions, never as extra rows),
9 core practicals as ordinary coded points (CP1–9 = 1.3, 1.14, 2.3, 2.8,
3.8, 3.15, 4.6, 4.9, 4.12), the document's 5 RECOMMENDED ADDITIONAL
PRACTICAL boxes recorded in the extraction but NOT seeded, 4 italic
guidance notes kept verbatim inside their statements, both built formulae
rendered deterministically inline (4.17 heterozygosity index; 4.18
`D = (N(N-1))/(Σn(n-1))`), and the Issue 2 source typo in 3.5(ii)
(**"knderstand"**) preserved verbatim and pinned — the extractor refuses a
document where it is absent, and the test suite refuses a "corrected" copy.
Wording was cross-checked by an independent pdfplumber reparse (different
library, different parser): 80/80 codes in identical sequence, 80/80
statement chunks verbatim.

---

## 1. Owner runbook — Phase 3, in order

### 1a. PRE-APPLY check before seed 012 (read-only, one statement, one result table)

```sql
WITH
  bio    AS (SELECT id, slug, name, status FROM courses WHERE slug = 'edexcel-ial-as-biology'),
  bio_u  AS (SELECT u.id, u.slug, u.code FROM units u WHERE u.course_id IN (SELECT id FROM bio)),
  bio_t  AS (SELECT t.id, t.unit_id FROM topics t WHERE t.course_id IN (SELECT id FROM bio)),
  bio_p  AS (SELECT p.id, p.code, p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM bio_t)),
  a2     AS (SELECT id FROM courses WHERE slug = 'edexcel-ial-a2-biology'),
  a2_t   AS (SELECT t.id FROM topics t WHERE t.course_id IN (SELECT id FROM a2)),
  a2_p   AS (SELECT p.id FROM spec_points p WHERE p.topic_id IN (SELECT id FROM a2_t)),
  chem_t AS (SELECT t.id FROM topics t WHERE t.course_id IN
              (SELECT id FROM courses WHERE slug = 'edexcel-igcse-chemistry')),
  chem_p AS (SELECT p.code, p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM chem_t)),
  ibio_t AS (SELECT t.id FROM topics t WHERE t.course_id IN
              (SELECT id FROM courses WHERE slug = 'edexcel-igcse-biology')),
  ibio_p AS (SELECT p.code, p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM ibio_t)),
  phys_t AS (SELECT t.id FROM topics t WHERE t.course_id IN
              (SELECT id FROM courses WHERE slug = 'edexcel-igcse-physics')),
  phys_p AS (SELECT p.code, p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM phys_t)),
  ialc_t AS (SELECT t.id FROM topics t WHERE t.course_id IN
              (SELECT id FROM courses WHERE slug = 'edexcel-ial-as-chemistry')),
  ialc_p AS (SELECT p.status, p.verified_at FROM spec_points p
              WHERE p.topic_id IN (SELECT id FROM ialc_t))
SELECT * FROM (
  SELECT 01 AS chk, 'as biology course identity (exactly one row)' AS check_name,
         (SELECT string_agg(id::text || ' · ' || status, ' | ') FROM bio) AS result,
         'cef65cb4-29d6-452c-99d6-95f9921583c5 · live' AS expected
  UNION ALL SELECT 02, 'as biology units (the seed joins these; it creates none)',
         (SELECT string_agg(slug || '=' || code, ', ' ORDER BY slug) FROM bio_u),
         'unit-1=WBI11, unit-2=WBI12, unit-3=WBI13'
  UNION ALL SELECT 03, 'as biology topics',
         (SELECT count(*) FROM bio_t)::text, '0'
  UNION ALL SELECT 04, 'as biology spec points',
         (SELECT count(*) FROM bio_p)::text, '0'
  UNION ALL SELECT 05, 'as biology lessons',
         (SELECT count(*)::text FROM lessons WHERE course_id IN (SELECT id FROM bio)), '100'
  UNION ALL SELECT 06, 'as biology lesson mappings',
         (SELECT count(*) FROM lesson_spec_points
           WHERE spec_point_id IN (SELECT id FROM bio_p))::text, '0'
  UNION ALL SELECT 07, 'as biology question mappings (via paper_questions -> past_papers)',
         (SELECT count(*) FROM question_spec_points qsp
            JOIN paper_questions pq ON pq.id = qsp.question_id
            JOIN past_papers pp    ON pp.id = pq.paper_id
           WHERE pp.course_id IN (SELECT id FROM bio))::text, '0'
  UNION ALL SELECT 08, 'as biology past papers by unit code',
         (SELECT string_agg(paper_code || '×' || n, ', ' ORDER BY paper_code) FROM
            (SELECT pp.paper_code, count(*) AS n FROM past_papers pp
              WHERE pp.course_id IN (SELECT id FROM bio) GROUP BY pp.paper_code) s),
         'WBI11/01×20, WBI12/01×19, WBI13/01×9'
  UNION ALL SELECT 09, 'a2 biology topics / points (must stay 0 throughout)',
         (SELECT count(*) FROM a2_t)::text || ' / ' || (SELECT count(*) FROM a2_p)::text, '0 / 0'
  UNION ALL SELECT 10, 'igcse chemistry topics / points / live+verified / C-suffix',
         (SELECT count(*) FROM chem_t)::text || ' / ' ||
         (SELECT count(*) FROM chem_p)::text || ' / ' ||
         (SELECT count(*) FROM chem_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM chem_p WHERE code LIKE '%C')::text, '28 / 182 / 182 / 52'
  UNION ALL SELECT 11, 'igcse biology topics / points / live+verified / B-suffix',
         (SELECT count(*) FROM ibio_t)::text || ' / ' ||
         (SELECT count(*) FROM ibio_p)::text || ' / ' ||
         (SELECT count(*) FROM ibio_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM ibio_p WHERE code LIKE '%B')::text, '22 / 176 / 176 / 42'
  UNION ALL SELECT 12, 'igcse physics topics / points / live+verified / P-suffix',
         (SELECT count(*) FROM phys_t)::text || ' / ' ||
         (SELECT count(*) FROM phys_p)::text || ' / ' ||
         (SELECT count(*) FROM phys_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM phys_p WHERE code LIKE '%P')::text, '30 / 195 / 195 / 48'
  UNION ALL SELECT 13, 'ial chemistry live / live+verified / archived',
         (SELECT count(*) FROM ialc_p WHERE status = 'live')::text || ' / ' ||
         (SELECT count(*) FROM ialc_p WHERE status = 'live' AND verified_at IS NOT NULL)::text || ' / ' ||
         (SELECT count(*) FROM ialc_p WHERE status = 'archived')::text, '157 / 157 / 1'
  UNION ALL SELECT 14, 'non-as-biology specification total',
         (SELECT count(*) FROM spec_points p
            JOIN topics t ON t.id = p.topic_id
           WHERE t.course_id NOT IN (SELECT id FROM bio))::text, '711'
  UNION ALL SELECT 15, 'END OF PRECHECK', 'sentinel', 'sentinel'
) checks ORDER BY chk;
```

**If the sentinel row (chk 15) is missing, the paste was truncated — re-run.**
Any `result ≠ expected` means STOP: production is not in the state the seeds
assume; investigate before applying anything. Keep the output.

### 1b. Apply seed 012

Whole-file paste of `supabase/seed/012_ial_as_biology_specification.sql`
into the SQL Editor. Before running: confirm the clipboard byte count equals
the file's (**76,751 bytes** at build; re-check with `wc -c` if amended) and
that the visible last line of the paste is
`-- END OF 012 — 4 topics (Units 1-2), 80 points, Unit 3 intentionally empty. If this line is missing, the paste was truncated.`
Expected outcome: `Success. No rows returned` — the in-transaction DO block
has already recounted 4 unit-linked topics (2/2/0 per unit), 80 points
(38/42 per unit), 9 core-practical statements and 0 A2 topics, and would
have RAISEd (rolling everything back) on any drift — including the
missing-units case: absent unit rows insert zero topics and the first count
aborts. A truncated paste loses COMMIT and rolls back by itself.

### 1c. POST-APPLY check after 012 (read-only)

Re-run the 1a statement. Expected deltas, everything else identical:
- chk 03 `4` · chk 04 `80` · (chk 06/07 still `0`, chk 05 still `100`,
  chk 08/09 unchanged)

Then the lifecycle detail:

```sql
SELECT count(*) FILTER (WHERE p.status = 'draft' AND p.verified_at IS NULL) AS eligible_draft,
       count(*) FILTER (WHERE p.status <> 'draft' OR p.verified_at IS NOT NULL) AS outside_lifecycle,
       count(*) FILTER (WHERE p.description LIKE 'CORE PRACTICAL %') AS core_practicals,
       count(*) FILTER (WHERE p.title IS NULL OR p.title = '' OR p.description IS NULL OR p.description = '') AS bad_required,
       count(*) FILTER (WHERE t.unit_id IS NULL) AS points_on_unitless_topics
  FROM spec_points p
  JOIN topics t ON t.id = p.topic_id
  JOIN courses c ON c.id = t.course_id
 WHERE c.slug = 'edexcel-ial-as-biology';
-- expected: 80 · 0 · 9 · 0 · 0
```

From a credentialed checkout, the scripted gate is:
`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/db-checks/ial-as-biology-spec-verify.ts`
(default mode — asserts every code, wording, title, topic AND unit
assignment, per-unit split, A2 emptiness and all four sibling regressions;
`--baseline` before 012 is report-only; add `--verified` only after 013).

### 1d. Apply seed 013, then its post-check

Only after 1c is clean. Whole-file paste of
`supabase/seed/013_ial_as_biology_official_spec_verification.sql`
(**15,112 bytes** at build; same byte and sentinel discipline —
`-- END OF 013 —` must be the visible last line).
`Success. No rows returned` here proves, by construction, that every guard
in the DO block held at commit time: exactly 80 rows moved
draft→live+verified, end state 80/0/0 with 38/42 per unit and 9 core
practicals, siblings still 28/182/52C · 22/176/42B · 30/195/48P ·
157/157/1, A2 Biology still 0/0, and the non-AS-Biology total 711.

Post-check (read-only):

```sql
SELECT count(*) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL) AS live_verified,
       count(*) FILTER (WHERE p.status = 'draft') AS still_draft,
       count(*) FILTER (WHERE p.verified_at IS NULL) AS unverified
  FROM spec_points p
  JOIN topics t ON t.id = p.topic_id
  JOIN courses c ON c.id = t.course_id
 WHERE c.slug = 'edexcel-ial-as-biology';
-- expected: 80 · 0 · 0
```

Scripted: `… ial-as-biology-spec-verify.ts --verified`.

### 1e. After a clean 013 post-check

Amend both seed headers (`NOT YET APPLIED` → `⚠ APPLIED <date> …` with the
clipboard byte count and the post-check results, exactly as 010/011 record
theirs — for 012 the applied record lives in the GENERATOR template, so
edit `generate-wbi-as-seed.ts` and regenerate rather than hand-editing the
seed), flip the header assertions in
`scripts/exam-seed/__tests__/spec-wbi-as.test.ts` §4/§7 from
`NOT YET APPLIED` to the applied form, and commit the amendment as its own
`chore(mastery): record 012/013 as APPLIED` commit — the 008→009 and
010→011 precedent.

Note on the draft-visibility window (pre-existing behaviour, all subjects):
the Explorer shows non-archived points, so between 1b and 1d the 80 points
are publicly visible in `draft` state. Every prior subject had the same
window; apply 013 promptly after 1c to keep it short.

---

## 2. QUESTION BANK MAPPING READINESS (read-only audit, 2026-09-06)

Full contract: `docs/ial-as-biology-question-bank-mapping-handoff.md`.

| Fact | Value | Status |
|---|---|---|
| past_papers rows | **48**, all `live`, all unit-linked (20 WBI11/01, 19 WBI12/01, 9 WBI13/01); durations/marks match the spec (90/80, 90/80, 80/50) | VERIFIED (anon read) |
| Sessions | WBI11: Jan 2019–25, M/J 2019+2021–25, O/N 2019–25. WBI12: same minus Jan 2019. WBI13: 2023–25 only | VERIFIED |
| Mark schemes attached | **48 / 48** | VERIFIED |
| Examiner reports attached | **44 / 48** (WBI11 18/20, WBI12 17/19, WBI13 9/9) | VERIFIED |
| paper_questions (transcribed) | **0** across all 48 papers | VERIFIED (live count) |
| question_spec_points | **0 by construction** (no question rows; direct anon read 401 by design) | VERIFIED |

Mapping tooling is prepared, dry-run only:
`scripts/spec-extract/validate-wbi-as-mapping.ts` (+ example fixture +
23-check suite) enforcing course scope, **unit scope** (WBI11→Topics 1–2,
WBI12→Topics 3–4, WBI13→all of 1–4), A2 refusal, duplicate/malformed
refusal. **No mappings were created and none may be until transcription
exists and the owner gates the apply.** The gate order is: Phase 3 applies →
Service 2 transcription → human-authored fixtures → validator → owner-gated
apply.

### The WBI13 corpus gap (separate evidence issue — does NOT block Phase 3)

Unit 3 was first assessed June 2019, but the archive holds WBI13 sittings
for **2023–2025 only** (9 papers) — 2019–2022 sittings are absent from the
source tree the bulk import walked. Effect: breadth of the practical
paper's future transcription/mapping only. It does not touch the
specification seed (Unit 3 defines no spec content), WBI11/WBI12 coverage,
or any Phase 3 step. Follow-up for the owner/Service 2: check the source
archive for pre-2023 WBI13 folders or source them from Pearson; if they
genuinely cannot be sourced, record that in the import census so the gap is
a known fact, not a silent hole. Nothing may be fabricated to close it.

---

## 3. LESSON READINESS (read-only analysis, 2026-09-06 — no mappings created)

The 100 AS lessons (46 unit-1 / 48 unit-2 / 6 unit-3, `lesson_number` =
`sort_order`, contiguous 1–100, no duplicate slugs/titles) align cleanly
with the official 80 points:

- **Topic boundaries fall at lesson 22/23, 46/47, 70/71**: Topic 1 →
  lessons 1–22, Topic 2 → 23–46, Topic 3 → 47–70, Topic 4 → 71–94
  (≈1.1–1.3 lessons per point). Every one of the 80 points has at least one
  plausible host lesson; no AS lesson title looks like A2 content.
- **Core practicals match the official set exactly** (CP1–9, right codes,
  right activities). Granularity note: CP5 spans lessons 53/54 (the spec's
  own (i)/(ii)) and CP7 spans 76/77, so 9 CPs occupy 11 flagged lessons —
  any future invariant asserting `count(is_core_practical)=9` for AS will
  fail; count distinct CP numbers instead.
- **Ten lessons will legitimately carry zero spec points**: L70 (Topic 3
  consolidation), L93 (Unit 2 practical/data review), L94 (AS synoptic),
  and the six unit-3 skills lessons (95–100). The publish-readiness gate
  requires ≥1 spec point per published lesson, so the mapping phase must
  either map these (unit-3 lessons can honestly cite the nine CP codes:
  planning/implementation/processing each draw on identifiable CPs) or
  leave them unpublished — an owner call for Phase 5.
- **Expect a many-to-one tail**: ~8 lessons carry 2–3 points each (L22
  worst: 1.18 + 1.19 + 1.20); mapping coverage reports will look lopsided
  there by design.
- **Content-fidelity watch-list for authors** (from the spec's own italic
  exclusion notes): L2/L3 (no β-glucose/cellulose in Topic 1 — they arrive
  at 4.3/4.4), L11 (no myogenic stimulation detail at IAS), L30 (no
  specific amino-acid structures), L56 (no prophase stage names).
- **Recommended-practical gap**: the five unnumbered RECOMMENDED ADDITIONAL
  PRACTICAL activities (heart dissection, tissue water potential, biuret
  estimation, pollen tubes, mineral deficiencies) appear in no lesson title.
  Unit 3 examines practical technique, so this is a real content gap for
  teaching, though not a mapping blocker.

---

## 4. DEFERRED GENERIC HARDENING (owner decision 5 — none required for this branch's correctness; do not bundle)

| # | Issue | Evidence | Severity | Correctness-affecting? | Suggested future fix |
|---|---|---|---|---|---|
| 1 | Course-wide spec-code uniqueness is not schema-enforced (`UNIQUE (topic_id, code)` only); `courseVocabulary()` collapses duplicates last-wins | `0001_initial_schema.sql:90`, `src/lib/specification/mastery.ts:52-57` | latent-medium | Only if duplicate codes are ever seeded — 012's DO block, the test suite and the DB verifier all assert zero duplicates for this course, and Pearson's continuous Topic 1–4 numbering cannot collide | A cross-course db-check sweep asserting per-course code uniqueness, or a generated unique index per course via a maintained check |
| 2 | `lesson_spec_points` writes never validate that the point belongs to the lesson's course (client-side filter only) | `src/app/admin/lessons/actions.ts:113-167`, `src/app/admin/lessons/_form.tsx:97-106` | medium (admin-only surface, grows with each live course) | A mis-link injects a foreign code into practice evidence — silently ignored or, on a textual collision, misattributed | Server-side assertion in `syncSpecPoints()`: spec point's course == lesson's course, refuse otherwise |
| 3 | The tree's `lesson_spec_points` read has no `.limit()` — Supabase's 1000-row default could silently truncate once a ~100-lesson course is fully mapped | `src/lib/specification/queries.ts:115-120` | low today (0 mappings), **must land before Phase 5 completes** | Yes, once mapping volume approaches 1000 rows for one course | Explicit `.limit()` sized to the course, or pagination; plus a count-vs-returned assertion |
| 4 | Admin pickers read `spec_points` globally with hard caps (`limit(2000)` pickers; `limit(500)` catalogue — already truncating at 516, 596 after 012) | `src/lib/admin/inline-data.ts:63-68`, `src/app/admin/catalogue/page.tsx:31-34` | low (admin UX/data hygiene) | No student-facing effect; admin views silently lose rows past the cap | Course-scoped picker queries; drop the global read |

---

## 5. FILE MAP (this branch)

| Artefact | Path |
|---|---|
| Extractor (deterministic, refusal-armed) | `scripts/spec-extract/extract_wbi_as.py` |
| Near-source line dump | `scripts/spec-extract/wbi-as-issue2-content-lines.txt` |
| Canonical extraction | `scripts/spec-extract/wbi-as-issue2.json` |
| Seed generator (byte-identical re-runs) | `scripts/spec-extract/generate-wbi-as-seed.ts` |
| Specification seed | `supabase/seed/012_ial_as_biology_specification.sql` |
| Lifecycle seed | `supabase/seed/013_ial_as_biology_official_spec_verification.sql` |
| Pre-apply test suite (91 checks) | `scripts/exam-seed/__tests__/spec-wbi-as.test.ts` |
| Mapping validator (dry-run) + example + suite | `scripts/spec-extract/validate-wbi-as-mapping.ts`, `wbi-as-mapping-fixture.example.json`, `scripts/exam-seed/__tests__/spec-wbi-as-mapping-validator.test.ts` |
| Live-DB gate (`--baseline` / default / `--verified`) | `scripts/db-checks/ial-as-biology-spec-verify.ts` |
| Service 2 handoff | `docs/ial-as-biology-question-bank-mapping-handoff.md` |
