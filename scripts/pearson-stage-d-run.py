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
"""
import sys, os, json, time, csv, datetime, importlib.util
REPO="/Users/muhammed/dev/ailemy-app"
S="/Users/muhammed/Desktop/Ailemy/Maths-English-Pearson-Staging"
RAW=os.path.join(S,"_raw"); Q=os.path.join(S,"_quarantine")

spec=importlib.util.spec_from_file_location("pf", os.path.join(REPO,"scripts","pearson-fetch.py"))
pf=importlib.util.module_from_spec(spec); spec.loader.exec_module(pf)

CAP=1500; MIN_GAP=2.0
queue=json.load(open(os.path.join(RAW,"queue.json")))
MAN=os.path.join(S,"manifest.csv")
done=set()
if os.path.exists(MAN):
    with open(MAN) as f:
        for row in csv.DictReader(f): done.add(row["key"])
    print(f"resuming: {len(done)} components already in the manifest", flush=True)

FIELDS=["ts","key","code","entry","session","year","type","target","source_url",
        "http","curl_err","bytes","page_count","source_sha256","source_md5","code_ok",
        "cover_series","cover_year","status"]
new = not os.path.exists(MAN)
fh=open(MAN,"a",newline=""); w=csv.DictWriter(fh,fieldnames=FIELDS)
if new: w.writeheader(); fh.flush()

ok=fail=locked=skipped=0
consec403=0
for i,r in enumerate(queue):
    if ok>=CAP:
        print(f"\nHARD CAP {CAP} REACHED — stopping. {len(queue)-i} components left unqueried.", flush=True)
        break
    if r["key"] in done: skipped+=1; continue
    dest=os.path.join(RAW, r["base"])
    t0=time.time()
    http,err=pf.get(r["url"], dest)
    row={k:"" for k in FIELDS}
    # ⚠ R28.1 — err is RECORDED, not discarded. It is the only thing that can
    #   distinguish a timeout from a reset from a TLS failure on an HTTP_000.
    # ⚠ R28.2 — ts is the per-row wall clock, so degradation can be measured
    #   rather than inferred from row position.
    row.update(ts=datetime.datetime.now().isoformat(timespec="seconds"),
               key=r["key"], code=r["code"], entry=r["entry"], session=r["mm"],
               year=r["year"], type=r["type"], target=r["target"],
               source_url=r["url"], http=http, curl_err=(err or "")[:300])
    if http=="429":
        print(f"\n429 RATE LIMITED at component {i} — STOPPING THE WHOLE RUN.", flush=True)
        row["status"]="RATE_LIMITED"; w.writerow(row); fh.flush(); break
    if http=="403":
        consec403+=1; locked+=1
        row["status"]="LOCKED_NOT_PUBLIC"; w.writerow(row); fh.flush()
        if consec403>=10:
            print(f"\nSYSTEMIC 403 ({consec403} consecutive) — STOPPING THE WHOLE RUN.", flush=True)
            break
        time.sleep(max(0, MIN_GAP-(time.time()-t0))); continue
    consec403=0
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
print(f"\nRUN END  ok={ok} failed={fail} locked={locked} resumed-skipped={skipped}", flush=True)
