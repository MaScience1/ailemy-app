# R46, R47, R48 — the nine untested, and the twenty-six that are closed

`past_papers` 1517 -> 1523. Eight of the nine untested files were the documents
they claimed to be and are imported. One is not, and it is not a code mismatch.

## R46 — what each of the nine covers ACTUALLY SHOWS

Page 1 rasterised at 150dpi and read, the same method that read 3 of 3 correctly
under R44. Note the nine are **7 question papers and 2 examiner reports**, not
three examiner reports.

| file | what page 1 shows | verdict |
| --- | --- | --- |
| 9el0-02-pef-20240815 | Examiners' Report June 2024 — GCE English Language & Literature **9EL0 02** | matches |
| 9et0-01-pef-20240815 | Examiners' Report June 2024 — GCE English Literature **9ET0 01** | matches |
| WFM02_01_que_20150603 | Paper Reference **WFM02/01**, Further Pure Mathematics F2, Wed 3 June 2015, P44832A | matches |
| WFM03_01_que_20150622 | Paper Reference **WFM03/01**, Further Pure Mathematics F3, Mon 22 June 2015, P44834A | matches |
| WET04_01_que_20190626 | Paper Reference **WET04/01**, English Literature Unit 4: Shakespeare and Pre-1900 Poetry, Mon 3 June 2019, P56544A | matches |
| WFM02_01_que_20190604 | Paper Reference **WFM02/01**, Further Pure Mathematics F2, Mon 3 June 2019, P56487A | matches |
| WME03_01_que_20190516 | Paper Reference **WME03/01**, Mechanics M3, Wed 15 May 2019, P55874A | matches |
| WST02_01_que_20190625 | Paper Reference **WST02/01**, Statistics S2, Mon 24 June 2019, P54640A | matches |
| **WEN04_01_que_20190626** | Paper Reference **WEN04/01**, English Language Unit 4: Investigating Language, Thu 6 June 2019, P56538A — **"Source Booklet. Do not return this Source Booklet with the question paper."** | **HELD** |

⚠ THE NINTH IS A SOURCE BOOKLET, AND THE THREE-WAY RULE DOES NOT COVER IT. The
code is visible and it MATCHES the assigned name, which by the rule means
accept. But the document is the source booklet that accompanies WEN04/01, not
the question paper. Importing it would put a booklet of source texts in the
`paper_pdf_path` slot of an exam paper. It is neither a code mismatch nor an
unreadable cover, so it was held and reported rather than decided.

**R49 — HOLD UPHELD.** `WEN04_01_que_20190626.pdf` stays in quarantine under its
ORIGINAL name, with the reason `SOURCE_BOOKLET_NOT_QUESTION_PAPER`. It was never
renamed to a canonical target and never entered the staging root, so no canonical
name was ever minted for a document that could not carry it. md5
`fa368109a7607d9688f6e08f42d7022c`, 2,630,377 bytes.

The two examiner reports are real reports, not stubs — the same font-encoding
fault that made them unreadable to `code_in_pdf` had nothing to do with their
content.

## The import

Gate 1, both halves, control `9FM0/3C 9fm0-3c-may-june-2019` from the batch
imported minutes earlier: 28/28 correct against 0/28 on `WME03_01_0619_QU.pdf`.

| batch | predicted | Done. | before -> after |
| --- | --- | --- | --- |
| ial-mathematics | 2 | 2 inserted, 0 already existed, 0 failed | 1517 -> 1519 |
| ial-further-mathematics | 3 | 3 inserted, 0 already existed, 0 failed | 1519 -> 1522 |
| ial-english-literature | 1 | 1 inserted, 0 already existed, 0 failed | 1522 -> 1523 |

18 files stamped, all `correct_pages == pages`, `misplaced = 0`,
`above_cropbox = 0`, 0 of the 5-failure ceiling.

⚠ THE TWO EXAMINER REPORTS ARE ON DISK BUT NOT ATTACHED. Both plan zero rows:
9EL0/02 and 9ET0/01 May-June 2024 already exist in `past_papers`, and the
importer only creates rows — it has no path to attach a newly-recovered examiner
report to a paper already imported. They are correctly named and sitting in the
staging root. Recovered, not attached. That gap is not specific to these two.

## R47 — the 26 are NOT_PUBLISHED, and this is the first legitimate use

R25 held that `NOT_PUBLISHED` must read zero unless a Pearson notice sits in
quarantine as evidence. Twenty-six notices now do. Each is a one-page document
whose entire content is Pearson declining to publish.

**16 use the exact wording:**

