# IGCSE Biology (4BI1) → Question Bank mapping — Service 2 handoff

Written 2026-09-06 by Service 3 (Mastery), at the point where the Biology
specification is live and verified in production. This document is the
complete contract for the FUTURE mapping work. Service 3 has deliberately
written **zero** `question_spec_points` rows; everything below is
preparation, not action.

## 1. Canonical identities (do not re-derive these)

| Thing | Value |
|---|---|
| Course slug (the ONLY safe join key) | `edexcel-igcse-biology` |
| Course UUID (production, informational) | `35702dec-b1b9-487f-b74e-2b99500af285` |
| Qualification | Pearson Edexcel International GCSE Biology **4BI1**, Specification **Issue 3** (© Pearson 2024) |
| Source PDF sha256 | `9f474a0ef0e93ef3c3107b568956d163454cdb476bb2017189e8dd12c0d58cef` |
| Specification vocabulary | **176 points** on 22 topics — canonical list: `scripts/spec-extract/4bi1-issue3.json` (`points[].code`) |
| Paper-2-only marker | **`B` suffix in the code itself** (42 of 176). No schema field exists or is needed. |
| Production lifecycle | all 176 points `status='live'`, `verified_at` set (seeds 008 + 009, applied 2026-09-05/06) |

## 2. Canonical tables — and the trap that already fired once

The question table is **`paper_questions`**. There is **no `questions`
table** — that name was once reconstructed from an RLS alias and reached an
owner-run query before failing read-only. The real chain:

```
question_spec_points.question_id → paper_questions.id
paper_questions.paper_id         → past_papers.id
past_papers.course_id            → courses.id  (slug = 'edexcel-igcse-biology')
```

`question_spec_points` (migration 0035): textual `spec_code`, optional
denormalised `spec_text`, `display_order`, UNIQUE `(question_id, spec_code)`,
write access staff-gated by RLS, student reads only via live papers.

## 3. Course scoping — the non-negotiable

Biology codes collide textually with IGCSE Chemistry and IAL Chemistry
(`1.1`, `2.1`, `2.5B` vs `1.5C`, …) **by design**. Therefore:

- Never resolve a spec code globally. A mapping row is valid only because
  its `question_id` reaches the Biology course through the chain above AND
  its `spec_code` is one of the 176 in the canonical vocabulary.
- Never copy a mapping between courses because "the code matches".
- The mastery engine independently discards foreign codes per course
  (`ignoredRows`), so a bad mapping quietly weakens coverage rather than
  crashing — which is exactly why the validator must catch it *before* rows
  exist.

## 4. Mechanical validation (already built, dry-run only)

`scripts/spec-extract/validate-4bi1-mapping.ts` + fixture template
`4bi1-mapping-fixture.example.json` + suite
`spec-4bi1-mapping-validator.test.ts` (17 checks). The validator is pure
and DB-less; it refuses:

- any code outside the canonical 176 (this also catches every cross-course
  code — a Chemistry `1.5C` is malformed for Biology by shape alone);
- malformed codes / malformed B suffixes;
- duplicate `(question, code)` pairs (0035's UNIQUE, caught pre-apply);
- **a B-suffix code on a Paper 1 (1B/1BR) question** — officially
  impossible: Paper 1 "assesses core content that is not in bold and does
  not have a 'B' reference" (spec pp.1, 7-8);
- wrong course/paper/component/session shapes, empty fixtures.

Non-fatal review flags: a question mapped to more than 4 codes is reported
for human re-check (multi-point questions are intentional and supported).

**Ordering contract:** the fixture's `specCodes` array order IS the intended
`display_order` (0-based). Apply tooling must write it from array position.

## 5. Safe mapping procedure (when Service 2 takes this up)

1. Transcribe the paper's questions into `paper_questions` first (mapping
   has nothing to attach to until then — see §6 state).
2. A human reads question + mark scheme and writes a fixture
   (`4bi1-mapping-fixture.example.json` shape). **No AI-guessed mappings.**
3. Run the validator; fix every refusal; review every ambiguity flag.
4. Dry-run first: the future apply step must print the exact INSERTs
   (question_id, spec_code, spec_text, display_order) and row count before
   any `--commit`, following `seed-exam-questions.ts` conventions
   (dry-run default, explicit `--commit`, journal-and-compensate).
5. Idempotency: `ON CONFLICT (question_id, spec_code) DO NOTHING` — a rerun
   must not duplicate or reorder existing rows.
6. Post-apply read-only check: mapped-pair count per paper equals the
   fixture's, zero rows join to any non-Biology course.

## 6. Current state (2026-09-06)

| Fact | Value | Basis |
|---|---|---|
| Biology `past_papers` rows | **44** | owner-run production baseline |
| Archive corpus | 46 QU paper/sessions: 16×1B, 7×1BR, 16×2B, 7×2BR; Jan 2020–23, Jun 2019+21–25, Nov 2020–21+23–25; +4 SAM (excluded by policy) | census 2026-08-29 |
| Mark schemes / examiner reports | 44 / 42 (PDFs, unstructured) | census |
| `paper_questions` for Biology | expected **0** — no transcription has run (the only transcription writer covers WCH11) | repo-verified; live count BLOCKED from this worktree |
| `question_spec_points` for Biology | **0** | owner-run baseline |
| Questions with/without usable text, types, image-only, multipart, numbering anomalies | **BLOCKED** until transcription exists — there are no question rows to audit | — |

Live-count query for Service 2 to run first:

```sql
SELECT count(*) AS bio_paper_questions
  FROM paper_questions pq
  JOIN past_papers pp ON pp.id = pq.paper_id
  JOIN courses c ON c.id = pp.course_id
 WHERE c.slug = 'edexcel-igcse-biology';
```

## 7. Recommended starting point

**June 2019 series, Paper 1B then 2B** (`4BI1_1B_0619`, `4BI1_2B_0619`):
first live assessment of exactly this specification, QU+MS+ER all present,
and starting with Paper 1 exercises the B-suffix refusal immediately (any
B-code in a 1B fixture is definitionally an error, so the guard proves
itself on day one).

## 8. Acceptance criteria for the first mapped paper

- validator: zero refusals, all ambiguity flags human-reviewed;
- every mapped code ∈ the 176; every Paper 1 mapping non-B;
- dry-run output reviewed by the owner before any commit;
- post-apply: pair counts match the fixture; zero cross-course joins;
- mastery smoke check: a marked attempt on that paper produces evidence
  rows that bucket into Biology topics only (Service 3 will verify this
  with the existing exam-evidence path — ask when ready).
