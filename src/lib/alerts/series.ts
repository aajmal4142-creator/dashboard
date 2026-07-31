import type { Payload } from "payload";

import type { MetricSeries } from "./types";

type PeriodDoc = {
  id: string;
  startDate?: string | Date | null;
};

type DatapointDoc = {
  metricKey?: string | null;
  value?: number | null;
  period?: string | { id?: string } | null;
};

function periodIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

/**
 * Load chronological series (oldest → newest) for the given metrics from
 * organisation datapoints, ordered by reporting-period startDate.
 * Optional `seriesOverride` skips DB (tests / evaluate body).
 */
export async function loadMetricSeries(
  payload: Payload,
  organisationId: string,
  metrics: string[],
  seriesOverride?: MetricSeries[],
): Promise<MetricSeries[]> {
  if (seriesOverride) {
    return seriesOverride.filter((s) => metrics.includes(s.metric));
  }

  const unique = [...new Set(metrics.filter(Boolean))];
  if (unique.length === 0) return [];

  const periods = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: organisationId } },
    sort: "startDate",
    limit: 48,
    depth: 0,
    overrideAccess: true,
  });

  const periodDocs = periods.docs as PeriodDoc[];
  const periodIds = periodDocs.map((p) => p.id);
  if (periodIds.length === 0) {
    return unique.map((metric) => ({ metric, values: [] }));
  }

  const points = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { metricKey: { in: unique } },
        { period: { in: periodIds } },
      ],
    },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  });

  const byMetricPeriod = new Map<string, number>();
  for (const raw of points.docs as DatapointDoc[]) {
    const metric = raw.metricKey;
    const pid = periodIdOf(raw.period);
    if (!metric || !pid) continue;
    if (typeof raw.value !== "number" || !Number.isFinite(raw.value)) continue;
    const key = `${metric}::${pid}`;
    const prev = byMetricPeriod.get(key);
    // Sum multiple supplier rows for the same metric/period.
    byMetricPeriod.set(key, (prev ?? 0) + raw.value);
  }

  return unique.map((metric) => {
    const values: number[] = [];
    for (const period of periodDocs) {
      const key = `${metric}::${period.id}`;
      const v = byMetricPeriod.get(key);
      if (v !== undefined) values.push(v);
    }
    return { metric, values };
  });
}

export function metricsNeededFromConditions(
  conditions: Array<{ metric: string; secondaryMetric?: string }>,
): string[] {
  const set = new Set<string>();
  for (const c of conditions) {
    if (c.metric) set.add(c.metric);
    if (c.secondaryMetric) set.add(c.secondaryMetric);
  }
  return [...set];
}
