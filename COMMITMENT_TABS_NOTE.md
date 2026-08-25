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
   3-month blocks at **3 × 2,300 = 6,900**. `cheapestFor()` already refuses to
   badge it — AS shows "Best value" on 3-month and `~8% saving` on the academic
   year. The badge is honest; the price is the thing that is wrong.

Until both hold, restoring the guards will correctly go red.
