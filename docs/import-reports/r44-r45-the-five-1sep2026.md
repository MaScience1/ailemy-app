# R44 and R45 — the five, and a check that could not say why it failed

All five were accepted. `past_papers` 1512 -> 1517. The 48 are closed.

## R44 — the five were all the right papers

MD5s are distinct 5 of 5, and sizes differ, so 9MA0/31 and 9MA0/32 are not the
same file misfiled twice.

Two were accepted on provenance plus subject content — independent signals,
since the content check does not derive from the index claim. The other three
are image-only, so page 1 was rasterised to PNG at 150dpi and the cover READ:

| file | cover reads | assigned name | print ref |
| --- | --- | --- | --- |
| 9MA0_31_que_20190615 | Paper Reference **9MA0-31**, Mathematics Advanced, Paper 31: Statistics, Friday 14 June 2019 | 9MA0_31_0619_QU.pdf | P63358A |
| 9MA0_32_que_20190615 | Paper Reference **9MA0-32**, Mathematics Advanced, Paper 32: Mechanics, Friday 14 June 2019 | 9MA0_32_0619_QU.pdf | P63359A |
| 8FM0_01_que_20190514 | Paper Reference **8FM0-01**, Further Mathematics Advanced Subsidiary, Paper 1: Core Pure Mathematics, Monday 13 May 2019 | 8FM0_01_0619_QU.pdf | P58333A |

Every cover matched its assigned name, so the delta was 5, not 2.

⚠ ALL FIVE WERE ALREADY IN QUARANTINE before R43 re-downloaded them. R43's
`os.replace` overwrote the existing copies rather than adding, so the quarantine
count never grew: 431 before, 431 after R43, 426 once these five moved out. The
first reconciliation of this was wrong because it assumed 436 rather than
measuring it.

## Stage E and G over the five

Gate 1, both halves, control `9ET0/03 9et0-03-october-november-2020` from the
batch imported an hour earlier: 30/30 correct, `already_correct` true, against
0/20 on `9MA0_31_0619_QU.pdf`.

| batch | predicted | Done. | before -> after | actual |
| --- | --- | --- | --- | --- |
| gce-mathematics | 2 | 2 inserted, 0 already existed, 0 failed | 1512 -> 1514 | 2 |
| gce-further-mathematics | 3 | 3 inserted, 0 already existed, 0 failed | 1514 -> 1517 | 3 |

Dry runs: 5 planned, 0 R22 skips, 0 slug clashes. Watermark gates: 14 files, all
`correct_pages == pages`, `misplaced = 0`, `above_cropbox = 0`, 0 of 5 ceiling.

## R45 — the check now says WHY, and the verdict is unchanged

`code_in_pdf` returned `"neither"` for findings that are not the same thing. It
now distinguishes:

    code+entry / code only          pass, unchanged
    text-without-code               the document HAS text, code absent
                                    -> genuine wrong-document candidate
    text-without-code:image-cover   body has text, COVER does not
                                    -> untested, the code lives on the cover
    no-text                         nothing extractable at all -> untested

`hit` is the same boolean for every input; only the reason changed. Nothing that
passed before fails now, and nothing that failed before passes.

⚠ THE OBVIOUS TWO-WAY SPLIT WOULD NOT HAVE FIXED THE BUG IT WAS FOR. Splitting
only on "has text" versus "no text" still puts 9FM0_3C and 8fm0-27 in
wrong-document: both have text bodies and empty covers. The cover has to be
judged separately, or the two papers that proved the check was misreporting stay
misreported.

⚠ AND A COVER WHOSE ONLY TEXT IS THE PRINT BARCODE IS AN IMAGE COVER. 9FM0_3C
page 1 extracts exactly `*P62674A0128*` — 13 characters that are not the paper
code and never will be. Without stripping that, it counts as "the cover has
text" and the paper lands in the wrong bucket again.

Verified after the change: all five classify as untested (3 `no-text`, 2
`image-cover`), none as wrong-document — which is what reading their covers
established. Passing controls still pass.

## The reclassification — nothing unquarantined

The population is 40 distinct files, not 33: 33 recorded in `manifest.csv` and 7
more in `manifest-r39.csv`. Five have since been accepted, leaving **35**.

| class | count |
| --- | --- |
| **wrong document** — Pearson stub | **26** |
| untested — no extractable text | 5 |
| untested — broken CID font encoding | 2 |
| untested — garbled extraction | 2 |
| **TOTAL** | **35** |

The 26 are genuinely not the document they claim to be. They are one-page
notices:

> As there were insufficient entries for this paper, it has not been possible to
> provide detailed feedback to centres [...] Pearson will not publish an
> Examiner's Report for this paper.

with two variants — one spelling it "insuffiecient", and one reading "This
component was not available to candidates this session [...] will not publish a
Moderator's Report". Matching the exact string alone would have missed ten of
the twenty-six.

The 9 untested are all real documents the check simply could not read:

    no extractable text        WEN04_01_que_20190626   WET04_01_que_20190626
                               WFM02_01_que_20190604   WME03_01_que_20190516
                               WST02_01_que_20190625
    broken CID encoding        9el0-02-pef-20240815 (91 pages of /0/1/2/3 glyph
                               indices)   9et0-01-pef-20240815
    garbled extraction         WFM02_01_que_20150603   WFM03_01_que_20150622

⚠ THE THIRD AND FOURTH MODES ARE NOT IN THE NEW STATUSES. Broken encoding and
garbled extraction both produce text that is neither empty nor searchable, so
`code_in_pdf` still calls them `text-without-code`. They are separated here by
hand, not by the check. Extending it further is a ruling, not a cleanup — the
five just accepted show what happens when a heuristic decides this alone.

All 35 remain quarantined. R24 stands.
