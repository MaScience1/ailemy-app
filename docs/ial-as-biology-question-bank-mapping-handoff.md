# IAL AS Biology (WBI11–WBI13) → Question Bank mapping — Service 2 handoff

Written 2026-09-06 by Service 3 (Mastery), Phase 2; updated the same day
once seeds 012/013 were **owner-applied and verified in production** — the
AS Biology specification is now live (4 unit-linked topics / 80 points,
38/42 per unit, 9 core practicals, all live + verified_at set), so the
production vocabulary a mapping validates against exists. This document is
the complete contract for the FUTURE mapping work. Service 3 has
deliberately written **zero** `question_spec_points` rows; everything below
is preparation, not action. The remaining gate before mapping is
transcription (§5 step 2 — there are **zero** `paper_questions` rows for
any Biology paper today, verified read-only).

## 1. Canonical identities (do not re-derive these)

| Thing | Value |
|---|---|
| Course slug (the ONLY safe join key) | `edexcel-ial-as-biology` |
| Course UUID (production, informational) | `cef65cb4-29d6-452c-99d6-95f9921583c5` |
| A2 sibling (NEVER a mapping target here) | `edexcel-ial-a2-biology` (`33f8d079-f661-499d-88d0-b17659105092`) |
| Qualification | Pearson Edexcel International Advanced Subsidiary in Biology **XBI11** (IAL **YBI11**), Specification **Issue 2**, February 2021 |
| Source PDF sha256 | `9197bf761e06353b492fa04ee3ac4352a02e7e5baf56f277782f4ca0f53d2703` |
| Specification vocabulary | **80 points** on 4 topics (Topics 1–2 = Unit 1, Topics 3–4 = Unit 2) — canonical list: `scripts/spec-extract/wbi-as-issue2.json` (`points[].code`) |
| Unit marker | carried by the TOPIC prefix of the code itself: `1.x`/`2.x` = Unit 1 (WBI11), `3.x`/`4.x` = Unit 2 (WBI12). No letter suffixes exist at IAL. |
| Units in production | `unit-1`=WBI11, `unit-2`=WBI12, `unit-3`=WBI13 (existing rows; papers are unit-linked via `past_papers.unit_id`) |
| Production lifecycle | all 80 points `status='live'`, `verified_at` set (seeds 012 + 013, owner-applied and verified 2026-09-06) |

## 2. Canonical tables — and the trap that already fired once

The question table is **`paper_questions`**. There is **no `questions`
table** — that name was once reconstructed from an RLS alias and reached an
owner-run query before failing read-only. The real chain:

```
question_spec_points.question_id → paper_questions.id
paper_questions.paper_id         → past_papers.id
past_papers.course_id            → courses.id  (slug = 'edexcel-ial-as-biology')
past_papers.unit_id              → units.id    (WBI11/WBI12/WBI13)
```

`question_spec_points` (migration 0035): textual `spec_code`, optional
denormalised `spec_text`, `display_order`, UNIQUE `(question_id, spec_code)`,
write access staff-gated by RLS, student reads only via live papers.

## 3. Course AND unit scoping — the non-negotiables

IAL AS Biology codes collide textually with IGCSE Chemistry, IGCSE Biology,
IGCSE Physics and IAL Chemistry (`1.1`, `2.6`, `4.17` …) **by design**, and
this course adds the repository's first UNIT dimension inside one mapping
vocabulary:

- Never resolve a spec code globally. A mapping row is valid only because
  its `question_id` reaches THIS course through the chain above AND its
  `spec_code` is one of the 80 in the canonical vocabulary.
- Never copy a mapping between courses because "the code matches" — and
  never between AS and A2: Topics 5–8 belong to `edexcel-ial-a2-biology`,
  which holds **no vocabulary at all yet**; any `5.x`–`8.x` code in an AS
  fixture is a hard error.
- **The unit rule (spec pp.6–7):** WBI11 assesses Topics 1–2 only; WBI12
  assesses Topics 3–4 only. A Topic 3/4 code on a WBI11 question contradicts
  the official document and is always a mistake. **WBI13 is the deliberate
  exception**: the practical paper "will assess students' knowledge and
  understanding of experimental procedures and techniques that were
  developed in Units 1 and 2" (spec p.25), so ANY Topic 1–4 code is
  legitimate there — WBI13 resolves through the same AS vocabulary, never a
  fabricated Unit 3 syllabus (owner decision, Phase 2 approval).
- The mastery engine independently discards foreign codes per course
  (`ignoredRows`), so a bad mapping quietly weakens coverage rather than
  crashing — which is exactly why the validator must catch it *before* rows
  exist.

## 4. Mechanical validation (already built, dry-run only)

`scripts/spec-extract/validate-wbi-as-mapping.ts` + fixture template
`wbi-as-mapping-fixture.example.json` + suite
`spec-wbi-as-mapping-validator.test.ts` (23 checks). The validator is pure
and DB-less; it refuses:

- any code outside the canonical 80 (this also catches every cross-course
  code — `1.5C`, `2.5B`, `1.2P` are malformed for IAL Biology by shape
  alone);
- **any A2 code (`5.x`–`8.x`)** — named as IA2 content, not merely
  "unknown";
