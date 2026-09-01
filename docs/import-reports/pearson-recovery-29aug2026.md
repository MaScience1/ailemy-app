# Pearson recovery — 29 August 2026

Provenance for 31 past-paper PDFs downloaded from qualifications.pearson.com and
imported into the corpus on 29 August 2026. This file is the only record of
where each came from; the staging directory is emptied on completion.

## How the files were found

Pearson's past-paper page is an Angular app whose static HTML contains no
document links. Its search backend is **Algolia**, reached from the scope of the
page's own `pastpaperSearchCtrl`:

    index  qualifications-uk_LIVE_master-content
    app    L639T95U5A

That is the public, search-only key shipped to every visitor. It queries the same
public catalogue the site's own UI queries and unlocks nothing gated — every
record used here reports `gating: False`.

Three things about that index are worth recording, because each cost a wrong
answer before it was found:

1. **`description` does not reliably carry the paper code.** Most records hold
   `Paper 1 - Core Physics I` or an empty string; only some older ones include
   `8PH0/01`. The dependable identifiers are the URL basename and the structured
   `category` facets (`Pearson-UK:Exam-Series/...`, `Pearson-UK:Document-Type/...`).
2. **Results truncate at 1000** against `nbHits` up to 3013. A broad query
   silently returns one series and looks like an absence.

   ⚠ CORRECTED 1 Sep 2026 — "with no pagination" was WRONG. The index paginates
   normally: a `page=1` request for `9EN0` returned a further 1000 hits and
   reported `nbPages: 4` against `nbHits: 3408`. The 1000 is a per-page cap, not
   a hard ceiling on what is reachable. Narrowing with `facetFilters` is still
   the better move — it removes the truncation instead of walking it — but a
   result set larger than 1000 is NOT out of reach, and treating it as such is
   how a real absence gets confirmed on a partial window.
3. **The autumn 2020 series is tagged `October-2020`**, not November, and its
   mark scheme uses the `msc` token rather than `rms`.

## How each file was verified

Downloaded under Pearson's own filename, then gated before any rename:

- HTTP 200 — **necessary but not sufficient**. Pearson serves "not found" as a
  200 with a 150,238-byte HTML page, never a 404. Six such pages were caught by
  the next gate and are quarantined, not deleted.
- `%PDF-` header and a structural parse.
- Paper code and component read from inside the document. The check treats the
  letter O and the digit 0 as equivalent: one examiner report prints `(9BIO)` on
  its cover where Pearson's own filename uses `9BI0`.
- Series resolved at IDENTITY level under standing precedence — MS and ER
  agreeing beats a single MS or ER, which beats QU. Copyright and publication
  lines are excluded as evidence. Folder is never evidence.

Renamed only after all of the above passed.

**Four question papers were carried by the precedence rule and would have been
filed wrongly on their own evidence:**

| file | its own cover | adjudicated |
|---|---|---|
| `8PH0_01_1120_QU.pdf` | May-June 2020 | October-November 2020, MS+ER agreeing |
| `8BI0_02_1121_QU.pdf` | no series line | October-November 2021, single MS |
| `9BI0_01_0622_QU.pdf` | no series line | May-June 2022, MS+ER agreeing |
| `9BI0_01_1121_QU.pdf` | no series line | October-November 2021, MS+ER agreeing |

The first is the genuine autumn-2020 case: Pearson reused a paper printed for the
cancelled summer sitting, so the question paper carries a May cover date and
still belongs to the October-November series. That is a property of the series,
not a defect, and it is why QU never decides.

## NOT PUBLISHED — 1

`8BI0/02 October-November 2021` examiner report. The URL resolves to a real
one-page Pearson document stating that insufficient entries meant no examiner
report would be produced for that paper. The paper itself imported on QU+MS,
which the planner accepts as complete because the examiner report is optional.

Source: `https://qualifications.pearson.com/content/dam/pdf/A-Level/Biology/2015/Exam-materials/8BI0_02_pef_20211216.pdf`

That artefact is quarantined rather than deleted.

## Manifest — 31 files

Hashes recomputed from each file's current location in the corpus, not copied
from the download step.