> As there were insufficient entries for this paper, it has not been possible to
> provide detailed feedback to centres to benefit their candidates. Therefore,
> Pearson will not publish an Examiner's Report for this paper.

    8EL0_01_pef_20201217   8EL0_02_pef_20201217   8EN0_01_pef_20201217
    8EN0_02_pef_20201217   8ET0_01_pef_20201217   8ET0_02_pef_20201217
    9EL0_01_pef_20211216   9EL0_02_pef_20211216   9EN0_01_pef_20211216
    9EN0_02_pef_20211216   9EN0_03_pef_20211216   9EN0_04_pef_20201217
    9FM0_4A_pef_20211216   9FM0_4B_pef_20211216   9FM0_4C_pef_20211216
    9FM0_4D_pef_20211216

⚠ **10 USE VARIANT WORDING. AN EXACT-STRING MATCH WOULD HAVE MISSED ALL TEN** —
that is 38% of the class, silently reclassified as something else.

Eight spell it **"insuffiecient"** (Pearson's typo, not a transcription error
here):

    8FM0_22_pef_20201217   8FM0_24_pef_20201217   8FM0_26_pef_20201217
    8FM0_28_pef_20201217   9FM0_4A_pef_20201217   9FM0_4B_pef_20201217
    9FM0_4C_pef_20201217   9FM0_4D_pef_20201217

Two are a different notice entirely:

> This component was not available to candidates this session. Therefore,
> Pearson will not publish a Moderator's Report for this component.

    9EL0_03_pef_20201217   9EN0_01_pef_20201217

The notice text per file is recorded in `r47-not-published.json`. They stay
quarantined. **They are closed, not recovered** — there is no document to
recover, because Pearson published none.

## R48 — the hand-classified four are labelled as such

The broken-CID and garbled-extraction classes were separated **by hand, not by
the check**. `code_in_pdf` has no CID or mojibake detection and never will under
this ruling, so re-running it puts all four back into `text-without-code`:

    HAND-CLASSIFIED, broken CID font encoding
      9el0-02-pef-20240815     (now imported to disk as 9EL0_02_0624_ER.pdf)
      9et0-01-pef-20240815     (now 9ET0_01_0624_ER.pdf)

    HAND-CLASSIFIED, garbled extraction
      WFM02_01_que_20150603    (now WFM02_01_0615_QU.pdf)
      WFM03_01_que_20150622    (now WFM03_01_0615_QU.pdf)

    HAND-CLASSIFIED, source booklet — R49            <- third class
      WEN04_01_que_20190626    SOURCE_BOOKLET_NOT_QUESTION_PAPER, still
                               quarantined under its original name

⚠ THE THIRD CLASS IS THE ONE THE CHECK IS FURTHEST FROM SEEING. Broken encoding
and mojibake at least make `code_in_pdf` fail. The source booklet PASSES every
test it has: the code is present, extractable, and correct. Nothing in the
check's design distinguishes a question paper from its companion booklet,
because the check asks which paper a document belongs to and never asks what
KIND of document it is. That is not a defect to be patched here — it is the
same gap as the backlog note below, seen from the verification side.

The check is deliberately NOT extended to detect these. It guards every import,
and a heuristic for mojibake has blast radius far beyond four files. Anyone
re-deriving this classification from `code_in_pdf` output alone will not
reproduce it, and that is by design, not oversight.

## Backlog — recorded, not acted on

The importer has no attach path for a companion document. It creates rows, and a
row is a paper; there is nowhere to put a document that belongs WITH a paper
rather than being one. Three files are now waiting on that:

    9EL0_02_0624_ER.pdf      recovered examiner report, paper already imported
    9ET0_01_0624_ER.pdf      recovered examiner report, paper already imported
    WEN04_01_que_20190626    source booklet for WEN04/01 May-June 2019

One gap, one future ruling. Not acted on.

## Where things stand

    past_papers        1517 -> 1523   (+6)
    importable PDFs    2229 -> 2237   (+8)
    _quarantine         426 ->  418   (-8)

Of the 35 files previously classed `CODE_NOT_IN_PDF`:

    26  NOT_PUBLISHED   closed on Pearson's own notice
     8  recovered       read from the cover, renamed, 6 imported, 2 on disk
                        awaiting a way to attach an ER to an existing paper
     1  NOT A QUESTION PAPER   WEN04_01 June 2019 — source booklet. Code
                        matches; document type does not. R49 upheld the hold;
                        quarantined as SOURCE_BOOKLET_NOT_QUESTION_PAPER under
                        its original name.
