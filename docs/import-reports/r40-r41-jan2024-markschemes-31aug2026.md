# R40/R41 — the Algolia checks, and the 22 January-2024 mark schemes

`queue.json` is not a faithful record of what Pearson exposes. It has two proven
defects: it stored unencoded URLs, which cost 913 components a network request
they never made, and it omitted 22 January-2024 mark schemes that the very index
it was built from does list. Every "absence" previously inferred from the
queue's silence therefore had to be rechecked against the index directly.

Credentials came from Pearson's own past-papers page, in plain hidden inputs:

    algoliaAppId     L639T95U5A
    algoliaAPIKey    f79c7a8352e9ffbdaec387bf43612ee6
    algoliaIndexName qualifications-uk_LIVE_master-content

That is the public, search-only key shipped to every visitor.

## R40 — January 2024 IAL Maths and English mark schemes: ALL 22 ARE LISTED

Every one of the 22 codes lists exactly three January-2024 documents, and one of
each three is a mark scheme, all published 20240307:

    wma11-01-que-20240110.pdf   Question-paper
    wma11-01-pef-20240307.pdf   Examiner-report
    wma11-01-rms-20240307.pdf   Mark-Scheme     <- never queued

⚠ THE FIRST READ OF THIS SAID ZERO OF 22, AND IT WAS WRONG TWICE OVER.

  1. **Truncation.** 21 of 22 queries came back capped at `hitsPerPage=200`
     against `nbHits` of 382-806. A zero read off a truncated window is the trap
     this index has sprung three times in this project.
  2. **A basename regex.** The check required `_rms_` with underscores. These
     URLs are hyphenated — `wma11-01-rms-20240307.pdf` — so it could not have
     matched a mark scheme even had one been in the window.

What caught it was testing whether the absence was MEANINGFUL rather than
reporting it: January-2024 documents were present for every code, three apiece,
a full complement. A genuinely missing series shows zero, not three. Reporting
the first read would have confirmed R37 on a regex bug and closed 22 recoverable
papers for good.

## R41 — two more whole-session absences, both REAL

Same method, corrected: `hitsPerPage=1000` (0 of 22 truncated), matching on
`Document-Type`, never on filenames, and series labels read from the facet list
rather than guessed.

**October-November 2019 question papers — 0.** The series is tagged
`October-2019`; there is no `November-2019`. Six codes have documents, exactly
the six the queue holds, each carrying Mark-scheme and Examiner-report and no
Question-paper.

**May-June 2021 examiner reports — 0.** Tagged `June-2021`. All 22 codes have
documents, each carrying Mark-scheme and Question-paper, none an Examiner-report.

Both zeros are evidence rather than an empty window, because the sibling
document types are present for every code. **The queue was faithful for these
two sessions** — which narrows the discovery defect to the January-2024 mark
schemes specifically rather than leaving it open-ended.

Two index quirks, either of which would have produced a false zero: `June 2019`
exists alongside `June-2019` with a space, and Document-Type appears as both
`Mark-scheme` and `Mark-Scheme`. All matching was case-insensitive.

## The recovery run

Queued from the R40/R41 URL lists, not `queue.json`. R41 contributed nothing, so
the run was the 22 mark schemes. 3s spacing, `encode_path` applied.

    RUN END attempted=22 ok=22 failed=0 locked=0
    STOP: none — list exhausted

22 valid PDFs, 8-32 pages, 22 distinct MD5s, none quarantined, no strays.

⚠ THE R39 ROLLING RATE WAS INERT, NOT ACTIVE. Its window is 50 and the run was
22, so it could never fill and could never fire. The guards that actually
applied were the immediate 429/403/401 stops and the per-file validation. A
guard that cannot fire is not protection, and listing it as one would overstate
what protected this run.

`code_ok` came back `code only` for all 22. That is normal for mark schemes, not
a warning sign: 376 of the 422 mark schemes already accepted are `code only`,
against 46 `code+entry`.

## Stage E and G over the 22

**Gate 1 — watermark positive control, both halves.** Control was `WET04/01
unit-4-january-2023`, created 2026-08-31T18:24, one of the 289 imported earlier
today — and its mark scheme, matching the document type being imported.

| | pages | correct | misplaced | above_cropbox | already_correct |
| --- | --- | --- | --- | --- | --- |
| stamped, from the 289 | 22 | 22 | 0 | 0 | true |
| `WMA11_01_0124_MS.pdf`, just downloaded | 23 | 0 | 0 | 0 | false |

Coordinates exact: `x=506.31 want_x=506.31`, `y=824.04 want_y=824.04`. The
negative half is what rules out an inspector hardwired to return true, and every
per-file gate below reads that inspector's output.