| target | source (Exam-materials) | size | SHA-256 | MD5 |
|---|---|---:|---|---|
| `8BI0_02_1121_MS.pdf` | Biology/8BI0_02_rms_20211216.pdf | 359,142 | `73a8829e61d1957abaf0c955beb095f7641e45fb2ffad828681b471c9bde88d7` | `be3c3c7f0695e608620968a2da231285` |
| `8BI0_02_1121_QU.pdf` | Biology/8BI0_02_que_20211016.pdf | 1,078,432 | `1e5b7f2845cbb9d02a90f3e40531b973e119b1245bfd669b9ce43e97e1785fca` | `d00d9d54a090f083f76e66dd6e72ad76` |
| `8BN0_02_0624_ER.pdf` | Biology/8bn0-02-pef-20240815.pdf | 2,875,385 | `142dc04d112fe4d0939c0d9636c5171054d3a7d70bd5043a3e7c4a2175c55afe` | `2efcb569f5528a03cc0e6c2660727625` |
| `8BN0_02_0624_MS.pdf` | Biology/8bn0-02-rms-20240815.pdf | 186,007 | `f63d18f2cf3c6bd282cc82e4e5d0658a126e25604a9c8954144a28afe4aa786f` | `76b335f948ca7d0a63f3c3b682f7c6d0` |
| `8BN0_02_0624_QU.pdf` | Biology/8bn0-02-que-20240524.pdf | 1,621,711 | `63a4f77c70735ab6f80116cb07b1fdd1229b402261bf4155f98a951fa69561af` | `14192e1e5e21f9155b00547e583ff3fa` |
| `8CH0_02_0625_ER.pdf` | Chemistry/8ch0-02-pef-20250814.pdf | 252,141 | `b2cbf2ad1f3a3442733d8296b768d0d3b300ec516a82ef010c94fbec78098d93` | `cab10e96abb1dbe635ccbd17cbeba847` |
| `8CH0_02_0625_MS.pdf` | Chemistry/8ch0-02-rms-20250814.pdf | 626,159 | `5f2d2aa997875eb18559e5284b4d0b516b158cc706eba74f6facb37a3e3b701b` | `dc8c442b259db69bdafa6a436faf106a` |
| `8CH0_02_0625_QU.pdf` | Chemistry/8ch0-02-que-20250521.pdf | 901,232 | `2d106879c0634670a0241c1394ab088292cbe0524e56faa9b9869762d03ef2b8` | `22bf30657e36a75cae3dba67b70ab1d2` |
| `8PH0_01_0617_ER.pdf` | Physics/8PH0_01_pef_20170816.pdf | 6,539,933 | `c24ab8580dab79c8354c4672a8dd520e31928b0ebed0a445350aec65a54e9aca` | `30be72efe041740ef496a5b0fb684a12` |
| `8PH0_01_0617_MS.pdf` | Physics/8PH0_01_rms_20170816.pdf | 211,939 | `2350bf296eb413cd65d837e52c17ed0d81f4fd5d932f91c70d006b1681792c90` | `ebf5835a94e8a884c978401ea2b4c23b` |
| `8PH0_01_0617_QU.pdf` | Physics/8PH0_01_que_20170524.pdf | 1,172,557 | `bae09883ee2c9e6cc40de37e0b6682e895bc5dc3dda091de510c71abdde182e9` | `094a6586cb60957615542e443e97b27c` |
| `8PH0_01_0623_ER.pdf` | Physics/8ph0-01-pef-20230817.pdf | 2,698,936 | `d7da1e1c4cc0c504e4e56a5b2ff15dc1a2210528158830c2f928aa6ea1302fda` | `cd164b8910af5df86eea7a5d83926270` |
| `8PH0_01_0623_MS.pdf` | Physics/8ph0-01-rms-20230817.pdf | 494,835 | `3be671e44636309cb0c5a89063e166fdf3eb6ac3a1dab9141ec1b318612ee6d0` | `236c1c9e5948c2d93cf8f830fcf16dc3` |
| `8PH0_01_0623_QU.pdf` | Physics/8ph0-01-que-20230518.pdf | 1,385,997 | `07c86981d3bf316326ffc6affdb8cfe21cf7bfc038865b2bc5401ff80a3752dc` | `0d95cfffa14947c36aa4425f414885f0` |
| `8PH0_01_1120_ER.pdf` | Physics/8PH0_01_pef_20201217.pdf | 4,221,388 | `028caf124594f8a997921e065f2ba2ddaf9b3f58b4c79c88baf8e416987669be` | `4c0d6824b917469516dc16f6e9ba0e68` |
| `8PH0_01_1120_MS.pdf` | Physics/8PH0_01_msc_20201217.pdf | 548,148 | `1255d4c2fb8626cea61d06485de040bd95dcbbd4f5ef2bac56f419db5e35dab6` | `7497c0f8808a583b7cf43b406da8c93f` |
| `8PH0_01_1120_QU.pdf` | Physics/8PH0_01_que_20201010.pdf | 896,234 | `2600f620013a408df3c0001b2d279902563a8b52f31eaf35f0e3a37960bf9a1f` | `ec046d8a6787240c68a062a9d52cb21a` |
| `9BI0_01_0622_ER.pdf` | Biology/9bi0-01-pef-20220818.pdf | 5,134,021 | `e1644896abe53ae843c80313254d3b15fc3afe0e7d8d395cc24295bc1d4de1ed` | `853ac95e93c221c930fe02592ae99e08` |
| `9BI0_01_0622_MS.pdf` | Biology/9bi0-01-rms-20220818.pdf | 445,200 | `48a8eabddcdaaea4e1e3325cb4c248eeff78e6b5954e5461dbd7086d5b19e156` | `28ea0dcdb62e3b8dd5040e6222011b46` |
| `9BI0_01_0622_QU.pdf` | Biology/9bi0-01-que-20220610.pdf | 1,673,840 | `83e2394102ab9f9ca3c89b1672485b370a1dcc2fd0fd96900dbff123452c3525` | `67f927f7a527ce40d6c5d30b80f476c3` |
| `9BI0_01_0624_ER.pdf` | Biology/9bi0-01-pef-20240815.pdf | 4,378,233 | `1d008929cfed2572e4f19f56de28382ad927a0eb826263dff1af699fa5631b1e` | `8bfa27fb10f8ceacbc6045d886551aa5` |
| `9BI0_01_0624_MS.pdf` | Biology/9bi0-01-rms-20240815.pdf | 328,145 | `bccae336e6e6ac9affaded2a3e35fd8919db2f0635103170eaa6a68019ee4d44` | `aae638d06d9566bde804b443c52b76f5` |
| `9BI0_01_0624_QU.pdf` | Biology/9bi0-01-que-20240606.pdf | 847,215 | `6a535622f51b48c5b44f05b155d9d14a74446b1345bd5b833a8a9dc512aee6e7` | `f98229c0370924ce91791981ad5ef33a` |
| `9BI0_01_0625_ER.pdf` | Biology/9bi0-01-pef-20250814.pdf | 3,962,324 | `8cfba7260f48d5f518c8445027cd18fd493060905e1098ec407641acd274889c` | `fd7cc677cc5f8b51217e4187930ccd1e` |
| `9BI0_01_0625_MS.pdf` | Biology/9bi0-01-rms-20250814.pdf | 491,155 | `2ade7018baa2116cff9ad1bbbcff90c8b7e0e0dc0d8e2d7685e04a9cd2c3f28c` | `e44667b89746ed38eb6454108ac4f1a0` |
| `9BI0_01_0625_QU.pdf` | Biology/9bi0-01-que-20250606.pdf | 2,025,666 | `b6b5efb4d1c973fdc16a8c540f958b8fc71fc919b98d5772aec9fcadfe00c615` | `acc3ab5bdc44fe937af975f67aacf756` |
| `9BI0_01_1121_ER.pdf` | Biology/9BI0_01_pef_20211216.pdf | 137,481 | `488eb9d137dc22e558bc61664b372cdda2e705e1921dff1fd432020f6eda305d` | `6b8efb2b02de472dea5f83e13a9a54a4` |
| `9BI0_01_1121_MS.pdf` | Biology/9BI0_01_rms_20211216.pdf | 381,667 | `cee1907f27bb956a0ddb5077d3610db93d18b50987e91229ea1aedcebc3387cf` | `cf6349f8e27391e4d98e741f2a763ddc` |
| `9BI0_01_1121_QU.pdf` | Biology/9BI0_01_que_20211012.pdf | 1,500,875 | `d145b6d2515ef015ad31953e2caadcf2789c0187b9aef3df880a56fa7c856a43` | `270034fcb72bce8c4f2c5e2cb9ab0ad1` |
| `9BN0_03_0623_MS.pdf` | Biology/9bn0-03-rms-20230817.pdf | 399,875 | `188556b1a76268959ed0d2ccbd53494b85f79d109cfc630aede840cf654c83a8` | `544269705ec72625c1fdd6d82e4c8bfd` |
| `9BN0_03_0623_QU.pdf` | Biology/9bn0-03-que-20230622.pdf | 990,312 | `9881ce7586a78469d2a7f8effffd04af3bec8d1dde7afc079f083be01f407b65` | `e9713c86144e689546ecf96e909a83a8` |

All 31 have distinct SHA-256 and MD5. Corpus paths are under
`2 - GCE AS and A level from 2015/`.
