"use client";

import { useActionState, useState, useTransition } from "react";

import { createPackage, deletePackage, setPackageActive, updatePackage } from "./actions";

type Result = { ok: true } | { ok: false; error: string };

const input =
  "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none";

export type PackageValue = {
  id: string; slug: string; name: string; description: string | null; subject: string | null;
  credits: number; slot_minutes: number; price_minor: number; currency: string;
  stripe_price_id: string | null; validity_months: number | null;
  display_order: number; is_active: boolean;
};

function Feedback({ state }: { state: Result | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Saved.</p>
  ) : (
    <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.error}</p>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export function PackageForm({ subjects, value }: { subjects: string[]; value?: PackageValue }) {
  const [state, submit, pending] = useActionState<Result | null, FormData>(
    value ? updatePackage.bind(null, value.id) : createPackage, null,
  );

  return (
    <form action={submit} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" hint="What a student sees.">
          <input name="name" required defaultValue={value?.name ?? ""} placeholder="Single lesson" className={input} />
        </Field>
        <Field label="Slug" hint="Lower-case, hyphenated. Used in URLs and never shown.">
          <input name="slug" required defaultValue={value?.slug ?? ""} placeholder="single-lesson" className={input} />
        </Field>
        <Field label="Lessons included" hint="1 for a single lesson; 4 or 8 for a bundle.">
          <input name="credits" type="number" min={1} max={100} required defaultValue={value?.credits ?? 1} className={input} />
        </Field>
        <Field label="Lesson length (minutes)">
          <input name="slot_minutes" type="number" min={15} max={480} defaultValue={value?.slot_minutes ?? 60} className={input} />
        </Field>
        {/* ⚠ TYPED IN POUNDS, STORED IN PENCE. The conversion happens in the
            form handler, once — not in a template where 45.00 can become 45. */}
        <Field label="Price" hint="In whole currency units, e.g. 45 or 45.00 — not pence.">
          <input
            name="price" required inputMode="decimal"
            defaultValue={value ? (value.price_minor / 100).toFixed(2) : ""}
            placeholder="45.00" className={input}
          />
        </Field>
        <Field label="Currency" hint="GBP is the billing truth. QAR figures on the site are display only.">
          <input name="currency" defaultValue={value?.currency ?? "GBP"} maxLength={3} className={input} />
        </Field>
        <Field label="Subject" hint="Blank means any subject.">
          <select name="subject" defaultValue={value?.subject ?? ""} className={input}>
            <option value="">Any subject</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Credits expire after (months)" hint="Blank means never.">
          <input name="validity_months" type="number" min={1} max={60} defaultValue={value?.validity_months ?? ""} className={input} />
        </Field>
        <Field label="Stripe price id" hint="Looks like price_1A2b3C… A prod_… id is the product, not the price.">
          <input name="stripe_price_id" defaultValue={value?.stripe_price_id ?? ""} placeholder="price_…" className={input} />
        </Field>
        <Field label="Display order">
          <input name="display_order" type="number" defaultValue={value?.display_order ?? 0} className={input} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" hint="Optional. One line, shown under the name.">
            <input name="description" defaultValue={value?.description ?? ""} className={input} />
          </Field>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_active" defaultChecked={value ? value.is_active : false} className="h-4 w-4" />
        Live — offered to students
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
          {pending ? "Saving…" : value ? "Save changes" : "Add package"}
        </button>
        {value && <a href="?" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancel</a>}
      </div>
      {value && (
        <p className="text-[11px] text-slate-500">
          Changing the price affects the next purchase only. Credits already bought keep what was
          paid for them — the ledger is the receipt, this is the offer.
        </p>
      )}
    </form>
  );
}

export function PackageActions({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button" disabled={pending}
        onClick={() => run(() => setPackageActive(id, !isActive))}
        className={`rounded border px-2.5 py-1 text-xs disabled:opacity-40 ${
          isActive ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-700"
        }`}
      >
        {isActive ? "Live" : "Draft"}
      </button>
      {confirming ? (
        <>
          <span className="text-xs text-red-800">
            Delete this package? Credits already bought keep working, but their receipt loses its
            link to it. Making it a draft keeps that link.
          </span>
          <button type="button" disabled={pending} onClick={() => run(() => deletePackage(id))}
            className="rounded border border-red-600 bg-red-600 px-2.5 py-1 text-xs text-white disabled:opacity-40">Yes</button>
          <button type="button" onClick={() => setConfirming(false)}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs">Cancel</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600">Delete</button>
      )}
      {error && <span className="text-xs text-red-800">{error}</span>}
    </div>
  );
}
