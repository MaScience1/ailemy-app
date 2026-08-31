"""Stage D runner. Reuses scripts/pearson-fetch.py; writes no second fetcher.

============================================================================
⚠ TWO DEFECTS FROM THE 30 AUG RUN ARE FIXED HERE — R28. NOT YET RUN.
============================================================================
That run made 2,630 attempts and 913 of them came back HTTP_000, curl's code
for NO RESPONSE AT ALL. The far end answered ~1,050 requests cleanly and then
failed 40-70% of everything after, never recovering. Whether that was a
timeout, a connection reset or a TLS failure is UNKNOWABLE, because:

  1. `http, err = pf.get(...)` DISCARDED err. Every one of the 913 carried a
     specific curl error string and all 913 were thrown away. The pattern is
     visible; the cause is not.
  2. The manifest had NO PER-ROW TIMESTAMP, so "degradation began around row
     1,050" is inferred from row position, not measured.

R27 forbids retrying those 913 until the error text can name the cause — a far
end that stops answering may be shedding connections instead of sending 429,
and retrying into that turns a soft limit into a hard block. These two columns
are what make that diagnosis possible next time. This file is committed as a
diff only and has NOT been run.

============================================================================
⚠ R39 — THE RECOVERY RUN OVER THE 913. PACING AND STOP RULE REPLACED.
============================================================================
⚠ THE 913 WERE NEVER A NETWORK FAILURE. The first R39 pass stopped after 50
attempts with every one carrying the SAME curl error:

    curl: (3) URL rejected: Malformed input to a URL function

curl refused to send them. No connection was opened and Pearson was never
contacted. All 913 have an unencoded space in the path ("A Level/English
Language and Literature/"); all 1296 that succeeded have none — 913/913 and
0/1296, a total separation. The "far end degraded around row 1,050 and never
recovered" reading was an artefact of queue ORDER: the space-bearing subject
paths simply begin there. Rows 0-1051 hold 3 of the 913; every slice after
holds 123-165.

pf.encode_path() fixes it at request time, and one test proved it end to end:
9EL0_03_pef_20180815.pdf returned 200, 644,446 bytes, %PDF clean, 13 pages,
code+entry present, cover series May-June 2018.

So the pacing is 3s and there are no chunk pauses. Both existed to nurse a far
end that was never in trouble: the 30 Aug run sent ~1,717 real requests at 2s
and drew zero 429s.

The stop rule is now a ROLLING RATE, not consecutive counters. Consecutive
counting cannot see a far end that fails 40% of requests forever — exactly the
shape the last run hit — because a single success resets it to zero. If the
last 50 attempts hold more than 20 HTTP_000 the whole run stops and the window
that tripped it, curl_err values included, is printed.

⚠ SCOPE IS THE 913, AND ONLY THE 913. Not the 386 locked, not the 33
quarantined, not the 2 HTTP_502, and nothing already OK. The previous `done`
set was every key in the manifest, which would have skipped the 913 themselves
— the exact rows this run exists to retry.

⚠ IT WRITES A SEPARATE MANIFEST. manifest.csv was written before R28 and its
header has no ts or curl_err column; appending these rows to it would misalign
every field from `http` rightward and corrupt the record of the 30 Aug run.
manifest-r39.csv carries the new shape and the original is left untouched.
"""
import sys, os, json, time, csv, datetime, collections, importlib.util
REPO="/Users/muhammed/dev/ailemy-app"
S="/Users/muhammed/Desktop/Ailemy/Maths-English-Pearson-Staging"
RAW=os.path.join(S,"_raw"); Q=os.path.join(S,"_quarantine")

spec=importlib.util.spec_from_file_location("pf", os.path.join(REPO,"scripts","pearson-fetch.py"))
pf=importlib.util.module_from_spec(spec); spec.loader.exec_module(pf)

MIN_GAP=3.0
WINDOW=50; WINDOW_MAX_000=20
queue=json.load(open(os.path.join(RAW,"queue.json")))
PRIOR=os.path.join(S,"manifest.csv")
MAN=os.path.join(S,"manifest-r39.csv")

# Scope: exactly the keys the 30 Aug run recorded as HTTP_000.
target=set()
with open(PRIOR) as f:
    for row in csv.DictReader(f):
        if row["status"]=="HTTP_000": target.add(row["key"])
print(f"scope: {len(target)} HTTP_000 components from the prior manifest", flush=True)

# Resume: anything this run already downloaded is skipped, not re-fetched.
done=set()
if os.path.exists(MAN):
    with open(MAN) as f:
        for row in csv.DictReader(f):
            if row["status"]=="OK": done.add(row["key"])
    print(f"resuming: {len(done)} already recovered in a previous R39 pass", flush=True)

work=[r for r in queue if r["key"] in target and r["key"] not in done]
print(f"attempting: {len(work)} components, {MIN_GAP}s apart", flush=True)

FIELDS=["ts","key","code","entry","session","year","type","target","source_url",
        "http","curl_err","bytes","page_count","source_sha256","source_md5","code_ok",
        "cover_series","cover_year","status"]