**Gate 2 — dry run.** Predicted delta from the fixed planner's own dry run.

| subject | planned | already exists | clash |
| --- | --- | --- | --- |
| ial-mathematics | 11 | 219 | 21 |
| ial-english-language | 4 | 63 | 0 |
| ial-english-literature | 4 | 62 | 0 |
| ial-further-mathematics | 3 | 49 | 3 |
| **TOTAL** | **22** | 393 | 24 |

All 22 planned rows are January 2024. **0 R22 skips** for missing duration or
marks. **24 slug-clash skips, 0 new** — all the known entry variants.

**Gate 3 — the four batches**, each gated on `failed = 0` and an exact delta
match before the next began.

| batch | predicted | Done. | before -> after | actual |
| --- | --- | --- | --- | --- |
| ial-mathematics | 11 | 11 inserted, 0 already existed, 0 failed | 1487 -> 1498 | 11 |
| ial-further-mathematics | 3 | 3 inserted, 0 already existed, 0 failed | 1498 -> 1501 | 3 |
| ial-english-language | 4 | 4 inserted, 0 already existed, 0 failed | 1501 -> 1505 | 4 |
| ial-english-literature | 4 | 4 inserted, 0 already existed, 0 failed | 1505 -> 1509 | 4 |

**Gate 4 — per-file watermark gates.** 66 files stamped, inspected and
uploaded — 22 papers with all three components. Every one satisfied
`correct_pages == pages`, `misplaced = 0`, `above_cropbox = 0`. No blank page,
no page-count mismatch, no parse failure, nothing uploaded unverified.
**0 of the 5-failure ceiling used.**

## Where the corpus stands

    past_papers        1487 -> 1509   (+22)
    IAL Maths/English   393 ->  415   (+22)
    importable PDFs    2199 -> 2221   (+22)

| course | rows |
| --- | --- |
| edexcel-ial-a2-mathematics | 123 |
| edexcel-ial-as-mathematics | 107 |
| edexcel-ial-as-english-language | 35 |
| edexcel-ial-as-english-literature | 34 |
| edexcel-ial-a2-english-language | 32 |
| edexcel-ial-a2-english-literature | 32 |
| edexcel-ial-a2-further-mathematics | 29 |
| edexcel-ial-as-further-mathematics | 23 |
| **IAL total** | **415** |

All 22 January-2024 identities now hold QU, MS and ER. They were the largest
single block of the 48 incomplete papers; 26 of that 48 remain.

## Provenance — the 22 source URLs

Host `https://qualifications.pearson.com`.

    WMA11  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wma11-01-rms-20240307.pdf
    WMA12  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wma12-01-rms-20240307.pdf
    WMA13  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wma13-01-rms-20240307.pdf
    WMA14  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wma14-01-rms-20240307.pdf
    WME01  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wme01-01-rms-20240307.pdf
    WME02  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wme02-01-rms-20240307.pdf
    WME03  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wme03-01-rms-20240307.pdf
    WST01  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wst01-01-rms-20240307.pdf
    WST02  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wst02-01-rms-20240307.pdf
    WST03  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wst03-01-rms-20240307.pdf
    WDM11  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wdm11-01-rms-20240307.pdf
    WFM01  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wfm01-01-rms-20240307.pdf
    WFM02  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wfm02-01-rms-20240307.pdf
    WFM03  /content/dam/pdf/International-Advanced-Level/Mathematics/2018/Exam-materials/wfm03-01-rms-20240307.pdf
    WEN01  /content/dam/pdf/International-Advanced-Level/English-Language/2015/Exam-materials/wen01-01-rms-20240307.pdf
    WEN02  /content/dam/pdf/International-Advanced-Level/English-Language/2015/Exam-materials/wen02-01-rms-20240307.pdf
    WEN03  /content/dam/pdf/International-Advanced-Level/English-Language/2015/Exam-materials/wen03-01-rms-20240307.pdf
    WEN04  /content/dam/pdf/International-Advanced-Level/English-Language/2015/Exam-materials/wen04-01-rms-20240307.pdf
    WET01  /content/dam/pdf/International-Advanced-Level/English-Literature/2015/Exam-materials/wet01-01-rms-20240307.pdf
    WET02  /content/dam/pdf/International-Advanced-Level/English-Literature/2015/Exam-materials/wet02-01-rms-20240307.pdf
    WET03  /content/dam/pdf/International-Advanced-Level/English-Literature/2015/Exam-materials/wet03-01-rms-20240307.pdf
    WET04  /content/dam/pdf/International-Advanced-Level/English-Literature/2015/Exam-materials/wet04-01-rms-20240307.pdf