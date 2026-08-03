import type { Payload } from "payload";

import { calculateEmissionsPerEmployee } from "@/lib/analytics/consumptionIntensity";
import { DATA_METRIC_BY_KEY } from "@/lib/data/metrics";
import { loadMetricSeries } from "@/lib/alerts/series";
import {
  computeOrgKpiSnapshot,
  computeOrgKpiSnapshotForPeriod,
} from "@/lib/realtime/broadcast";
import {
  SUPPLIER_REPORTED_METRIC,
  SUPPLIER_SPEND_ESTIMATE_METRIC,
} from "@/lib/suppliers";
import { NO_SUPPLIER_KEY } from "@/lib/suppliers/supplierKey";

import type { TimeRange } from "./types";
import type {
  WidgetChartPayload,
  WidgetDataPayload,
  WidgetMetricPayload,
  WidgetTableOrListPayload,
} from "./widgetDataTypes";

export type {
  WidgetChartPayload,
  WidgetDataPayload,
  WidgetMetricPayload,
  WidgetTableOrListPayload,
  WidgetTableRow,
} from "./widgetDataTypes";

/** How many trailing reporting periods a timeRange covers (periods are ~monthly). */
const PERIOD_COUNT_BY_RANGE: Record<TimeRange, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "1y": 12,
};

type PeriodRow = {
  id: string;
  label?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
};

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
}

function qualityLabel(value: unknown): string {
  if (value === "measured") return "Measured";
  if (value === "calculated") return "Calculated";
  if (value === "estimated") return "Estimated";
  return "Missing";
}

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatTime(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function supplierIdOfDoc(supplier: unknown, supplierKey: unknown): string | null {
  if (typeof supplierKey === "string" && supplierKey && supplierKey !== NO_SUPPLIER_KEY) {
    return supplierKey;
  }
  if (!supplier) return null;
  if (typeof supplier === "string") return supplier;
  if (typeof supplier === "object" && supplier !== null && "id" in supplier) {
    return String((supplier as { id: unknown }).id);
  }
  return null;
}

/** Oldest → newest reporting periods covering the requested timeRange. */
async function loadRecentPeriods(
  payload: Payload,
  organisationId: string,
  timeRange: TimeRange,
): Promise<PeriodRow[]> {
  const limit = PERIOD_COUNT_BY_RANGE[timeRange] ?? 3;
  const result = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: organisationId } },
    sort: "-startDate",
    limit,
    depth: 0,
    overrideAccess: true,
  });
  return [...(result.docs as PeriodRow[])].reverse();
}

/** Current-period Scope 1/2/3 total (from the org's open reporting period). */
async function scopeTotalMetric(
  payload: Payload,
  organisationId: string,
  scope: "scope1" | "scope2" | "scope3",
): Promise<WidgetMetricPayload> {
  const kpi = await computeOrgKpiSnapshot(payload, organisationId);
  if (!kpi.periodId || !kpi.emissions.calcOk) {
    return {
      kind: "metric",
      value: null,
      unit: "tCO2e",
      label: kpi.periodId ? undefined : "No open reporting period",
    };
  }
  return { kind: "metric", value: round2(kpi.emissions[scope]), unit: "tCO2e" };
}

async function scope2IntensityMetric(
  payload: Payload,
  organisationId: string,
): Promise<WidgetMetricPayload> {
  const kpi = await computeOrgKpiSnapshot(payload, organisationId);
  if (!kpi.periodId || !kpi.emissions.calcOk) {
    return {
      kind: "metric",
      value: null,
      unit: "tCO2e/employee",
      label: kpi.periodId ? undefined : "No open reporting period",
    };
  }

  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });
  const intensity = calculateEmissionsPerEmployee(
    kpi.emissions.scope2,
    org.employeeCount,
  );
  const marketNote =
    kpi.emissions.scope2MarketQuality === "missing" ||
    kpi.emissions.scope2MarketBased === null
      ? " · S2 mkt incomplete"
      : ` · S2 mkt ${round2(kpi.emissions.scope2MarketBased)} tCO2e`;
  return {
    kind: "metric",
    value: intensity.value !== null ? round2(intensity.value) : null,
    unit: intensity.unit,
    label:
      intensity.value === null
        ? (intensity.explanation ?? undefined)
        : `Location-based${marketNote}`,
  };
}

