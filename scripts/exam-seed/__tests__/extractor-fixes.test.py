#!/usr/bin/env python3
"""
The three things the guidance column lost.

Run:  python3 scripts/exam-seed/__tests__/extractor-fixes.test.py

============================================================================
ALL THREE ARE THE SAME MISTAKE: THE EXTRACTOR DECIDED, AND NOBODY SAW IT
============================================================================
An audit of WCH11/01 found 61 lines read, classified, and filed into
accept[]/guidance[]/reject[] — buckets the review surface never shows. Only
requiresRuling reaches a reviewer, so those questions displayed "0 to rule",
were approved, and emitted. And toFixture reads ONLY requiresRuling, so 22 of
23 bucket lines never reached the emitted fixture at all: the examiner never
saw them AND the seeder never got them.

⚠ FIXTURES ONLY. This never opens a PDF and never touches
unit-1-may-june-2025 — the strings below are quoted from the audit output.
"""
import sys, os, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "extractor", os.path.join(HERE, "..", "extract-markscheme.py"))
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)

passed = failed = 0
def t(name, cond, got=None):
    global passed, failed
    if cond:
        passed += 1; print("  ✓ " + name)
    else:
        failed += 1
        print("  ✗ " + name + (f"  got: {got!r}" if got is not None else ""))

print("── (i) A CONCESSION IN THE GUIDANCE COLUMN IS ESCALATED, NOT FILED ──")
# The four lines from 20(b)(iii) that nobody was ever asked about.
for line in ["Allow 306 (kg)", "Allow 307000 / 306000 g",
             "Ignore any names even if incorrect",
             "Allow 1 mark for two correct non skeletal formulae",
             "Do not award reference to breaking covalent bonds",
             "Ignore state symbol on electron"]:
    kind, conf, esc = ex.classify(line)
    reasons = esc + ex.guidance_cell_escalations(line, kind)
    t(f'"{line[:44]}" escalates', len(reasons) > 0, reasons)

t('"307 (kg)" — the ANSWER — escalates',
  len(ex.guidance_cell_escalations("307 (kg)", "guidance")) > 0)
t('  ...and the reason says it looks like the answer',
  any("ANSWER" in r for r in ex.guidance_cell_escalations("307 (kg)", "guidance")))
t('"(check mole ratio from 20bii)" escalates',
  len(ex.guidance_cell_escalations("(check mole ratio from 20bii)", "guidance")) > 0)

# ⚠ AND WORKED ARITHMETIC MUST STILL PASS THROUGH. Otherwise "escalate
# everything" is not a fix, it is a way of flagging the whole paper.
for line in ["(11400) × 9.25 = 105 450 (1.0545 × 105)",
             "10/58 = 0.17241 mol butane",
             "Example of calculation"]:
    t(f'"{line[:40]}" does NOT escalate',
      len(ex.guidance_cell_escalations(line, "guidance")) == 0,
      ex.guidance_cell_escalations(line, "guidance"))

t("ANTI-VACUITY — escalation is selective, not universal",
  len(ex.guidance_cell_escalations("Allow 306 (kg)", "accept")) > 0
  and len(ex.guidance_cell_escalations("Example of calculation", "guidance")) == 0)

print("\n── (ii) A SENTENCE CUT IN TWO IS REJOINED, THEN FLAGGED ──")
# The live case: 22(c) carried these as two separate rows.
rows = [
    {"text": "TE throughout, but final answer must be less than", "confidence": 0.4},
    {"text": "100%", "confidence": 0.6},
    {"text": "Ignore SF except for 1 SF", "confidence": 0.4},
]
joined = ex.join_truncations(rows)
t("three rows become two", len(joined) == 2, [r["text"] for r in joined])
t("the halves are rejoined",
  joined[0]["text"] == "TE throughout, but final answer must be less than 100%",
  joined[0]["text"])
t("the join is FLAGGED, not silent",
  any("rejoined" in r for r in joined[0].get("requiresRuling", [])),
  joined[0].get("requiresRuling"))
t("confidence drops, so it sorts to the top of the queue",
  joined[0]["confidence"] <= 0.4, joined[0]["confidence"])
t("the untouched row survives unchanged",
  joined[1]["text"] == "Ignore SF except for 1 SF")

# ⚠ IT MUST NOT JOIN THINGS THAT ARE NOT CONTINUATIONS.
solo = ex.join_truncations([
    {"text": "Ignore SF except for 1 SF", "confidence": 0.4},
    {"text": "Allow TE throughout", "confidence": 0.4},
])
t("two complete sentences are NOT joined", len(solo) == 2, [r["text"] for r in solo])
t("a trailing connective with nothing after it is left alone",
  len(ex.join_truncations([{"text": "must be less than", "confidence": 0.4}])) == 1)
long_next = ex.join_truncations([
    {"text": "TE throughout, but final answer must be less than", "confidence": 0.4},
    {"text": "a very long following sentence that is plainly its own separate remark entirely", "confidence": 0.6},
])
t("a long following row is not swallowed as a fragment", len(long_next) == 2)

print("\n── (iii) A DRAWING-ONLY ANSWER CELL SAYS SO ──")
# 20(b)(iv): two marking points whose criterion is the empty string.
pts = [{"pointCode": "M1", "criterion": ""}, {"pointCode": "M2", "criterion": "   "}]
kept, problems = ex.image_answer_problems(pts)
t("no empty marking point is emitted", len(kept) == 0, kept)
t("a problem is reported instead", len(problems) == 1, problems)
t("  ...naming it an image answer", "image answer" in problems[0], problems[0])
t("  ...and saying what to do about it",
  "hand-transcribe" in problems[0].lower(), problems[0])
t("  ...and how many are affected", "2 marking point" in problems[0], problems[0])

mixed = [{"pointCode": "M1", "criterion": "a real criterion"}, {"pointCode": "M2", "criterion": ""}]
kept2, problems2 = ex.image_answer_problems(mixed)
t("a real point beside an empty one survives", len(kept2) == 1 and kept2[0]["pointCode"] == "M1")
t("  ...and the empty one is still reported", len(problems2) == 1)

fine = [{"pointCode": "M1", "criterion": "a real criterion"}]
kept3, problems3 = ex.image_answer_problems(fine)
t("a sound block reports nothing", problems3 == [] and len(kept3) == 1)
t("ANTI-VACUITY — it does not report on every block",
  len(ex.image_answer_problems(fine)[1]) == 0 and len(ex.image_answer_problems(pts)[1]) == 1)

print(f"\n{'✓ ALL' if failed == 0 else '✗'} {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
