#!/usr/bin/env python3
"""
Independent ground-truth probe for a .pptx deck.

⚠ THIS IS DELIBERATELY A SECOND IMPLEMENTATION. ingest.py builds the manifest
with ElementTree; this file derives the same headline numbers with plain regex
over the raw XML. The deck tests compare the two, so a parsing bug in either
path shows up as a disagreement instead of both silently agreeing with
themselves. Do not "refactor" this to share code with ingest.py — the value IS
the duplication.

⚠ A BUILD STEP IS A DIRECT-CHILD <p:par> OF THE MAIN SEQUENCE'S childTnLst.
Counting clickEffect nodes alone under-groups: a click's withEffect companions
live in the SAME par and reveal on the SAME click. Counting <p:cond
evt="onClick"> finds nothing at all in decks (like these) that mark clicks
with nodeType="clickEffect" — that mistake reported this deck as unanimated
once already.
"""
import json, re, sys, zipfile

def probe(path: str) -> dict:
    z = zipfile.ZipFile(path)
    # ⚠ PRESENTATION ORDER, NOT FILENAME ORDER — slideN.xml numbering has gaps
    # wherever a slide was ever deleted, and page numbers are positional.
    pres = z.read("ppt/presentation.xml").decode("utf8", "replace")
    rels = z.read("ppt/_rels/presentation.xml.rels").decode("utf8", "replace")
    rel_to_target = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    lst = re.search(r"<p:sldIdLst>(.*?)</p:sldIdLst>", pres, re.S)
    slide_names = [
        "ppt/" + rel_to_target[rid].removeprefix("ppt/")
        for rid in re.findall(r'r:id="([^"]+)"', lst.group(1) if lst else "")
        if rid in rel_to_target
    ]
    out = {"slideCount": len(slide_names), "steps": {}, "frameCount": 0}
    for sn in slide_names:
        xml = z.read(sn).decode("utf8", "replace")
        n = slide_names.index(sn) + 1  # position, not filename number
        # Isolate the main sequence, then count its DIRECT child <p:par> blocks.
        m = re.search(r'nodeType="mainSeq".*?<p:childTnLst>(.*)</p:seq>', xml, re.S)
        steps = 0
        if m:
            body, depth, i = m.group(1), 0, 0
            for tag in re.finditer(r"<p:par>|</p:par>", body):
                if tag.group(0) == "<p:par>":
                    if depth == 0:
                        steps += 1
                    depth += 1
                else:
                    depth -= 1
        out["steps"][str(n)] = steps
        out["frameCount"] += steps + 1
    return out

if __name__ == "__main__":
    print(json.dumps(probe(sys.argv[1]), indent=2))
