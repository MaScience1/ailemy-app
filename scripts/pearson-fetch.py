"""
Download Pearson past-paper PDFs, verify them, then rename. Read-only on the
corpus until the rename step; never deletes.

============================================================================
HOW THE DOCUMENTS ARE FOUND
============================================================================
qualifications.pearson.com's past-paper page is an Angular app whose static
HTML holds no document links. Its search backend is Algolia, reachable from
the scope of the page's own `pastpaperSearchCtrl`:

    index  qualifications-uk_LIVE_master-content
    app    L639T95U5A

That is the public search-only key shipped to every visitor. It queries the
same public catalogue the site's UI queries and unlocks nothing gated; every
record used carries `gating: False`.

Three properties of that index, each of which cost a wrong answer first:

  1. `description` does NOT reliably carry the paper code. Most records hold
     "Paper 1 - Core Physics I" or an empty string. Match on the URL basename
     and the structured `category` facets instead.
  2. Results truncate at 1000 with no pagination, against nbHits up to 3013.
     A broad query returns one series and looks exactly like an absence.
  3. The autumn 2020 series is tagged `October-2020`, not November, and its
     mark scheme uses the `msc` token rather than `rms`.

============================================================================
WHY HTTP 200 IS NOT ENOUGH
============================================================================
Pearson serves "not found" as a 200 with a ~150 KB HTML page, never a 404.
Six such pages were returned during the 29 Aug run. The %PDF header and
structural parse are what catch them; status alone would have renamed error
pages as papers.

============================================================================
WHY THE QUESTION PAPER NEVER DECIDES THE SERIES
============================================================================
Series is resolved at IDENTITY level: MS and ER agreeing beats a single MS or
ER, which beats QU. Copyright and publication lines are excluded as evidence,
and the folder is never evidence.

On the 29 Aug run four question papers would have been filed wrongly on their
own evidence: three carried no series line at all, and 8PH0/01 October-
November 2020 carries a MAY 2020 cover date because Pearson reused a paper
printed for the cancelled summer sitting. That is a property of the series,
not a defect.

Note also that a QU's URL carries the SITTING date while MS/ER carry the
series PUBLICATION date, so a question paper's URL cannot be derived from a
verified sibling's.
"""
import re
from pypdf import PdfReader

# ── K. A copyright or publication line is NOT an exam series. ────────────────
# The 27 Aug false-positive came from exactly this shape:
#   "Specimen Papers - Issue 1 - October 2015 (c) Pearson Education Limited 2015"
PUBLICATION = re.compile(
    r'©|\(c\)|copyright|all rights reserved'
    r'|pearson education limited|specimen paper|issue\s*\d'
    r'|publications?\s*code|registered office|vat reg',
    re.I,
)
MONTHS = {
    "january":"January","jan":"January",
    "may":"May-June","june":"May-June","summer":"May-June",
    "may/june":"May-June","may-june":"May-June",
    "october":"October-November","november":"October-November",
    "oct":"October-November","nov":"October-November",
    "autumn":"October-November","winter":"October-November",
}
MONTH_RE = re.compile(
    r'\b(January|Jan|May/June|May-June|May|June|Summer|October|November|Oct|Nov|Autumn|Winter)\b',
    re.I)
YEAR_RE = re.compile(r'\b(20\d{2})\b')

def pages_text(path, maxp=4):
    r = PdfReader(path)
    for i in range(min(maxp, len(r.pages))):
        t = (r.pages[i].extract_text() or "")
        if t.strip():
            yield i + 1, t

def extract(path):
    """Return {series, year, line, page, rejected} — line/page are VERBATIM (K)."""
    rejected = []
    for pageno, text in pages_text(path):
        for raw in text.split("\n"):
            line = raw.strip()
            if not line:
                continue
            m, y = MONTH_RE.search(line), YEAR_RE.search(line)
            if not (m and y):
                continue
            if PUBLICATION.search(line):
                rejected.append({"page": pageno, "line": line})   # K: never priority 1
                continue
            return {"series": MONTHS[m.group(1).lower()], "year": int(y.group(1)),
                    "line": line, "page": pageno, "rejected": rejected}
    return {"series": None, "year": None, "line": None, "page": None, "rejected": rejected}

