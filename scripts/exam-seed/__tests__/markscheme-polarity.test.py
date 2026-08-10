#!/usr/bin/env python3
"""
Polarity of examiner prose — the guard, tested on REAL LINES FROM THE PAPER.

    python3 scripts/exam-seed/__tests__/markscheme-polarity.test.py

============================================================================
WHY THIS SUITE EXISTS
============================================================================
The equation marker scraped species out of accept[] without reading the
polarity of the sentence, so "Do not accept C12H26(g)" ADDED gas to dodecane's
allowed states and awarded full marks for the exact error the examiner's report
says candidates lost the mark for. That bug was one layer downstream of the
extractor, on data the extractor produces.

So the classifier is tested here on lines taken verbatim out of WCH11/01, not
on invented examples — an invented example proves the regex matches itself.

Every line below is real. The [Qn] tag is the question it came from.
"""

import sys
from pathlib import Path

# ⚠ NO BYTECODE CACHE, AND THIS IS NOT HOUSEKEEPING.
#
# Found by sabotage: after the classifier was deliberately broken and then
# RESTORED, this suite went on failing — it was executing the sabotaged
# __pycache__ entry, because "accept" and "reject" are the same length so the
# source size never changed. A suite that runs yesterday's bytecode reports on
# code that no longer exists, in both directions: it would equally have passed
# over a real break. The runner spawns this fresh every time; the cache must
# not survive it.
sys.dont_write_bytecode = True

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import importlib.util

spec = importlib.util.spec_from_file_location(
    "extract_markscheme", Path(__file__).resolve().parents[1] / "extract-markscheme.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
classify = mod.classify

passed = failed = 0


def check(name, ok, got=None):
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✓ {name}")
    else:
        failed += 1
        print(f"  ✗ {name}" + (f"  got: {got!r}" if got is not None else ""))


def kind(text):
    return classify(text)[0]


def escalated(text):
    return classify(text)[2]


print("── 'Do not award' is a PROHIBITION, and every one in the paper reads as one ──")
# ⚠ 23(c)(ii)'s is the exact line that broke the marker downstream.
for line in [
    "Do not award ions move",
    "Do not award charges",
    "Do not award if charges are shown",
    "Do not award Na+2",
    "Do not award all dots or all crosses for the oxide",
    "Do not award M1 if suggestion that sodium",
    "Do not award comments about repulsion between",
    "Do not award reference to breaking covalent bonds",
    "Do not accept C12H26(g)",
]:
    check(f"reject: {line[:52]}", kind(line) == "reject", kind(line))

print("\n── ...and is NEVER read as the permission it contains as a substring ──")
# "Do not allow multiples" contains "allow multiples". That substring is why
# the downstream bug happened, in both directions.
for line, why in [
    ("Do not allow multiples", "contains 'allow multiples'"),
    ("Do not accept 13H2O(g)", "contains 'accept 13H2O(g)'"),
]:
    check(f"{why} -> reject", kind(line) == "reject", kind(line))

print("\n── Accept / Allow are permissions ──")
for line in [
    "Accept 13H2O(g)",
    "Allow multiples",
    "Allow 306 (kg)",
    "Allow 307000 / 306000 g",
    "Allow ±1 small square",
    "Allow log axis on y axis",
    "Allow 1 mark for two correct non skeletal formulae",
]:
    check(f"accept: {line[:52]}", kind(line) == "accept", kind(line))

print("\n── 'Ignore X' means AWARD DESPITE X ──")
# Edexcel's own convention, recorded in the fixture header's column mapping.
for line in [
    "Ignore any reference to carbon dioxide and water",
    "Ignore state symbol on electron",
    "Ignore lines between points / line of best fit",
    "Ignore any names even if incorrect",
]:
    check(f"accept: {line[:52]}", kind(line) == "accept", kind(line))

print("\n── CONDITIONALS ARE RULINGS. They are refused, not filed. ──")
# "Ignore SF except 1 SF" leads with a permission and then takes it back. Filing
# it under accept[] would tell the marker to ignore significant figures
# unconditionally — the opposite of half the sentence.
for line in [
    "Ignore SF except 1 SF",
    "Ignore SF except for 1 SF",
    "TE on M1 and M2 but no TE from M3 to M4",
    "TE throughout, but final answer must be less than",
    "Correct answer with no working scores (4)",
    "Correct answer with some working scores 3",
    "If all six operations have not been carried out ignore SF",
]:
    check(f"REFUSED: {line[:52]}", kind(line) is None and escalated(line) != [], classify(line))

print("\n── ...and each refusal SAYS WHY, so a reviewer knows what to rule on ──")
check("'except' names the conditional",
      any("conditional" in r for r in escalated("Ignore SF except 1 SF")),
      escalated("Ignore SF except 1 SF"))
check("'but no' names the inversion",
      any("inversion" in r for r in escalated("TE on M1 and M2 but no TE from M3 to M4")),
      escalated("TE on M1 and M2 but no TE from M3 to M4"))
check("working conditions are named as such",
      any("working" in r for r in escalated("Correct answer with some working scores 3")),
      escalated("Correct answer with some working scores 3"))
check("an SF rule is named as needing a decision",
      any("significant-figure" in r for r in escalated("Ignore SF except for 1 SF")),
      escalated("Ignore SF except for 1 SF"))

print("\n── 'unless' and 'only if' invert, and must be refused ──")
for line in [
    "Allow the answer unless the units are omitted",
    "Award M2 only if M1 has been awarded",
    "Accept any value provided that working is shown",
    "Allow 306 unless rounded incorrectly",
]:
    check(f"REFUSED: {line[:52]}", kind(line) is None, classify(line))

print("\n── A NEGATION MID-LINE MAKES THE POLARITY MIXED ──")
# Leading keyword says permission, the rest says otherwise. Filing it as either
# is a coin flip, so it is filed as neither.
for line in [
    "Allow multiples but not fractions",
    "Accept 13H2O(g) but do not accept 13H2O(s)",
]:
    check(f"REFUSED: {line[:52]}", kind(line) is None, classify(line))

print("\n── ORDINARY GUIDANCE IS NEITHER, AND IS NOT ESCALATED ──")
# A check that fires on everything is a check nobody reads.
for line in [
    "Example of calculation",
    "10/58 = 0.17241 mol butane",
    "C12H26(l) + 18.5O2(g) 12CO2(g) + 13H2O(l)",
]:
    check(f"guidance: {line[:52]}", kind(line) == "guidance", classify(line))

print(f"\n{'✓ ALL' if failed == 0 else '✗'} {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
