# The three commitment tabs are visible, and the guards that policed them are gone

**Founder ruling, 25 August 2026.** Monthly, 3-month and Academic-year all render
on all three cohorts (AS, Y11, Y10).

This note exists because **the code no longer contains the evidence.** The guards
that would have made the exposure below fail a test run were removed to allow the
ruling, so a later session reading the source alone has no way to discover it.

---

## The exposure, measured from rendered HTML

**All three tabs within a cohort resolve to that cohort's single monthly Payment
Link.** The displayed total changes with the tab. The charge does not.

| cohort | all three tabs resolve to |
|---|---|
| Edexcel IAL Chemistry AS | `https://buy.stripe.com/3cI28q90F9Rt0WR0x43ZK00` |
| Year 11 GCSE / IGCSE | `https://buy.stripe.com/9B63cub8N5BdfRL6Vs3ZK01` |
| Year 10 GCSE / IGCSE | `https://buy.stripe.com/bJe00i4Kp3t58pj5Ro3ZK02` |

Three links, one per cohort — not one shared link. Within each cohort the
commitment tab is presentational: on AS the page shows 850 / 2,300 / 7,000 QAR
and sends all three to the 850 checkout.

## What the pill row IS guarded on, since 26 Aug

`prod-routes.test.ts` now reads `/tuition` from a real response and asserts, per
cohort — 29 assertions across the three:

- the pill row was **located** (so no count below can be vacuously green)
- **exactly three** pills, and exactly the three expected `data-cta` values
- each pill's text **equals** `1 month` / `3 months` / `Academic year` — equality,
  not "contains", because "contains" is satisfied by `3 months Best value`
- no pill carries a value claim (`best value`, `saving`, `save`, `~n%`)
- `1 month` is selected **and is the only one** selected

Re-confirm it bites with either sabotage — both were run, both went red, both
restored green:

| sabotage | result |
|---|---|
| hardcoded `Best value` span on the 3-month pill | **6 red** (label equality + value claim, x3 cohorts) |
| delete the Academic-year pill | **12 red** (row located + count + label + claim, x3) |

⚠ **The mis-sale assertions are still deliberately absent, and must stay absent.**
This guard covers the row EXISTING and being CLEAN. It says nothing about
price-vs-link, because the exposure below is knowingly accepted. Do not "restore
the missing four" here — read the next section first.

## What was removed to allow it

Both were deleted, not skipped — a disabled guard reads as coverage.

- **`scripts/exam-seed/__tests__/commitment-gate.test.ts`** — the whole file, 21
  assertions. Its subject (`PURCHASABLE_COMMITMENTS`, `isPurchasable`,
  `effectiveCommitment`) no longer exists.
- **`scripts/exam-seed/__tests__/prod-routes.test.ts`** — a 61-line rendered-HTML
  section, 8 assertions. Four of them were the mis-sale guard:
  1. `?commitment=three_month does NOT render the three_month tab`
  2. `?commitment=three_month shows exactly the monthly prices`
  3. `?commitment=academic_year does NOT render the academic_year tab`
  4. `?commitment=academic_year shows exactly the monthly prices`

Restoring that section against the current build fails on exactly those four.
That is the cheapest way to re-confirm this note is still true.

Also dropped: the `/isPurchasable/` clause in `course-roadmap.test.ts` — added by
the i18n commit, not by the hide branch, so it was invisible in the diff.

## What would have to be true to re-add them

1. **A Payment Link per commitment per cohort** — nine links, not three — so the
   tab a parent selects determines what Stripe charges. Today `cohorts.enrolment_url`
   holds one link and has no package dimension.
2. **The AS academic-year price corrected.** At 7,000 QAR it is beaten by three
   3-month blocks at **3 × 2,300 = 6,900**.

   ⚠ **This arithmetic no longer exists anywhere in the code.** `cheapestFor()`
   used to encode it and refused to badge the AS academic year; on 26 Aug the
   founder ruled the site should not make the comparison at all while that price
   stands, so the helper, its five tests and `tuition.bestValueOver` were all
   deleted. This paragraph is now the only record. The price is still wrong.

   `tuition.saveAmount` ("Save 250 QAR") was kept: it is a subtraction between
   two Stripe amounts in one currency, not a judgement about which to buy.

Until both hold, restoring the guards will correctly go red.
