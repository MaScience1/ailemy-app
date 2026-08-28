# Renaming the descriptive-name PDFs — VOID at the positive control

**Read-only run. Nothing was renamed, moved, deleted or uploaded. No SQL, no
Storage, no packages, no database read of any kind.** The rename tool was never
built, because the run voided at step 3 and then voided again on the data itself.

## 1. The count is 50 — but my first classifier said 84

The task said stop on a mismatch. My first pass reported **84** and that number
was wrong, so the record of how it was wrong matters more than the number.

`bulk-import-report.json` at the repo root could not be the source: it is from a
`--commit` run with `subject: 'gcse-physics'` and `root: '.../4 - GCSE (9-1) '`,
so all 1,372 of its skips are folder-4 relative paths and it carries no folder-2
name at all. The list was rebuilt by running the importer **dry** for each of the
four folder-2 subjects and intersecting the skip sets:

| subject | skips (dry run) |
|---|---|
| `gce-chemistry` | 563 |
| `gce-physics` | 569 |
| `gce-biology-a` | 569 |
| `gce-biology-b` | 585 |
| **rejected by all four** | **261** |

Of those 261, I classified the leading filename token with `^[0-9][A-Z]{2}[0-9Z]$`
and got 84 "descriptive". **That regex is four characters wide and the merged
code+entry forms are five** — `8CH01_EAM_MS.pdf`, `9PH03_EAM_QU.pdf` — so 34
files carrying a perfectly good paper code fell through as descriptive.

```
50  leading token is a word      Biology_… Chemistry_…   <- the target set
34  leading token is CODE+ENTRY  8CH01_ 9PH03_ …         <- misfiled by my regex
```

**50 confirmed.** The other 177 of the 261 were rejected for reasons unrelated to
naming.

## 2. Positive control: 7/10. Under the stated rule the extractor is VOID.

Ten already-parsing files, extracted cover fields compared field-by-field against
the fields in their own filenames. The rule was 10/10 or void.

The first run scored 5/10 and **two of those failures were my control's bug, not
the extractor's**: it compared the raw `MM` digits, so a cover reading *November*
"failed" a filename reading `10`. The importer's own `SESSION_BY_MONTH`
(read from `scripts/bulk-import-papers.ts:399`, not retyped) maps `10` and `11`
both to `October-November`. Comparing resolved sessions instead moved those two
to pass — **7/10**.

The three genuine failures:

| file | extracted | filename | what the cover says |
|---|---|---|---|
| `8BN0_02_0622_QU.pdf` | no session | May-June | no date string in the page-1 text layer |
| `8BI0_02_0622_QU.pdf` | no session | May-June | no date string in the page-1 text layer |
| `9BI0_03_1020_QU.pdf` | May-June 2020 | October-November 2020 | **`Monday 15 June 2020`** |

That last row is the one worth keeping. It is not an extraction error — the cover
genuinely reads *Monday 15 June 2020* while the file is named as the
October-November series. **The cover page and the filename disagree about the
session on a real, already-imported paper.** Whichever is right, the cover is not
a trustworthy source for the field, which is the whole thing the control existed
to find out.

## 3. The 50 cannot be renamed at all, and it is not the extractor's fault

This is the finding that ends the task independently of the control.

All 50 have a text layer on page 1 (0 are scanned). Field recovery:

```
35/50  paper code
35/50  entry
36/50  document type
50/50  a year
10/50  a session
 0/50  ALL FIVE
```

The target grammar needs `CODE_ENTRY_MMYY_TYPE.pdf` where `MM` is one of
`01 02 05 06 10 11`. **Zero of the 50 yield it**, and the ten that appeared to
all came from the same string:

```
Specimen Papers - Issue 1 - October 2015 (c) Pearson Education Limited 2015
```

That is a publication date on a specimen paper, not an exam sitting — and the
line names itself. **All 50 files carry `SAM` or `EAM` in their filename**:
sample and exemplar assessment material. They were never sat, so there is no
session to recover, and no correct `MMYY` exists to rename them to. A confident
extractor would have invented one.

They are also out of scope under the standing ruling — *publicly released Pearson
sessions only*. Specimen material is not a released session.

## 4. Consequence

No manifest of renames is produced, because there are no valid renames. The 50
should stay where they are and stay excluded from import. The importer already
rejects them, which is the correct behaviour and needs no change.

One thing does deserve a follow-up that is **not** part of this task and was not
done: `9BI0_03_1020_QU.pdf` is imported and live, and its cover contradicts its
filename about the session. That is a one-file question for the owner, not a
batch operation.
