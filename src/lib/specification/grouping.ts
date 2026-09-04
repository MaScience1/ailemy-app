/**
 * Topic → unit grouping — the ONE place the specification tree decides where
 * a topic hangs.
 *
 * ============================================================================
 * ⚠ A TOPIC IS NEVER DROPPED FOR LACKING A UNIT
 * ============================================================================
 * 0001 made topics.unit_id NULLABLE "so curricula without units still work",
 * and bulk-import-papers.ts deliberately creates NO units rows for GCSE and
 * IGCSE courses — their specifications are organised as topics directly under
 * the course (IGCSE Chemistry 4CH1: four numbered content sections, no unit
 * layer). Until 2026-09-04 both tree builders filtered topics by
 * `t.unitId === u.id`, which silently discarded every unit-less topic: a
 * fully seeded unit-less course rendered as "not mapped yet". This module
 * exists so that defect cannot be reintroduced in one caller and not the
 * other (queries.ts and taxonomy.ts build the same hierarchy for different
 * pages).
 *
 * The contract:
 *  - one group per unit, in the order given, holding its own topics in the
 *    order given;
 *  - every topic whose unit_id is NULL — or names a unit that is not in the
 *    list, which the FK should make impossible but a malformed read must not
 *    turn into a vanished topic — lands in ONE trailing group with
 *    `unit: null`;
 *  - the trailing group exists only when such topics exist, so a fully
 *    unit-ed course (IAL) produces exactly what it always did.
 *
 * Callers render a `unit: null` group under UNGROUPED_UNIT_ID. When it is the
 * course's ONLY group the UI shows no group heading and no group filter at
 * all — the topics ARE the top level, which is what the qualification's own
 * specification says. Alongside real units it is named honestly ("Ungrouped")
 * rather than hidden, because a topic that lost its unit is data damage the
 * page should surface, never absorb.
 *
 * Pure: no database, no imports. Tested with no credentials in
 * scripts/exam-seed/__tests__/specification-unitless.test.ts.
 */

/**
 * The id the synthetic group renders under. Never a real row id: Postgres ids
 * here are uuids, so this cannot collide. It appears in the `?unit=` URL
 * param only in the mixed (damaged-hierarchy) case, where filtering by it is
 * as legitimate as filtering by any unit.
 */
export const UNGROUPED_UNIT_ID = "__ungrouped__";

export type UnitGroup<U, T> = {
  /** null = the trailing group of topics that belong to no unit. */
  unit: U | null;
  topics: T[];
};

export function groupTopicsByUnit<U extends { id: string }, T extends { unitId: string | null }>(
  units: U[],
  topics: T[],
): UnitGroup<U, T>[] {
  const groups: UnitGroup<U, T>[] = units.map((unit) => ({
    unit,
    topics: topics.filter((t) => t.unitId === unit.id),
  }));
  const unitIds = new Set(units.map((u) => u.id));
  const orphans = topics.filter((t) => t.unitId === null || !unitIds.has(t.unitId));
  if (orphans.length > 0) groups.push({ unit: null, topics: orphans });
  return groups;
}