- malformed code shapes;
- duplicate `(question, code)` pairs (0035's UNIQUE, caught pre-apply);
- **a cross-unit code on a content paper** (Topic 3/4 on WBI11, Topic 1/2
  on WBI12) — while accepting all of Topics 1–4 on WBI13, tested in both
  directions so the rule can neither under- nor over-fire;
- an A2 paper code (WBI14–16), a sibling paper code, wrong course, bad
  session shapes (MMYY with MM ∈ 01/06/10/11 — the archive's own naming),
  empty fixtures.

Non-fatal review flags: a question mapped to more than 4 codes is reported
for human re-check (multi-point questions are intentional and supported).

**Ordering contract:** the fixture's `specCodes` array order IS the intended
`display_order` (0-based). Apply tooling must write it from array position.

**Biology-specific transcription notes:**
- Sub-pointed statements ((i)/(ii)/…) are ONE spec point (owner decision):
  a question assessing 2.6(iii) maps to `2.6`; use the fixture's `note`
  field to record the sub-point if useful. Never invent codes like
  `2.6(iii)` or `2.6iii`.
- Core practicals are ordinary coded points (CP1=`1.3`, CP2=`1.14`,
  CP3=`2.3`, CP4=`2.8`, CP5=`3.8`, CP6=`3.15`, CP7=`4.6`, CP8=`4.9`,
  CP9=`4.12`) — a WBI13 question about Benedict's-reagent estimation maps
  to `1.3`.
- The seeded `description` carries faithful official wording (β, Σ, the two
  built formulae inline, the Issue 2 typo in 3.5(ii) preserved verbatim), so
  `spec_text` denormalisation, if used, inherits fidelity for free.

## 5. Safe mapping procedure (when Service 2 takes this up)

1. Confirm seeds 012 + 013 are applied and `ial-as-biology-spec-verify.ts
   --verified` passes (or the owner-run equivalent in the runbook).
2. Transcribe the paper's questions into `paper_questions` first (mapping
   has nothing to attach to until then — see §6 state).
3. A human reads question + mark scheme and writes a fixture
   (`wbi-as-mapping-fixture.example.json` shape). **No AI-guessed mappings.**
4. Run the validator; fix every refusal; review every ambiguity flag.
5. Dry-run first: the future apply step must print the exact INSERTs
   (question_id, spec_code, spec_text, display_order) and row count before
   any `--commit`, following `seed-exam-questions.ts` conventions
   (dry-run default, explicit `--commit`, journal-and-compensate).
6. Idempotency: `ON CONFLICT (question_id, spec_code) DO NOTHING` — a rerun
   must not duplicate or reorder existing rows.
7. Post-apply read-only check: mapped-pair count per paper equals the
   fixture's, zero rows join to any non-AS-Biology course, and per-paper
   unit legality (the §3 rule) holds over the applied rows.

## 6. Current state (2026-09-06, verified read-only via anon probes)

| Fact | Value | Basis |
|---|---|---|
| AS Biology `past_papers` rows | **48**, all `live` (20 WBI11/01, 19 WBI12/01, 9 WBI13/01), every row unit-linked, durations/marks matching the spec (90/80, 90/80, 80/50) | VERIFIED |
| Sessions in production | WBI11: Jan 2019–25, M/J 2019 + 2021–25, O/N 2019–25 (20). WBI12: same shape minus Jan 2019 (19). WBI13: **2023–25 only** (9) | VERIFIED |
| Mark schemes | **48/48** attached | VERIFIED |
| Examiner reports | **44/48** (WBI11 18/20, WBI12 17/19, WBI13 9/9) | VERIFIED |
| A2 papers (out of scope, present for completeness) | 42 (17/16/9), all live, unit-linked | VERIFIED |
| `paper_questions` for AS Biology | **0** across all 48 papers — no transcription has ever run | VERIFIED (live count) |
| `question_spec_points` for AS Biology | **0 by construction** (no question rows exist; direct anon read is 401 by design — 0035 revokes anon) | VERIFIED |
| Questions with/without usable text, image-heavy, multipart, numbering anomalies | **BLOCKED** until transcription exists — there are no question rows to audit | — |

### The WBI13 corpus gap (separate evidence issue — do not block on it)

Unit 3 was first assessed **June 2019** (spec p.25), but the archive holds
WBI13 sittings for **2023–2025 only** (9 papers); 2019–2022 sittings are
absent from the source tree the bulk import walked (`docs/import-reports/`
census). This affects transcription/mapping breadth for the practical paper
ONLY — it does not touch the specification seed (Unit 3 defines no spec
content) or WBI11/WBI12 coverage. Follow-up (owner/Service 2): check whether
the "International edexcel from 2018" archive has a WBI13 folder that
predates 2023, or source those sittings from Pearson; if they genuinely
cannot be sourced, record that in the import census so the gap is a known
fact rather than a silent hole. Do NOT fabricate rows to close it.

## 7. Recommended starting point

**January 2019 series, WBI11/01** (`WBI11_01_0119`): the first live
assessment of exactly this specification, QU+MS present, and a Unit 1
content paper exercises the cross-unit refusal immediately (any Topic 3/4
code in a WBI11 fixture is definitionally an error, so the guard proves
itself on day one). Follow with WBI12 June 2019, then a 2023 WBI13 to
exercise the practical paper's all-topics rule.

## 8. Acceptance criteria for the first mapped paper

- validator: zero refusals, all ambiguity flags human-reviewed;
- every mapped code ∈ the 80; every WBI11 mapping in Topics 1–2, every
  WBI12 mapping in Topics 3–4; zero `5.x`–`8.x` anywhere;
- dry-run output reviewed by the owner before any commit;
- post-apply: pair counts match the fixture; zero cross-course joins;
- mastery smoke check: a marked attempt on that paper produces evidence
  rows that bucket into AS Biology topics only — and into the correct UNIT
  via the topic (Service 3 will verify this with the existing exam-evidence
  path — ask when ready).