async function emissionsByScopeChart(
  payload: Payload,
  organisationId: string,
): Promise<WidgetChartPayload> {
  const kpi = await computeOrgKpiSnapshot(payload, organisationId);
  if (!kpi.periodId || !kpi.emissions.calcOk) return { kind: "chart", points: [] };
  return {
    kind: "chart",
    points: [
      { label: "Scope 1", value: round2(kpi.emissions.scope1) },
      { label: "Scope 2", value: round2(kpi.emissions.scope2) },
      { label: "Scope 3", value: round2(kpi.emissions.scope3) },
    ],
  };
}

/** Real Scope 1+2+3 total per trailing reporting period, via the same calc path as the live KPI snapshot. */
async function emissionsTrendChart(
  payload: Payload,
  organisationId: string,
  timeRange: TimeRange,
): Promise<WidgetChartPayload> {
  const periods = await loadRecentPeriods(payload, organisationId, timeRange);
  const points: Array<{ label: string; value: number }> = [];

  for (const period of periods) {
    const snapshot = await computeOrgKpiSnapshotForPeriod(payload, organisationId, {
      id: period.id,
      endDate: period.endDate,
    });
    if (!snapshot.emissions.calcOk) continue;
    const label =
      (typeof period.label === "string" && period.label.trim()) ||
      formatDate(period.startDate) ||
      period.id;
    points.push({ label, value: round2(snapshot.emissions.total) });
  }

  return { kind: "chart", points };
}

/** Top Scope 3 contributors by rolled-up tCO2e (supplier-primary + spend-estimate, supersession-safe). */
async function topSuppliersTable(
  payload: Payload,
  organisationId: string,
  timeRange: TimeRange,
): Promise<WidgetTableOrListPayload> {
  const periods = await loadRecentPeriods(payload, organisationId, timeRange);
  const periodIds = periods.map((p) => p.id);
  if (periodIds.length === 0) return { kind: "table", rows: [] };

  const dps = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { period: { in: periodIds } },
        {
          metricKey: {
            in: [SUPPLIER_REPORTED_METRIC, SUPPLIER_SPEND_ESTIMATE_METRIC],
          },
        },
      ],
    },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  });

  const bySupplier = new Map<string, number>();
  for (const d of dps.docs) {
    if (d.quality === "missing" || typeof d.value !== "number") continue;
    const sid = supplierIdOfDoc(d.supplier, d.supplierKey);
    if (!sid) continue;
    bySupplier.set(sid, (bySupplier.get(sid) ?? 0) + d.value);
  }

  const ranked = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (ranked.length === 0) return { kind: "table", rows: [] };

  const suppliers = await payload.find({
    collection: "suppliers",
    where: { id: { in: ranked.map(([id]) => id) } },
    limit: ranked.length,
    depth: 0,
    overrideAccess: true,
  });
  const nameById = new Map(
    suppliers.docs.map((s) => [
      String(s.id),
      typeof s.name === "string" ? s.name : "Supplier",
    ]),
  );

  return {
    kind: "table",
    rows: ranked.map(([id, value]) => ({
      title: nameById.get(id) ?? "Supplier",
      subtitle: "Scope 3 contribution",
      value: `${formatNumber(round2(value))} tCO2e`,
    })),
  };
}

async function recentDatapointsTable(
  payload: Payload,
  organisationId: string,
): Promise<WidgetTableOrListPayload> {
  const dps = await payload.find({
    collection: "datapoints",
    where: { organisation: { equals: organisationId } },
    sort: "-enteredAt",
    limit: 6,
    depth: 0,
    overrideAccess: true,
  });

  return {
    kind: "table",
    rows: dps.docs.map((d) => {
      const key = typeof d.metricKey === "string" ? d.metricKey : "";
      const def = DATA_METRIC_BY_KEY[key];
      const label = def?.label ?? key ?? "Datapoint";
      const unit = (typeof d.unit === "string" && d.unit) || def?.unit || "";
      const value =
        typeof d.value === "number"
          ? `${formatNumber(d.value)}${unit ? ` ${unit}` : ""}`
          : "—";
      const entered = formatDate(d.enteredAt);
      return {
        title: label,
        subtitle: entered
          ? `${qualityLabel(d.quality)} · ${entered}`
          : qualityLabel(d.quality),
        value,
      };
    }),
  };
}