new = not os.path.exists(MAN)
fh=open(MAN,"a",newline=""); w=csv.DictWriter(fh,fieldnames=FIELDS)
if new: w.writeheader(); fh.flush()

ok=fail=locked=skipped=0
consec_denied=0
window=collections.deque(maxlen=WINDOW)   # (http, curl_err) of the last 50 attempts
stopped=None

def trip(rule):
    global stopped
    stopped=rule
    print(f"\n■ STOP RULE FIRED: {rule}", flush=True)
    print(f"  window of the last {len(window)} attempts:", flush=True)
    for h,e in window: print(f"    {h:5} {e[:150]}", flush=True)

for i,r in enumerate(work):
    if stopped: break
    if i and i%100==0:
        print(f"  … {i}/{len(work)} attempted — {ok} ok, {fail} failed", flush=True)
    dest=os.path.join(RAW, r["base"])
    t0=time.time()
    # ⚠ Encoded at REQUEST time. queue.json stays the record of what discovery
    #   produced; the manifest keeps the original URL for the same reason.
    http,err=pf.get(pf.encode_path(r["url"]), dest)
    row={k:"" for k in FIELDS}
    # ⚠ R28.1 — err is RECORDED, not discarded. It is the only thing that can
    #   distinguish a timeout from a reset from a TLS failure on an HTTP_000.
    # ⚠ R28.2 — ts is the per-row wall clock, so degradation can be measured
    #   rather than inferred from row position.
    row.update(ts=datetime.datetime.now().isoformat(timespec="seconds"),
               key=r["key"], code=r["code"], entry=r["entry"], session=r["mm"],
               year=r["year"], type=r["type"], target=r["target"],
               source_url=r["url"], http=http, curl_err=(err or "")[:300])
    window.append((http, err or ""))
    if http=="429":
        row["status"]="RATE_LIMITED"; w.writerow(row); fh.flush()
        trip(f"429 RATE LIMITED at component {i}"); break
    if http in ("403","401"):
        consec_denied+=1; locked+=1
        row["status"]="LOCKED_NOT_PUBLIC"; w.writerow(row); fh.flush()
        if consec_denied>=10:
            trip(f"SYSTEMIC {http} — {consec_denied} consecutive"); break
        time.sleep(max(0, MIN_GAP-(time.time()-t0))); continue
    consec_denied=0
    # ⚠ R39 ROLLING RATE. Checked every attempt once the window is full.
    if len(window)==WINDOW:
        n000=sum(1 for h,_ in window if h=="000")
        if n000>WINDOW_MAX_000:
            if http!="200": row["status"]=f"HTTP_{http}"; fail+=1; w.writerow(row); fh.flush()
            trip(f"ROLLING RATE — {n000} HTTP_000 in the last {WINDOW} attempts (limit {WINDOW_MAX_000})")
            break
    size=os.path.getsize(dest) if os.path.exists(dest) else 0
    row["bytes"]=size
    if http!="200" or size==0:
        row["status"]=f"HTTP_{http}"; fail+=1
        if os.path.exists(dest): os.replace(dest, os.path.join(Q, r["base"]))
        w.writerow(row); fh.flush(); time.sleep(max(0,MIN_GAP-(time.time()-t0))); continue
    good,why=pf.is_pdf(dest)
    if not good:
        row["status"]="NOT_A_PDF:"+why[:40]; fail+=1
        os.replace(dest, os.path.join(Q, r["base"]))
        w.writerow(row); fh.flush(); time.sleep(max(0,MIN_GAP-(time.time()-t0))); continue
    sha,md5,n=pf.hashes(dest)
    row["source_sha256"]=sha; row["source_md5"]=md5
    try:
        from pypdf import PdfReader
        row["page_count"]=len(PdfReader(dest).pages)
    except Exception: row["page_count"]=""
    hit,how=pf.code_in_pdf(dest, r["code"], r["entry"])
    row["code_ok"]=how
    ex=pf.extract(dest)
    row["cover_series"]=ex["series"] or ""; row["cover_year"]=ex["year"] or ""
    if not hit:
        row["status"]="CODE_NOT_IN_PDF"; fail+=1
        os.replace(dest, os.path.join(Q, r["base"]))
        w.writerow(row); fh.flush(); time.sleep(max(0,MIN_GAP-(time.time()-t0))); continue
    tgt=os.path.join(S, r["target"])
    if os.path.exists(tgt):
        row["status"]="REFUSED_TARGET_EXISTS"; fail+=1
        os.replace(dest, os.path.join(Q, r["base"]))
    else:
        os.replace(dest, tgt); row["status"]="OK"; ok+=1
    w.writerow(row); fh.flush()
    if ok%100==0: print(f"  {ok} downloaded, {fail} failed, {locked} locked", flush=True)
    time.sleep(max(0, MIN_GAP-(time.time()-t0)))
fh.close()
print(f"\nRUN END  attempted={ok+fail+locked} ok={ok} failed={fail} locked={locked}", flush=True)
print(f"STOP: {stopped or 'none — the work list was exhausted'}", flush=True)
