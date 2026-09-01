/**
 * Natural ordering for spec codes: "1.2" before "1.10", numerically per
 * segment, alphabetically when a segment is not a number.
 *
 * ⚠ catalogue/queries.ts has a private specCodeCompare doing the same job; it
 * is deliberately not exported there and that file belongs to another branch's
 * merge footprint, so the comparator is restated here rather than the shared
 * file edited for one import. If a third copy is ever needed, THEN extract one.
 */
export function compareSpecCodes(a: string, b: string): number {
  const as = a.split(".");
  const bs = b.split(".");
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    const x = as[i] ?? "";
    const y = bs[i] ?? "";
    if (x === y) continue;
    const xn = Number(x);
    const yn = Number(y);
    if (Number.isFinite(xn) && Number.isFinite(yn)) return xn - yn;
    return x < y ? -1 : 1;
  }
  return 0;
}
