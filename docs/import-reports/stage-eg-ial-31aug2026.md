# Stage E and G — the 289 recovered IAL papers, 31 August 2026

The R39 recovery brought 903 of the 913 components down and took the corpus from
417 to 706 complete identities. 289 of those became newly complete and are
imported here. `past_papers` 1198 -> 1487.

## Gate 1 — watermark positive control

Run against a file from last night's 409, never an arbitrary live paper:
`WFM02/01 unit-1-may-june-2025`, created 2026-08-31T05:32, pulled back out of the
`papers` bucket.

| | correct_pages | already_correct | misplaced | above_cropbox |
| --- | --- | --- | --- | --- |
| known-stamped control | 32 / 32 | true | 0 | 0 |
| raw source, never stamped | 0 / 32 | false | 0 | 0 |

Sample coordinates matched the locked spec exactly — `x=534.37 want_x=534.37`,
`y=852.24 want_y=852.24`.

⚠ BOTH HALVES ARE THE CONTROL. Checking only the stamped file would pass with an
inspector hardwired to return true, and every per-file gate downstream reads its
output. The negative half is what makes the positive half mean anything.

## Gate 2 — dry run

Predicted delta taken from the fixed planner's own dry run, not computed
arithmetically. It agreeing with the 289 from the recovery is a real check: the
two numbers come from different places — one from the manifest and the disk, the
other from the planner resolving against the live database.

| subject | planned | already exists | clash |
| --- | --- | --- | --- |
| ial-mathematics | 159 | 60 | 21 |
| ial-english-language | 47 | 16 | 0 |
| ial-english-literature | 46 | 16 | 0 |
| ial-further-mathematics | 37 | 12 | 3 |
| gce-* (five subjects) | 0 | 305 | 0 |
| **TOTAL** | **289** | 409 | 24 |

UK GCE planned nothing, correctly: 319 of the 322 recovered identities were IAL,
and the three UK ones were ER-only components that stay partial.

**Slug-clash skips: 24 files, zero new.** All are the known entry variants —
WMA11/01A and /01R, WMA12/01A and /01R, WMA13/01A, WMA14/01A, WME02/01A,
WFM02/01A. The composite-key fix from R34 holds; nothing new appeared.

**R22 check: 0 skips for missing duration or marks.** No code reached the planner
without confirmed metadata.

## Gate 3 — the four batches

Each batch ran under a driver that aborted the chain on a non-zero `failed`, a
non-zero exit, or a delta that did not match its prediction. The gate was
mechanical rather than a matter of noticing.

| batch | predicted | Done. | before -> after | actual delta |
| --- | --- | --- | --- | --- |
| ial-mathematics | 159 | 159 inserted, 0 already existed, 0 failed | 1198 -> 1357 | 159 |
| ial-further-mathematics | 37 | 37 inserted, 0 already existed, 0 failed | 1357 -> 1394 | 37 |
| ial-english-language | 47 | 47 inserted, 0 already existed, 0 failed | 1394 -> 1441 | 47 |
| ial-english-literature | 46 | 46 inserted, 0 already existed, 0 failed | 1441 -> 1487 | 46 |

Every batch: `failed = 0`, actual delta equal to prediction.

## Gate 4 — per-file watermark gates

843 files stamped, inspected and uploaded. Every one satisfied
`correct_pages == pages`, `misplaced = 0`, `above_cropbox = 0`. No blank page, no
page-count mismatch, no parse failure, nothing uploaded unverified.

**0 of the 5-failure ceiling used.**

## Where the corpus stands

    past_papers        1198 -> 1487   (+289)
    IAL Maths/English   104 ->  393   (+289)

| course | rows |
| --- | --- |
| edexcel-ial-a2-mathematics | 117 |
| edexcel-ial-as-mathematics | 102 |
| edexcel-ial-as-english-language | 33 |
| edexcel-ial-as-english-literature | 32 |
| edexcel-ial-a2-english-language | 30 |
| edexcel-ial-a2-english-literature | 30 |
| edexcel-ial-a2-further-mathematics | 27 |
| edexcel-ial-as-further-mathematics | 22 |
| **IAL total** | **393** |

## The 10 components that never landed, and the 9 identities they block

Unchanged by this import — they were never available to plan.

**CODE_NOT_IN_PDF (7)**, all question papers, six of seven May-June:
`WEN04|1|2019`, `WET04|1|2019`, `WFM02|1|2015`, `WFM02|1|2019`, `WFM03|1|2015`,
`WME03|1|2019`, `WST02|1|2019`.

**HTTP_502 (2)**: `WEN01|1|January|2017|MS`, `WEN01|1|January|2021|ER`.

**NOT_A_PDF (1)**: `WST03|1|January|2022|MS`.

The nine identities each blocked by one of those:

    WEN01|1|January|2017      have ER,QU   MS 502
    WST03|1|January|2022      have ER,QU   MS not a PDF
    WEN04|1|May-June|2019     have ER,MS   QU code-not-in-pdf
    WET04|1|May-June|2019     have ER,MS   QU code-not-in-pdf
    WFM02|1|May-June|2015     have ER,MS   QU code-not-in-pdf
    WFM02|1|May-June|2019     have ER,MS   QU code-not-in-pdf
    WFM03|1|May-June|2015     have ER,MS   QU code-not-in-pdf
    WME03|1|May-June|2019     have ER,MS   QU code-not-in-pdf
    WST02|1|May-June|2019     have ER,MS   QU code-not-in-pdf

289 imported + 9 blocked = the 298 the projection called.
