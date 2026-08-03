/**
 * I/O helpers for emissions hotspots — loads org periods / datapoints then calls pure rankers.
 */

import type { Payload, Where } from "payload";

import { findPeriodById, loadOrgPeriods, type ReportingPeriodDoc } from "./compareLoad";
import {
  rankHotspots,
  type HotspotActivityRow,
  type HotspotDimension,
  type HotspotResult,
  type HotspotSortMode,
} from "./hotspots";

export { findPeriodById, loadOrgPeriods };
export type { ReportingPeriodDoc };

type LoadedDatapoint = {
  metricKey: string;
  value: number | null | undefined;
  quality: HotspotActivityRow["quality"];
  note: string | null;
  facilityId: string | null;
  facilityLabel: string | null;
  supplierId: string | null;
  supplierLabel: string | null;
};

async function loadMetricCalcRoles(
  payload: Payload,
  metricKeys: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(metricKeys.filter((k) => k.length > 0))];
  if (unique.length === 0) return {};

  const result = await payload.find({
    collection: "metric-definitions",
    where: { key: { in: unique } },
    limit: Math.max(unique.length, 1),
    overrideAccess: true,
  });

  const out: Record<string, string> = {};
  for (const doc of result.docs) {
    out[String(doc.key)] = String(doc.calcRole ?? "");
  }
  return out;
}

export async function loadPeriodHotspotRows(
  payload: Payload,
  organisationId: string,
  periodId: string,
): Promise<HotspotActivityRow[]> {
  const and: Where[] = [
    { organisation: { equals: organisationId } },
    { period: { equals: periodId } },
  ];

  const result = await payload.find({
    collection: "datapoints",
    where: { and },
    limit: 10000,
    depth: 1,
    overrideAccess: true,
  });

  const loaded: LoadedDatapoint[] = result.docs.map((d) => {
    let facilityId: string | null = null;
    let facilityLabel: string | null = null;
    if (typeof d.facility === "object" && d.facility !== null && "id" in d.facility) {
      facilityId = String(d.facility.id);
      facilityLabel =
        "name" in d.facility && d.facility.name != null
          ? String(d.facility.name)
          : facilityId;
    } else if (typeof d.facility === "string" && d.facility.length > 0) {
      facilityId = d.facility;
    }

    let supplierId: string | null = null;
    let supplierLabel: string | null = null;
    if (typeof d.supplier === "object" && d.supplier !== null && "id" in d.supplier) {
      supplierId = String(d.supplier.id);
      supplierLabel =
        "name" in d.supplier && d.supplier.name != null
          ? String(d.supplier.name)
          : supplierId;
    } else if (typeof d.supplier === "string" && d.supplier.length > 0) {
      supplierId = d.supplier;
    } else if (d.supplierKey && String(d.supplierKey).length > 0) {
      supplierId = String(d.supplierKey);
    }

    return {
      metricKey: String(d.metricKey),
      value: d.value,
      quality: d.quality ?? null,
      note: d.note ?? null,
      facilityId,
      facilityLabel,
      supplierId,
      supplierLabel,
    };
  });

  const calcRoles = await loadMetricCalcRoles(
    payload,
    loaded.map((r) => r.metricKey),
  );

  return loaded.map((r) => ({
    metricKey: r.metricKey,
    value: r.value,
    quality: r.quality,
    note: r.note,
    facilityId: r.facilityId,
    facilityLabel: r.facilityLabel,
    supplierId: r.supplierId,
    supplierLabel: r.supplierLabel,
    calcRole: calcRoles[r.metricKey] || null,
  }));
}

export async function runHotspotsAnalysis(
  payload: Payload,
  organisationId: string,
  options: {
    dimension: HotspotDimension;
    period: ReportingPeriodDoc;
    baselinePeriod?: ReportingPeriodDoc | null;
    sortBy?: HotspotSortMode;
    limit?: number;
  },
): Promise<HotspotResult> {
  const currentRows = await loadPeriodHotspotRows(
    payload,
    organisationId,
    options.period.id,
  );

  let baselineRows: HotspotActivityRow[] | null = null;
  if (options.baselinePeriod) {
    baselineRows = await loadPeriodHotspotRows(
      payload,
      organisationId,
      options.baselinePeriod.id,
    );
  }

  return rankHotspots({
    dimension: options.dimension,
    period: { id: options.period.id, label: options.period.label },
    currentRows,
    baselinePeriod: options.baselinePeriod
      ? { id: options.baselinePeriod.id, label: options.baselinePeriod.label }
      : null,
    baselineRows,
    sortBy: options.sortBy,
    limit: options.limit,
  });
}
