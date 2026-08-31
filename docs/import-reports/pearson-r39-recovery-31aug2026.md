# The 913 "HTTP_000" — 31 August 2026

The 30 August Stage D run recorded 913 of 2,630 components as `HTTP_000`, curl's
code for no response at all. R27 froze them: without the error text, retrying
into what looked like a far end shedding connections risked turning a soft limit
into a hard block.

**They were never network failures.** They were never sent.

## What the error text said

R28 added two columns — `curl_err` and a per-row `ts`. The first run under R39
stopped after 50 attempts, and every one carried the same string:

    curl: (3) URL rejected: Malformed input to a URL function

curl refused to construct the request. No connection was opened, no byte left
the machine, Pearson was never contacted.

## The cause

Every one of the 913 has an unencoded space in its URL path:

    https://qualifications.pearson.com/content/dam/pdf/A Level/English Language and Literature/2015/exam-materials/9EL0_03_pef_20180815.pdf

The separation against the prior run's own manifest is total:

| prior status | space in URL | no space |
| --- | --- | --- |
| HTTP_000 | **913** | 0 |
| OK | 0 | **1296** |
| HTTP_401 | 0 | 386 |
| CODE_NOT_IN_PDF | 0 | 33 |
| HTTP_502 | 0 | 2 |

913 of 913, and 0 of 1296. `HTTP_000` and "has a space" are the same set.

## The degradation reading was an artefact of queue order

The runner's own header recorded the 30 Aug run as answering "~1,050 requests
cleanly and then failing 40-70% of everything after, never recovering". Where
the 913 actually sit in queue order:

    rows    0-1051      3
    rows 1052-1314    151
    rows 1315-1577    165
    rows 1578-1840    152
    rows 1841-2103    123
    rows 2104-2366    158
    rows 2367-2629    161

Nothing degraded. The space-bearing subject paths — `A Level/English Language
and Literature/`, `International Advanced Level/Mathematics/2013/Exam materials/`
— simply begin around row 1,052. Pearson never rate-limited, never blocked, and
never misbehaved. R27 existed to protect against a limit that was not there.

## The fix

`pf.encode_path()` percent-encodes the PATH only; scheme, host, query and
fragment are untouched. It runs at REQUEST time — `queue.json` is unmodified and
remains the record of what discovery produced, and the manifest still stores the
original URL.

Plain quoting is safe here because the data says so, not because it usually is:
no queue URL contains `%`, none has a query or fragment, and the space is the
only character in any path outside `[A-Za-z0-9/-._~]`. **The function is not
idempotent** — applying it twice yields `%2520`. Re-check those three properties
before pointing it at a different queue.

One file was tested before any re-run: `9EL0_03_pef_20180815.pdf` returned 200,
644,446 bytes, `%PDF` structurally clean, 13 pages, code+entry present in the
document, cover series May-June 2018. Not the 150,238-byte not-found decoy.

## The recovery run — two passes

3s spacing, no chunk pauses. R39's rolling rate retained: more than 20 HTTP_000
in the last 50 attempts stops the run; 429 or systemic 403/401 stop immediately.

**Pass 1 stopped early, and correctly.** `ROLLING RATE — 21 HTTP_000 in the last
50 attempts (limit 20)`, after 365 attempts. The cause was local, and the error
text said so on the first read:

    20 x  curl: (6) Could not resolve host: qualifications.pearson.com
     1 x  curl: (16) Error in the HTTP2 framing layer
     1 x  curl: (56) Recv failure: Operation timed out

DNS on this machine stopped resolving. The run was clean from 14:37 to 14:59 —
one isolated failure at 14:56 — then every attempt from 15:01 failed. A lookup
afterwards resolved normally, so the outage was transient. This is the first
time the rolling rate has had real far-end-shaped trouble to catch, and it
caught it inside one window rather than burning 548 attempts on a dead resolver.

**Pass 2 resumed 572** — everything not already settled. The 2
`CODE_NOT_IN_PDF` from pass 1 were excluded by rule: they re-fail identically
and re-quarantine, so retrying them adds a manifest row and nothing else.
`HTTP_502` was NOT treated as settled, a transient far-end error being worth
another attempt. A DNS check ran before the start.

    RUN END  attempted=572 ok=564 failed=8 locked=0
    STOP: none — the work list was exhausted

No stop rule fired, no 429, no 403/401, no exception.

## Final state of the 913

`manifest-r39.csv` holds 937 rows over **913 distinct keys — 0 never attempted**.
The 24 duplicated keys are exactly the 22 DNS-window `HTTP_000` plus the 2
`HTTP_502`, re-attempted on resume as intended.

| status (last attempt) | count |
| --- | --- |
| **OK** | **903** |
| CODE_NOT_IN_PDF | 7 |
| HTTP_502 | 2 |
| NOT_A_PDF (no `%PDF-` header) | 1 |
| | **913** |

## Where the corpus stands

    importable PDFs   1296 -> 2199   (+903)
    _quarantine        421 ->  431   (+10 distinct)
    manifest.csv      2630 rows, untouched
    manifest-r39.csv   937 rows, this recovery only

Identities complete (QU+MS): **417 -> 706, so 289 became complete.**

The projection was 298, and it was exact. Nine identities fell short only
because a single component of each failed to download: **289 complete + 9
blocked = 298**, and the 33 still-partial are the 24 predicted partials plus
those same 9. **0 of the 48 previously-incomplete papers were repaired**, also
as predicted — their missing components were never in the queue, so no download
could have reached them.

⚠ Both disk reconciliations close exactly, but only after the expectation was
corrected twice. The first formula omitted `HTTP_502` as quarantine-bound, the
second omitted `NOT_A_PDF`. Each time the disk was right and the arithmetic was
wrong. The quarantine-bound set is `CODE_NOT_IN_PDF`, `HTTP_502` and
`NOT_A_PDF*` — anything that downloaded a body and then failed validation.

## The 10 that did not land, named

**CODE_NOT_IN_PDF (7)** — all question papers, six of the seven May-June. The
document downloads but does not carry its own paper code in the first three
pages. R24 keeps them quarantined.

    WEN04|1|May-June|2019|QU     WFM03|1|May-June|2015|QU
    WET04|1|May-June|2019|QU     WME03|1|May-June|2019|QU
    WFM02|1|May-June|2015|QU     WST02|1|May-June|2019|QU
    WFM02|1|May-June|2019|QU

**HTTP_502 (2)** — `WEN01|1|January|2017|MS`, `WEN01|1|January|2021|ER`. Both
returned a 122-byte error body and both failed identically on two attempts
hours apart, so they are not transient in the way a 502 usually is.

**NOT_A_PDF (1)** — `WST03|1|January|2022|MS`. Downloaded, no `%PDF-` header.

The nine identities those failures block:

    WEN01|1|January|2017      have ER,QU   MS 502
    WST03|1|January|2022      have ER,QU   MS not a PDF
    WEN04|1|May-June|2019     have ER,MS   QU code-not-in-pdf
    WET04|1|May-June|2019     have ER,MS   QU code-not-in-pdf
    WFM02|1|May-June|2015     have ER,MS   QU code-not-in-pdf
    WFM02|1|May-June|2019     have ER,MS   QU code-not-in-pdf
    WFM03|1|May-June|2015     have ER,MS   QU code-not-in-pdf
    WME03|1|May-June|2019     have ER,MS   QU code-not-in-pdf
    WST02|1|May-June|2019     have ER,MS   QU code-not-in-pdf

## Not done here

Nothing was watermarked, nothing imported, no `--commit`. This was download only.
