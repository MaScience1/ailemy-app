# IGCSE Physics (4PH1) → Question Bank mapping — Service 2 handoff

Written 2026-09-06 by Service 3 (Mastery); updated the same day once seeds
010/011 were **owner-applied and verified in production** — the Physics
specification is now live (30 topics / 195 points / 48 P-suffix, all
live + verified_at set), so the production vocabulary a mapping validates
against exists. This document is the complete contract for the FUTURE
mapping work. Service 3 has deliberately written **zero**
`question_spec_points` rows; everything below is preparation, not action.
The remaining gate before mapping is transcription (§5 step 2 — there are
still no `paper_questions` rows to attach to).

## 1. Canonical identities (do not re-derive these)

| Thing | Value |
|---|---|
| Course slug (the ONLY safe join key) | `edexcel-igcse-physics` |
| Course UUID (production, informational) | `e63ebefd-1936-4344-9947-2fbc49bfdc66` |
| Qualification | Pearson Edexcel International GCSE Physics **4PH1**, Specification **Issue 4** (© Pearson 2024) |
| Source PDF sha256 | `bac4b8312d4fbfc84672f909100d66b2b3cda0b25e98c0d11bbc7366dae482b2` |
| Specification vocabulary | **195 points** on 30 topics — canonical list: `scripts/spec-extract/4ph1-issue4.json` (`points[].code`) |
| Paper-2-only marker | **`P` suffix in the code itself** (48 of 195). No schema field exists or is needed. |
| Production lifecycle | all 195 points `status='live'`, `verified_at` set (seeds 010 + 011, owner-applied and verified 2026-09-06) |

## 2. Canonical tables — and the trap that already fired once

The question table is **`paper_questions`**. There is **no `questions`
table** — that name was once reconstructed from an RLS alias and reached an
owner-run query before failing read-only. The real chain:

```
question_spec_points.question_id → paper_questions.id
paper_questions.paper_id         → past_papers.id
past_papers.course_id            → courses.id  (slug = 'edexcel-igcse-physics')
```

`question_spec_points` (migration 0035): textual `spec_code`, optional
denormalised `spec_text`, `display_order`, UNIQUE `(question_id, spec_code)`,
write access staff-gated by RLS, student reads only via live papers.

## 3. Course scoping — the non-negotiable

Physics codes collide textually with IGCSE Chemistry, IGCSE Biology and IAL
Chemistry (`1.1`, `2.1`, `3.1` … vs `2.5B`, `1.5C`) **by design** — and
Physics adds its own wrinkle: plain `1.2` does not exist in 4PH1 at all (the
document defines it only as `1.2P`), so a "matching" plain code from a
sibling course can be doubly wrong here. Therefore:

- Never resolve a spec code globally. A mapping row is valid only because
  its `question_id` reaches the Physics course through the chain above AND
  its `spec_code` is one of the 195 in the canonical vocabulary.
- Never copy a mapping between courses because "the code matches".
- The mastery engine independently discards foreign codes per course
  (`ignoredRows`), so a bad mapping quietly weakens coverage rather than
  crashing — which is exactly why the validator must catch it *before* rows
  exist.

## 4. Mechanical validation (already built, dry-run only)

`scripts/spec-extract/validate-4ph1-mapping.ts` + fixture template
`4ph1-mapping-fixture.example.json` + suite
`spec-4ph1-mapping-validator.test.ts` (20 checks). The validator is pure
and DB-less; it refuses:

- any code outside the canonical 195 (this also catches every cross-course
  code — a Chemistry `1.5C` or Biology `2.5B` is malformed for Physics by
  shape alone, and a plain `1.2` fails the vocabulary check);
