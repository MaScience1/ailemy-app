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

## The recovery run

3s spacing, no chunk pauses. R39's rolling rate retained: more than 20 HTTP_000
in the last 50 attempts stops the run; 429 or systemic 403/401 stop immediately.

    attempted        365
      OK                 339
      HTTP_000            22
      HTTP_502             2
      CODE_NOT_IN_PDF      2
    never attempted  548
                     ---
                     913

**It stopped early, and correctly.** `ROLLING RATE — 21 HTTP_000 in the last 50
attempts (limit 20)`. The cause was local, and this time the error text said so
on the first read:

    20 x  curl: (6) Could not resolve host: qualifications.pearson.com
     1 x  curl: (16) Error in the HTTP2 framing layer
     1 x  curl: (56) Recv failure: Operation timed out

DNS on this machine stopped resolving. The run was clean from 14:37 to 14:59 —
one isolated failure at 14:56 — and then every attempt from 15:01 failed. A
lookup after the run resolved normally, so the outage was transient. This is the
first time the rolling rate has had real far-end-shaped trouble to catch, and it
caught it inside one window rather than burning the remaining 548 attempts
against a dead resolver.

## Where the corpus stands

    importable PDFs   1296 -> 1635   (+339)
    _quarantine        421 ->  425   (+2 CODE_NOT_IN_PDF, +2 HTTP_502 — a 502
                                      still writes a body, so it is quarantined)
    manifest.csv      2630 rows, untouched
    manifest-r39.csv   365 rows, this run only

Identities complete (QU+MS): **417 -> 527, so 110 became complete.** 123
identities were touched, 110 of them are now complete and 13 remain partial.
Recovered components per identity: 99 got all three, 18 got two, 6 got one.

The projection was 298 complete from all 913. 339 of 913 components landed —
37% — and 110 of 298 is 37%. The run is on trajectory; it is incomplete, not
divergent.

Named oddities, both harmless and both quarantined rather than imported:

- `WEN04/01 May-June 2019 QU` and `WET04/01 May-June 2019 QU` — CODE_NOT_IN_PDF.
- `WEN01/01 January 2017 MS` and `WEN01/01 January 2021 ER` — HTTP_502.

## Not done

548 components never attempted. The 22 HTTP_000 are now a DNS artefact rather
than a diagnosis and would need re-attempting. Nothing was watermarked, nothing
was imported, and no `--commit` was run.
