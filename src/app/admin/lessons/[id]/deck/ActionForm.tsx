"use client";

import { useActionState } from "react";

import type { ActionResult } from "./actions";

/**
 * The panel's one form primitive, and it exists to kill a defect class: every
 * earlier panel form discarded its server action's ActionResult, so a refusal
 * re-rendered as silence (the publish confusion of 2026-08-22, the family
 * "approval revert" of 2026-08-23 — the write had landed both times). Every
 * result is rendered here: a refusal in red WITH its reason, success as a
 * quiet tick. Controls are disabled while the action is in flight.
 *
 * Authorisation lives in the actions (assertAdmin); this component only makes
 * their answer visible.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [result, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {pending && <span className="text-xs text-slate-400">…</span>}
      {!pending && result && !result.ok && (
        <span role="alert" className="text-xs font-medium text-red-600">
          ✗ {result.reason}
        </span>
      )}
      {!pending && result?.ok && <span className="text-xs text-green-700">✓ {result.detail}</span>}
    </form>
  );
}
