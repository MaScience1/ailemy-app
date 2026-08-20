import { WEEKDAY_OPTIONS } from "@/lib/admin/schedule-form";
import { SUBJECTS } from "@/lib/public/catalogue";
import { CANONICAL_TZ, formatDay, formatTime } from "@/lib/schedule/timezone";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  AvailabilityActions, AvailabilityForm, BlockActions, BlockForm,
  type AvailabilityValue, type TeacherOption,
} from "./_forms";

/**
 * 1-to-1 availability (§23, §24, §46).
 *
 * ============================================================================
 * ⚠ THIS SCREEN PUBLISHES THE SHAPE OF A SLOT, NOT THE SLOTS
 * ============================================================================
 * A 16:00–19:00 window with 60-minute lessons and a 15-minute gap is three
 * bookable times. Those three are COMPUTED by loadOpenSlots() every time
 * somebody looks, against the group timetable, the blocks, the existing
 * bookings and the holds. Storing them would be storing an answer that goes
 * stale the moment any of those change (0045).
 *
 * So what an admin edits here is intent, and the preview below is the same
 * reader a student hits — not a mock-up of it.
 */
export const dynamic = "force-dynamic";

const WEEKDAY_LABEL = new Map(WEEKDAY_OPTIONS.map((w) => [w.value, w.label]));

type Search = Promise<{ edit?: string }>;