- malformed codes / malformed P suffixes;
- duplicate `(question, code)` pairs (0035's UNIQUE, caught pre-apply);
- **a P-suffix code on a Paper 1 (1P/1PR) question** — officially
  impossible: Paper 1 "assesses core content that is not in bold and does
  not have a 'P' reference" (spec pp.1, 8-9);
- wrong course/paper/component/session shapes, empty fixtures.

Non-fatal review flags: a question mapped to more than 4 codes is reported
for human re-check (multi-point questions are intentional and supported).

**Ordering contract:** the fixture's `specCodes` array order IS the intended
`display_order` (0-based). Apply tooling must write it from array position.

**Physics-specific transcription note:** a large share of 4PH1 marks are
calculation questions whose mark schemes credit substitution, rearrangement
and evaluation of a spec-point relationship ("know and use the relationship
…"). Map the calculation to the relationship-bearing point; use the
fixture's `note` field to record which relationship the working exercises.
The seeded `description` carries each relationship in deterministic inline
form (e.g. `v² = u² + (2 × a × s)`, `p₁/T₁ = p₂/T₂`), so `spec_text`
denormalisation, if used, inherits faithful equations for free.

## 5. Safe mapping procedure (when Service 2 takes this up)

1. Confirm seeds 010 + 011 are applied and `igcse-4ph1-spec-verify.ts
   --verified` passes (or the owner-run equivalent in the runbook).
2. Transcribe the paper's questions into `paper_questions` first (mapping
   has nothing to attach to until then — see §6 state).
3. A human reads question + mark scheme and writes a fixture
   (`4ph1-mapping-fixture.example.json` shape). **No AI-guessed mappings.**
4. Run the validator; fix every refusal; review every ambiguity flag.
5. Dry-run first: the future apply step must print the exact INSERTs
   (question_id, spec_code, spec_text, display_order) and row count before
   any `--commit`, following `seed-exam-questions.ts` conventions
   (dry-run default, explicit `--commit`, journal-and-compensate).
6. Idempotency: `ON CONFLICT (question_id, spec_code) DO NOTHING` — a rerun
   must not duplicate or reorder existing rows.
7. Post-apply read-only check: mapped-pair count per paper equals the
   fixture's, zero rows join to any non-Physics course.

## 6. Current state (2026-09-06)

| Fact | Value | Basis |
|---|---|---|
| Physics `past_papers` rows | **50**, all `live` (15×1P, 10×1PR, 15×2P, 10×2PR) | VERIFIED, read-only anon probe |
| Sessions in production | Jun 2019; Jan 2020–23; Jun 2021–25; Nov 2020, 2021, 2023, 2024, 2025 — 15 sessions | VERIFIED |
| Mark schemes / examiner reports | **50 / 48** attached (PDFs, unstructured; two ERs missing, matching the disk census) | VERIFIED |
| Archive corpus on disk | 50 QU paper/sessions + SAM (excluded by policy); census `docs/import-reports/census-20260829-130922.md` | census |
| `paper_questions` for Physics | expected **0** — no transcription has run (no import report mentions Physics transcription) | repo-verified; live count anon-BLOCKED |
| `question_spec_points` for Physics | expected **0** | anon-BLOCKED; owner query below |
| Questions with/without usable text, calculation/equation share, image-only, multipart, numbering anomalies | **BLOCKED** until transcription exists — there are no question rows to audit | — |

Live-count query for Service 2 to run first:

```sql
SELECT count(*) AS phys_paper_questions
  FROM paper_questions pq
  JOIN past_papers pp ON pp.id = pq.paper_id
  JOIN courses c ON c.id = pp.course_id
 WHERE c.slug = 'edexcel-igcse-physics';
```

## 7. Recommended starting point

**June 2019 series, Paper 1P then 2P** (`4PH1_1P_0619`, `4PH1_2P_0619`):
first live assessment of exactly this specification, QU+MS+ER all present,
and starting with Paper 1 exercises the P-suffix refusal immediately (any
P-code in a 1P fixture is definitionally an error, so the guard proves
itself on day one).

## 8. Acceptance criteria for the first mapped paper

- validator: zero refusals, all ambiguity flags human-reviewed;
- every mapped code ∈ the 195; every Paper 1 mapping non-P;
- dry-run output reviewed by the owner before any commit;
- post-apply: pair counts match the fixture; zero cross-course joins;
- mastery smoke check: a marked attempt on that paper produces evidence
  rows that bucket into Physics topics only (Service 3 will verify this
  with the existing exam-evidence path — ask when ready).