async function pendingApprovalsList(
  payload: Payload,
  organisationId: string,
): Promise<WidgetTableOrListPayload> {
  const dps = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { approvalState: { equals: "pending" } },
        { quality: { not_equals: "missing" } },
      ],
    },
    sort: "-enteredAt",
    limit: 6,
    depth: 0,
    overrideAccess: true,
  });

  return {
    kind: "list",
    rows: dps.docs.map((d) => {
      const key = typeof d.metricKey === "string" ? d.metricKey : "";
      const def = DATA_METRIC_BY_KEY[key];
      const entered = formatDate(d.enteredAt);
      return {
        title: def?.label ?? key ?? "Datapoint",
        subtitle: entered ? `Entered ${entered}` : "Awaiting review",
        value: qualityLabel(d.quality),
      };
    }),
  };
}

async function alertsTodayList(
  payload: Payload,
  organisationId: string,
): Promise<WidgetTableOrListPayload> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const rules = await payload.find({
    collection: "alert-rules",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { lastTriggeredAt: { greater_than_equal: start.toISOString() } },
      ],
    },
    sort: "-lastTriggeredAt",
    limit: 8,
    depth: 0,
    overrideAccess: true,
  });

  return {
    kind: "list",
    rows: rules.docs.map((r) => ({
      title: typeof r.name === "string" ? r.name : "Alert",
      subtitle:
        typeof r.lastTriggeredMessage === "string" ? r.lastTriggeredMessage : undefined,
      value: formatTime(r.lastTriggeredAt) ?? undefined,
    })),
  };
}

/** Generic fallback: treat an unknown metric as a raw datapoint metricKey series. */
async function rawMetricFallback(
  payload: Payload,
  organisationId: string,
  metric: string,
  timeRange: TimeRange,
): Promise<WidgetDataPayload> {
  const series = await loadMetricSeries(payload, organisationId, [metric]);
  const values = series[0]?.values ?? [];
  const take = PERIOD_COUNT_BY_RANGE[timeRange] ?? 3;
  const slice = values.slice(-take);

  if (slice.length > 1) {
    return {
      kind: "chart",
      points: slice.map((v, i) => ({ label: `P${i + 1}`, value: v })),
    };
  }

  const def = DATA_METRIC_BY_KEY[metric];
  const last = values.length > 0 ? values[values.length - 1]! : null;
  return {
    kind: "metric",
    value: last,
    unit: def?.unit ?? undefined,
    label: def?.label ?? metric,
  };
}

/**
 * Resolve live data for a dashboard widget metric + timeRange.
 * The 10 METRIC_OPTIONS map to computeOrgKpiSnapshot / direct datapoint
 * queries; anything else falls back to a raw metricKey series lookup.
 */
export async function resolveWidgetData(
  payload: Payload,
  organisationId: string,
  metric: string,
  timeRange: TimeRange,
): Promise<WidgetDataPayload> {
  switch (metric) {
    case "scope1_total":
      return scopeTotalMetric(payload, organisationId, "scope1");
    case "scope2_total":
      return scopeTotalMetric(payload, organisationId, "scope2");
    case "scope3_total":
      return scopeTotalMetric(payload, organisationId, "scope3");
    case "scope2_intensity":
      return scope2IntensityMetric(payload, organisationId);
    case "emissions_trend":
      return emissionsTrendChart(payload, organisationId, timeRange);
    case "emissions_by_scope":
      return emissionsByScopeChart(payload, organisationId);
    case "top_suppliers":
      return topSuppliersTable(payload, organisationId, timeRange);
    case "recent_datapoints":
      return recentDatapointsTable(payload, organisationId);
    case "pending_approvals":
      return pendingApprovalsList(payload, organisationId);
    case "alerts_today":
      return alertsTodayList(payload, organisationId);
    default:
      return rawMetricFallback(payload, organisationId, metric, timeRange);
  }
}
