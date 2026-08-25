/**
 * WHICH PAPER WORKSPACES A READER MAY BE SENT TO — A RENDER GATE, NOT A REMOVAL.
 *
 * ============================================================================
 * ⚠ "Take the test" PROMISES FOUR THINGS AND DELIVERS NONE OF THEM.
 * ============================================================================
 * The mode card advertises "Timed exam environment", "Type and save answers",
 * "Flag questions to revisit" and "Submit when finished". The workspace it
 * opens says, in its own copy:
 *
 *     "Answer interface — Not built yet, nothing you type anywhere on this
 *      page is saved."
 *
 * That page is public, and a parent who has just paid 850 QAR reaches it from
 * a prominent yellow button. A dead end behind a paid CTA is worse than no
 * button at all.
 *
 * ⚠ NOTHING IS DELETED. The route, the workspace and the modal all remain, and
 * `classroom` — the teaching tool, which IS built — is still reachable at
 * /past-papers/<slug>/classroom directly. Restoring the CTA is one edit: add
 * "test" back to the array below, once the answer interface actually saves.
 */
export const PAPER_WORKSPACES = ["test", "classroom"] as const;
export type PaperWorkspace = (typeof PAPER_WORKSPACES)[number];

/**
 * ⚠ A SEPARATE FACT FROM "THE ROUTE EXISTS". Both routes exist and both render;
 * this says which of them a reader may be *offered*. Deriving it from the
 * filesystem would make a stub indistinguishable from a finished tool.
 */
export const USABLE_PAPER_WORKSPACES: readonly PaperWorkspace[] = ["classroom"];

export function isWorkspaceUsable(w: PaperWorkspace): boolean {
  return USABLE_PAPER_WORKSPACES.includes(w);
}

/**
 * Whether the student-facing "Start Test" entry point may render at all.
 *
 * ⚠ IT IS GATED ON `test`, NOT ON "ANY WORKSPACE". The button says Start Test
 * and its primary card is the exam. Showing it because the *teacher* mode
 * happens to work would put a parent one click from the same dead end.
 */
export function canOfferPaperTest(): boolean {
  return isWorkspaceUsable("test");
}
