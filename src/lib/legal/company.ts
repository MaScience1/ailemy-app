/**
 * Company disclosure and legal-page dates, in one place.
 *
 * ⚠ THE FOOTER AND BOTH LEGAL PAGES READ FROM HERE. Three hand-typed copies of
 * a company number is three chances to publish a wrong one, and a wrong company
 * number on a trading site is a Companies Act problem rather than a typo.
 *
 * ⚠ TO_CONFIRM IS RENDERED, NOT HIDDEN. The registration number, registered
 * office and support address were not supplied and are NOT invented here. They
 * render as a visible [TO CONFIRM] so nobody can mistake a placeholder for a
 * fact — including us. Replace the values below and every surface updates.
 */

/** Rendered verbatim wherever a value is still outstanding. */
export const TO_CONFIRM = "[TO CONFIRM]";

export const COMPANY = {
  tradingName: "Ailemy",
  legalName: "Rentic Ltd",
  jurisdiction: "England and Wales",
  /** Companies House registration number. NOT SUPPLIED — do not guess one. */
  companyNumber: TO_CONFIRM,
  /** Registered office address. NOT SUPPLIED. */
  registeredOffice: TO_CONFIRM,
  /**
   * Support / data-protection contact.
   *
   * NOT SUPPLIED and deliberately not inferred: no @ailemy address appears
   * anywhere in this codebase, so any address written here would be invented,
   * and a privacy policy whose contact route does not exist is worse than one
   * that admits the gap.
   */
  supportEmail: TO_CONFIRM,
} as const;

/**
 * The exact disclosure sentence, assembled once.
 * Wording is the founder's, verbatim; only the values are substituted.
 */
export const DISCLOSURE = `${COMPANY.tradingName} is a trading name of ${COMPANY.legalName}, registered in ${COMPANY.jurisdiction}, company no. ${COMPANY.companyNumber}, registered office ${COMPANY.registeredOffice}.`;

/**
 * Last reviewed. Bump BY HAND when the wording changes — never from Date.now(),
 * which would show today's date on a policy nobody has read since March and is
 * the one date on a legal page that must not be automatic.
 */
export const LEGAL_LAST_UPDATED = "19 August 2026";
