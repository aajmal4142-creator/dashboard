/** Flag datapoints that look stale relative to the reporting year. */

export function isStaleDatapoint(opts: {
  enteredAt?: string | null;
  periodEnd?: string | null;
  factorYear?: number | null;
  reportingYear: number;
}): { stale: boolean; reason: string | null } {
  const { enteredAt, periodEnd, factorYear, reportingYear } = opts;
  if (factorYear != null && factorYear < reportingYear - 1) {
    return {
      stale: true,
      reason: `Factor year ${factorYear} is older than reporting year ${reportingYear}.`,
    };
  }
  if (enteredAt && periodEnd) {
    const entered = Date.parse(enteredAt);
    const end = Date.parse(periodEnd);
    if (
      Number.isFinite(entered) &&
      Number.isFinite(end) &&
      entered > end + 1000 * 60 * 60 * 24 * 180
    ) {
      return {
        stale: true,
        reason: "Entered long after the period ended — confirm it still applies.",
      };
    }
  }
  return { stale: false, reason: null };
}