# ── L. Precedence within a matched identity. Folder/YYYYMMDD are NEVER evidence.
def resolve(triplet):
    """triplet: {'MS':res|None,'ER':res|None,'QU':res|None} -> (verdict, why)."""
    ms, er, qu = triplet.get("MS"), triplet.get("ER"), triplet.get("QU")
    def val(r): return (r["series"], r["year"]) if r and r["series"] else None
    vms, ver, vqu = val(ms), val(er), val(qu)
    if vms and ver:
        if vms == ver:
            return vms, "MS and ER agree (priority 1)"
        return None, f"BLOCK — MS says {vms} and ER says {ver}; they disagree"
    if vms or ver:
        single = vms or ver
        who = "MS" if vms else "ER"
        if vqu and vqu != single:
            return single, f"single {who} {single} overrides conflicting QU {vqu}"
        return single, f"single {who} (priority 2)"
    if vqu:
        return vqu, "QU alone (priority 3) — no MS and no ER"
    return None, "BLOCK — no session evidence in any component"

# ---------------------------------------------------------------------------
import sys, os, json, time, hashlib, subprocess, re, shutil
from pypdf import PdfReader

STAGE = "/Users/muhammed/Desktop/Ailemy/Pearson-missing-ready"
QUAR  = os.path.join(STAGE, "_quarantine")
RAW   = os.path.join(STAGE, "_raw")
SESSION_OF = {"01":"January","06":"May-June","11":"October-November"}
os.makedirs(RAW, exist_ok=True); os.makedirs(QUAR, exist_ok=True)

def get(url, dest):
    r = subprocess.run(["curl","-sS","-L","--max-time","300","-o",dest,
                        "-w","%{http_code}",url], capture_output=True, text=True)
    return r.stdout.strip(), r.stderr.strip()

def is_pdf(p):
    try:
        with open(p,"rb") as f:
            if f.read(5) != b"%PDF-": return False, "no %PDF- header"
        PdfReader(p)                      # structural parse
        return True, ""
    except Exception as e:
        return False, f"{type(e).__name__}: {str(e)[:80]}"

def hashes(p):
    b=open(p,"rb").read()
    return hashlib.sha256(b).hexdigest(), hashlib.md5(b).hexdigest(), len(b)

def code_in_pdf(p, code, entry):
    """Requirement 3: the paper code and component must be IN the document."""
    try: rd=PdfReader(p)
    except Exception: return False, ""
    txt="".join((rd.pages[i].extract_text() or "") for i in range(min(3,len(rd.pages))))
    flat=re.sub(r'\s+','',txt).upper()
    hit_code = code.upper() in flat
    hit_entry = bool(re.search(re.escape(code.upper())+r'[/\\]?0?'+re.escape(entry.upper()), flat))
    return hit_code, ("code+entry" if hit_entry else ("code only" if hit_code else "neither"))

def run(manifest):
    out=[]
    for ident in manifest:
        code, entry, mmyy = ident["code"], ident["entry"], ident["mmyy"]
        want = (SESSION_OF[mmyy[:2]], 2000+int(mmyy[2:]))
        print(f"\n=== {code}/{entry} {mmyy} — want {want[0]} {want[1]} ===")
        got={}
        for typ, url in ident["urls"].items():
            if not url: print(f"  {typ}: NOT FOUND (no published URL)"); continue
            orig=url.rsplit("/",1)[-1]
            dest=os.path.join(RAW, orig)
            http, err = get(url, dest)
            size=os.path.getsize(dest) if os.path.exists(dest) else 0
            print(f"  {typ}: HTTP {http}  {size}B  {orig}")
            if http!="200" or size==0:
                print(f"      FAILED download ({http}); quarantining"); 
                if os.path.exists(dest): shutil.move(dest, os.path.join(QUAR, orig))
                continue
            ok,why=is_pdf(dest)
            if not ok:
                print(f"      NOT A VALID PDF: {why}; quarantined")
                shutil.move(dest, os.path.join(QUAR, orig)); continue
            hc, hw = code_in_pdf(dest, code, entry)
            ex = extract(dest)
            print(f"      pdf ok | code {hw} | series {ex['series']} {ex['year']} p{ex['page']} {ex['line']!r}")
            got[typ]={"path":dest,"orig":orig,"url":url,"ex":ex,"code_hit":hc,"code_how":hw}
            time.sleep(2)                                  # amendment G
        ident["got"]=got
        out.append(ident)
    return out

if __name__ == "__main__":
    man=json.load(open(sys.argv[1]))
    res=run(man)
    json.dump(res, open(sys.argv[2],"w"), default=str)
