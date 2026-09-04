/**
 * Natural ordering for spec codes: "1.2" before "1.10", numerically per
 * segment, alphabetically when a segment is not a number.
 *
 * A segment may carry a letter SUFFIX on its number — IGCSE 4CH1's official
 * codes mark Chemistry-only (Paper 2-only) statements with a trailing C, as
 * in "1.5C" — so a segment compares by its numeric prefix first and its
 * suffix second: 1.5C < 1.10 (5 < 10), never the lexical "10" < "5C". A
 * segment with no digits at all still falls back to the alphabetic compare.
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
    const xm = /^(\d+)(.*)$/.exec(x);
    const ym = /^(\d+)(.*)$/.exec(y);
    if (xm && ym) {
      const diff = Number(xm[1]) - Number(ym[1]);
      if (diff !== 0) return diff;
      return xm[2] < ym[2] ? -1 : 1; // same number, different suffix ("" < "C")
    }
    return x < y ? -1 : 1;
  }
  return 0;
}
