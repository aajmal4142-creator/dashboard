/**
 * I/O helpers for analytics compare — loads periods / datapoints then calls pure aggregators.
 */

import type { Payload, Where } from "payload";

import { resolveOrgBaselineByScope } from "./resolveOrgBaseline";
import {
  accumulateByKey,
  compareGrouped,
  compareMultiPeriod,
  compareTwoTotals,
  dimensionFromNote,
  sumMap,
  type ComparisonResult,
  type PeriodSlice,
} from "./compare";

export type ReportingPeriodDoc = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type DatapointRow = {
  id: string;
  metricKey: string;
  value: number | null | undefined;
  note: string | null | undefined;
  supplierKey: string | null | undefined;
  supplier: string | { id: string; name?: string | null } | null | undefined;
};

function yearOfPeriod(p: ReportingPeriodDoc): number {
  return new Date(String(p.endDate)).getFullYear();
}

export function findPeriodByYear(
  periods: ReportingPeriodDoc[],
  year: number,
): ReportingPeriodDoc | null {
  return (
    periods.find((p) => yearOfPeriod(p) === year) ??
    periods.find((p) => new Date(String(p.startDate)).getFullYear() === year) ??
    null
  );
}

export function findPeriodById(
  periods: ReportingPeriodDoc[],
  id: string,
): ReportingPeriodDoc | null {
  return periods.find((p) => p.id === id) ?? null;
}

function supplierLabel(dp: DatapointRow, names: Record<string, string>): string {
  if (typeof dp.supplier === "object" && dp.supplier !== null) {
    return dp.supplier.name?.trim() || dp.supplier.id;
  }
  if (typeof dp.supplier === "string" && dp.supplier.length > 0) {
    return names[dp.supplier] ?? dp.supplier;
  }
  if (dp.supplierKey && dp.supplierKey.length > 0) {
    return names[dp.supplierKey] ?? dp.supplierKey;
  }
  return "No supplier";
}

function supplierKeyOf(dp: DatapointRow): string {
  if (typeof dp.supplier === "object" && dp.supplier !== null) {
    return dp.supplier.id;
  }
  if (typeof dp.supplier === "string" && dp.supplier.length > 0) {
    return dp.supplier;
  }
  if (dp.supplierKey && dp.supplierKey.length > 0) return dp.supplierKey;
  return "_none";
}

export async function loadOrgPeriods(
  payload: Payload,
  organisationId: string,
): Promise<ReportingPeriodDoc[]> {
  const result = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: organisationId } },
    limit: 100,
    sort: "-endDate",
    overrideAccess: true,
  });
  return result.docs.map((p) => ({
    id: String(p.id),
    label: String(p.label),
    startDate: String(p.startDate),
    endDate: String(p.endDate),
  }));
}

export async function loadPeriodDatapoints(
  payload: Payload,
  organisationId: string,
  periodId: string,
  metricKey?: string | null,
): Promise<DatapointRow[]> {
  const and: Where[] = [
    { organisation: { equals: organisationId } },
    { period: { equals: periodId } },
  ];
  if (metricKey) {
    and.push({ metricKey: { equals: metricKey } });
  }

  const result = await payload.find({
    collection: "datapoints",
    where: { and },
    limit: 10000,
    depth: 1,
    overrideAccess: true,
  });

  return result.docs.map((d) => {
    let supplier: DatapointRow["supplier"] = null;
    if (typeof d.supplier === "object" && d.supplier !== null && "id" in d.supplier) {
      supplier = {
        id: String(d.supplier.id),
        name: "name" in d.supplier ? String(d.supplier.name ?? "") : null,
      };
    } else if (typeof d.supplier === "string") {
      supplier = d.supplier;
    }

    return {
      id: String(d.id),
      metricKey: String(d.metricKey),
      value: d.value,
      note: d.note ?? null,
      supplierKey: d.supplierKey ?? null,
      supplier,
    };
  });
}

async function emissionsSlice(
  payload: Payload,
  organisationId: string,
  period: ReportingPeriodDoc,
): Promise<PeriodSlice> {
  const year = yearOfPeriod(period);
  const resolved = await resolveOrgBaselineByScope(payload, organisationId, year);
  const total =
    resolved.baseline.scope1 + resolved.baseline.scope2 + resolved.baseline.scope3;
  return {
    id: period.id,
    label: period.label,
    total,
    quality: resolved.quality === "calculated" && total > 0 ? "calculated" : "missing",
    scope1: resolved.baseline.scope1,
    scope2: resolved.baseline.scope2,
    scope3: resolved.baseline.scope3,
  };
}

function activitySlice(
  period: ReportingPeriodDoc,
  map: Record<string, number>,
): PeriodSlice {
  const total = sumMap(map);
  return {
    id: period.id,
    label: period.label,
    total,
    quality: total > 0 ? "partial" : "missing",
  };
}

export async function runYoYCompare(
  payload: Payload,
  organisationId: string,
  baselinePeriod: ReportingPeriodDoc,
  currentPeriod: ReportingPeriodDoc,
): Promise<ComparisonResult> {
  const [baseline, current] = await Promise.all([
    emissionsSlice(payload, organisationId, baselinePeriod),
    emissionsSlice(payload, organisationId, currentPeriod),
  ]);
  return compareTwoTotals(baseline, current);
}

export async function runGroupedCompare(
  payload: Payload,
  organisationId: string,
  kind: "by_department" | "by_supplier" | "by_metric",
  baselinePeriod: ReportingPeriodDoc,
  currentPeriod: ReportingPeriodDoc,
  metricKey?: string | null,
): Promise<ComparisonResult> {
  const [baselineDocs, currentDocs, suppliers] = await Promise.all([
    loadPeriodDatapoints(payload, organisationId, baselinePeriod.id, metricKey),
    loadPeriodDatapoints(payload, organisationId, currentPeriod.id, metricKey),
    payload.find({
      collection: "suppliers",
      where: { organisation: { equals: organisationId } },
      limit: 500,
      overrideAccess: true,
    }),
  ]);

  const names: Record<string, string> = {};
  for (const s of suppliers.docs) {
    names[String(s.id)] = String(s.name ?? s.id);
  }

  const mapDocs = (docs: DatapointRow[]): Record<string, number> => {
    if (kind === "by_department") {
      return accumulateByKey(
        docs.map((d) => ({
          key: dimensionFromNote(d.note, "department"),
          value: d.value,
        })),
      );
    }
    if (kind === "by_supplier") {
      return accumulateByKey(
        docs.map((d) => ({
          key: supplierKeyOf(d),
          value: d.value,
        })),
      );
    }
    return accumulateByKey(
      docs.map((d) => ({
        key: d.metricKey,
        value: d.value,
      })),
    );
  };

  const baselineMap = mapDocs(baselineDocs);
  const currentMap = mapDocs(currentDocs);

  const labels: Record<string, string> = {};
  if (kind === "by_supplier") {
    for (const d of [...baselineDocs, ...currentDocs]) {
      const k = supplierKeyOf(d);
      labels[k] = supplierLabel(d, names);
    }
  }

  const baseline = activitySlice(baselinePeriod, baselineMap);
  const current = activitySlice(currentPeriod, currentMap);

  return compareGrouped(kind, baseline, current, baselineMap, currentMap, labels);
}

export async function runMultiPeriodCompare(
  payload: Payload,
  organisationId: string,
  periods: ReportingPeriodDoc[],
): Promise<ComparisonResult> {
  const slices: PeriodSlice[] = [];
  for (const p of periods) {
    slices.push(await emissionsSlice(payload, organisationId, p));
  }
  return compareMultiPeriod(slices);
}
