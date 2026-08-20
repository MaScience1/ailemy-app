import { groupDemand, demandLabel, type InterestRow } from "@/lib/admin/demand";
import { interestCapabilities } from "@/lib/public/interest-schema";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tuition demand (§52).
 *
 * ⚠ SERVICE ROLE, AND THAT IS THE ONLY WAY THIS PAGE CAN EXIST. 0040 gives
 * anon INSERT and no SELECT, and gives authenticated SELECT only behind
 * is_staff(). This is PII — names, emails, phone numbers, a child's year group
 * — so who may see it is decided by /admin/layout.tsx (which redirects a
 * non-admin before this renders) and by the proxy, not by weakening a policy.
 *
 * ⚠ IT DOES NOT WRITE. §52 asks to SEE demand. Status editing is a separate
 * change with its own server action and its own audit question, and shipping a
 * read-only screen first means nothing here can corrupt a registration.
 */
export const dynamic = "force-dynamic";

const BASE = "id,subject,qualification,status,created_at,country,ready_to_start";
const WITH_DEMAND = `${BASE},year_group,exam_year`;

export default async function DemandPage() {
  const { hasDemandFields, reason } = await interestCapabilities();
  const db = createAdminClient();

  // ⚠ THE COLUMN LIST FOLLOWS THE PROBE. Naming year_group before 0043 is
  // applied fails the whole query with PGRST204, and an admin would see "could
  // not load" for a table that is perfectly readable.
  const { data, error } = await db
    .from("interest_registrations")
    .select(hasDemandFields ? WITH_DEMAND : BASE)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as InterestRow[];
  const groups = groupDemand(rows);
  const totalOpen = groups.reduce((n, g) => n + g.open, 0);

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium">Tuition demand</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Everyone who has registered interest, grouped by what they asked for. Declined and
        duplicate registrations are excluded; converted ones still count, because a cohort that
        filled is evidence it should run again.
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load registrations.{" "}
          <span className="font-mono text-[11px]">{error.code}: {error.message}</span>
        </p>
      )}

      {!hasDemandFields && (
        // ⚠ SAID OUT LOUD. Without 0043 every row groups under one bucket per
        // subject+qualification and the year-group column is empty. An operator
        // must not read that as "nobody gave a year group".
        <p className="mt-6 rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Migration <span className="font-mono">0043</span> has not been applied, so year group and
          exam year are not recorded yet and the public form does not ask for them. Grouping below
          is by subject and qualification only.
          {reason && <span className="ml-1 font-mono text-[11px] text-slate-500">({reason})</span>}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-6 border-y border-slate-200 py-4">
        <Stat label="Registrations" value={rows.length} />
        <Stat label="Demand groups" value={groups.length} />
        <Stat label="Still open" value={totalOpen} />
      </div>

      {rows.length === 0 && !error && (
        <p className="mt-6 text-sm text-slate-600">No registrations yet.</p>
      )}

      <ul className="mt-6 space-y-2">
        {groups.map((g) => (
          <li key={g.key} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white px-5 py-4">
            <span className="font-display text-lg font-medium text-slate-900">{demandLabel(g)}</span>
            <span className="font-mono text-sm text-slate-900">
              {g.total} interested
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {g.open} open
              {g.readyToStart > 0 && ` · ${g.readyToStart} ready to start`}
              {g.earliestExamYear !== null && ` · earliest exam ${g.earliestExamYear}`}
              {!g.yearGroup && hasDemandFields && " · no year group given"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display text-2xl">{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
    </div>
  );
}