export default async function AdminAvailabilityPage({ searchParams }: { searchParams: Search }) {
  const editing = (await searchParams).edit ?? null;
  const db = createAdminClient();

  /**
   * ⚠ TEACHERS COME FROM user_roles, NOT FROM A LIST OF NAMES. 0045's
   * teacher_id is a real auth.users FK precisely so a booking points at an
   * account that can be authorised; offering a free-text name here would
   * reintroduce the cohorts.teacher_name problem that column was created to
   * escape.
   *
   * auth.users is not reachable through PostgREST, so the emails come from the
   * Admin API. A failure there is reported, never silently rendered as "no
   * teachers" — an empty dropdown that means "we could not ask" is
   * indistinguishable from one that means "there are none".
   */
  const rolesRes = await db.from("user_roles").select("user_id,role");
  const roleRows = (rolesRes.data ?? []) as unknown as { user_id: string; role: string }[];
  const staffRoles = new Map<string, string[]>();
  for (const r of roleRows) {
    if (r.role !== "teacher" && r.role !== "admin") continue;
    staffRoles.set(r.user_id, [...(staffRoles.get(r.user_id) ?? []), r.role]);
  }

  let teachers: TeacherOption[] = [];
  let teacherError: string | null = null;
  try {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    teachers = (data?.users ?? [])
      .filter((u) => staffRoles.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email ?? "(no email)",
        roles: (staffRoles.get(u.id) ?? []).join(", "),
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  } catch (e) {
    // ⚠ THE REFUSAL TRAVELS WITH THE RESULT. Logging this and rendering an
    // empty list is a check reporting a pass.
    teacherError = e instanceof Error ? e.message : String(e);
  }

  const availRes = await db
    .from("teacher_availability")
    .select("id,teacher_id,subject,weekday,specific_date,start_time,end_time,timezone,slot_minutes,buffer_minutes,valid_from,valid_until,booking_horizon_days,booking_cutoff_hours,is_active")
    .order("weekday", { nullsFirst: false });
  const blocksRes = await db
    .from("availability_blocks")
    .select("id,teacher_id,starts_at,ends_at,reason")
    .order("starts_at");

  const dbError = rolesRes.error ?? availRes.error ?? blocksRes.error;
  const notMigrated = dbError && ["PGRST205", "42P01", "PGRST204", "42703"].includes(dbError.code ?? "");

  const windows = (availRes.data ?? []) as unknown as AvailabilityValue[];
  const blocks = (blocksRes.data ?? []) as unknown as {
    id: string; teacher_id: string; starts_at: string; ends_at: string; reason: string | null;
  }[];

  const emailOf = (id: string) => teachers.find((t) => t.id === id)?.email ?? "(unknown teacher)";
  const editWindow = windows.find((w) => w.id === editing) ?? null;

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium">1-to-1 availability</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        When a teacher is willing to teach privately, and when they are not. Individual bookable
        times are worked out from these windows — they are not stored, so changing a window changes
        what is offered everywhere at once.
      </p>

      {dbError && (
        <p role="alert" className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notMigrated
            ? "Migration 0045 has not been applied yet, so the availability tables do not exist. Nothing on this screen can be saved until it is run."
            : "Could not load availability."}{" "}
          <span className="font-mono text-[11px]">{dbError.code}: {dbError.message}</span>
        </p>
      )}

      {teacherError && (
        <p role="alert" className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not list teacher accounts, so the dropdowns below are empty — this is not the same
          as there being no teachers. <span className="font-mono text-[11px]">{teacherError}</span>
        </p>
      )}
      {!teacherError && teachers.length === 0 && (
        <p className="mt-6 rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          No account holds the teacher or admin role yet, so there is nobody to publish availability
          for. Grant a role first — a private booking has to point at an account that can be
          authorised, not at a name.
        </p>
      )}

      <Section
        title="Availability windows"
        subtitle="A window plus a lesson length and a gap. Three 60-minute lessons with a 15-minute gap need 3h15m."
      >
        {editWindow
          ? <AvailabilityForm teachers={teachers} subjects={SUBJECTS.map((s) => s.slug)} value={editWindow} />
          : <AvailabilityForm teachers={teachers} subjects={SUBJECTS.map((s) => s.slug)} />}
        <List empty="No availability published — the 1-to-1 calendar is empty for everyone.">
          {windows.filter((w) => w.id !== editing).map((w) => (
            <Row
              key={w.id}
              head={`${emailOf(w.teacher_id)} — ${
                w.weekday !== null
                  ? `every ${WEEKDAY_LABEL.get(w.weekday as never) ?? `weekday ${w.weekday}`}`
                  : w.specific_date
              }`}
              meta={`${w.start_time.slice(0, 5)}–${w.end_time.slice(0, 5)} ${w.timezone} · ${w.slot_minutes}min lessons, ${w.buffer_minutes}min gap · book ${w.booking_cutoff_hours}h–${w.booking_horizon_days}d ahead · ${w.subject ?? "any subject"}${w.is_active ? "" : " · PAUSED"}`}
              actions={<><EditLink id={w.id} /><AvailabilityActions id={w.id} isActive={w.is_active} /></>}
            />
          ))}
        </List>
      </Section>

      <Section
        title="Blocked time"
        subtitle="Overrides every window above. A whole day is a block whose times cover it — there is no separate list of blocked days to disagree with this one."
      >
        <BlockForm teachers={teachers} />
        <List empty="Nothing blocked.">
          {blocks.map((b) => (
            <Row
              key={b.id}
              head={`${emailOf(b.teacher_id)} — ${formatDay(new Date(b.starts_at), CANONICAL_TZ)}`}
              meta={`${formatTime(new Date(b.starts_at), CANONICAL_TZ)}–${formatTime(new Date(b.ends_at), CANONICAL_TZ)} Doha${b.reason ? ` · ${b.reason} (private)` : ""}`}
              actions={<BlockActions id={b.id} />}
            />
          ))}
        </List>
      </Section>
    </div>
  );
}

/** A link, not a button: opening an edit form is navigation, not a mutation. */
function EditLink({ id }: { id: string }) {
  return (
    <a href={`?edit=${id}`} className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-slate-500">
      Edit
    </a>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-display text-lg font-medium">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

function List({ children, empty }: { children: React.ReactNode[]; empty: string }) {
  if (children.length === 0) return <p className="text-sm text-slate-600">{empty}</p>;
  return <ul className="space-y-2">{children}</ul>;
}

function Row({ head, meta, actions }: { head: string; meta: string; actions: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-start gap-3 rounded border border-slate-200 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{head}</p>
        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{meta}</p>
      </div>
      {actions}
    </li>
  );
}
