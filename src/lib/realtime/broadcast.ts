/**
 * Compute public runway KPIs for an organisation's open period.
 * Used by SSE broadcast and the REST polling fallback.
 */

import type { Payload } from "payload";

import { calculate } from "@/lib/calc";
import { loadActiveScope2Instruments } from "@/lib/certificates";
import { loadOrgEmissionFactors } from "@/lib/factors";
import { rankGaps } from "@/lib/governance/gaps";
import { metricsAndCompositionFromDatapoints } from "@/lib/suppliers";

import type { DashboardUpdate, PublicKpiPayload } from "./types";

export type OrgKpiSnapshot = {
  organisationId: string;
  periodId: string | null;
  emissions: {
    total: number;
    scope1: number;
    scope2: number;
    scope2LocationBased: number;
    scope2MarketBased: number | null;
    scope2MarketQuality: "measured" | "calculated" | "estimated" | "missing" | null;
    scope3: number;
    calcOk: boolean;
  };
  datapoints: {
    count: number;
    collected: number;
    required: number;
  };
  pendingApproval: number;
  reports: {
    count: number;
  };
  timestamp: string;
};

/** Minimal period shape `computeOrgKpiSnapshotForPeriod` needs. */
export type KpiSnapshotPeriod = {
  id: string;
  endDate?: string | Date | null;
};

/**
 * Same computation as `computeOrgKpiSnapshot`, but for an arbitrary (already
 * resolved) period rather than always looking up the org's open period.
 * Lets callers (e.g. dashboard widgets) build multi-period series.
 */
export async function computeOrgKpiSnapshotForPeriod(
  payload: Payload,
  organisationId: string,
  period: KpiSnapshotPeriod | null,
): Promise<OrgKpiSnapshot> {
  const timestamp = new Date().toISOString();

  const dps = period
    ? await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: organisationId } },
            { period: { equals: period.id } },
          ],
        },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] };

  const present = new Set(
    dps.docs
      .filter((d) => d.quality !== "missing" && d.value != null)
      .map((d) => d.metricKey),
  );
  const gaps = rankGaps(present);

  const pendingApproval = dps.docs.filter(
    (d) => (d.approvalState ?? "pending") === "pending" && d.quality !== "missing",
  ).length;

  const reports = await payload.find({
    collection: "reports",
    where: { organisation: { equals: organisationId } },
    limit: 1,
    overrideAccess: true,
  });

  let scope1 = 0;
  let scope2 = 0;
  let scope2MarketBased: number | null = null;
  let scope2MarketQuality: "measured" | "calculated" | "estimated" | "missing" | null =
    null;
  let scope3 = 0;
  let calcOk = false;

  if (period && dps.docs.length > 0) {
    try {
      const suppliers = await payload.find({
        collection: "suppliers",
        where: { organisation: { equals: organisationId } },
        limit: 200,
        overrideAccess: true,
      });
      const { metrics } = metricsAndCompositionFromDatapoints(
        dps.docs.map((d) => ({
          id: String(d.id),
          metricKey: d.metricKey,
          value: d.value,
          quality: d.quality,
          unit: d.unit,
          provenance: d.provenance,
          supplierKey: d.supplierKey,
          supplier: d.supplier,
        })),
        suppliers.docs.map((s) => String(s.id)),
      );

      const org = await payload.findByID({
        collection: "organisations",
        id: organisationId,
        depth: 0,
        overrideAccess: true,
      });
      const { factors } = await loadOrgEmissionFactors(payload, org);
      const year = new Date(String(period.endDate)).getFullYear();
      const region = org.country || "GB";
      const scope2Instruments = await loadActiveScope2Instruments(
        payload,
        organisationId,
        String(period.id),
      );
      const calc = calculate(
        { metrics, context: { region, year, scope2Instruments } },
        factors,
      );
      scope1 = calc.emissions.scope1.value;
      scope2 = calc.emissions.scope2.value;
      scope2MarketBased = calc.emissions.scope2Methods.marketBased.value;
      scope2MarketQuality = calc.emissions.scope2Methods.marketBased.quality;
      scope3 = calc.emissions.scope3.value;
      calcOk = true;
    } catch {
      calcOk = false;
    }
  }

  return {
    organisationId,
    periodId: period ? String(period.id) : null,
    emissions: {
      total: scope1 + scope2 + scope3,
      scope1,
      scope2,
      scope2LocationBased: scope2,
      scope2MarketBased,
      scope2MarketQuality,
      scope3,
      calcOk,
    },
    datapoints: {
      count: dps.docs.length,
      collected: gaps.collected,
      required: gaps.total,
    },
    pendingApproval,
    reports: {
      count: reports.totalDocs,
    },
    timestamp,
  };
}

/**
 * Compute public runway KPIs for an organisation's open period.
 * Used by SSE broadcast and the REST polling fallback.
 */
export async function computeOrgKpiSnapshot(
  payload: Payload,
  organisationId: string,
): Promise<OrgKpiSnapshot> {
  const periods = await payload.find({
    collection: "reporting-periods",
    where: {
      and: [{ organisation: { equals: organisationId } }, { status: { equals: "open" } }],
    },
    limit: 1,
    overrideAccess: true,
  });
  const period = periods.docs[0] ?? null;

  return computeOrgKpiSnapshotForPeriod(
    payload,
    organisationId,
    period ? { id: String(period.id), endDate: period.endDate } : null,
  );
}

export function snapshotToUpdates(
  snapshot: OrgKpiSnapshot,
  activity?: DashboardUpdate["activity"],
): Array<Omit<DashboardUpdate, "changePercent">> {
  const base = { timestamp: snapshot.timestamp };
  const updates: Array<Omit<DashboardUpdate, "changePercent">> = [
    {
      ...base,
      metric: "emissions",
      value: snapshot.emissions.total,
      unit: "tCO₂e",
      scopes: {
        scope1: snapshot.emissions.scope1,
        scope2: snapshot.emissions.scope2,
        scope2MarketBased: snapshot.emissions.scope2MarketBased,
        scope3: snapshot.emissions.scope3,
      },
      activity,
    },
    {
      ...base,
      metric: "datapoints",
      value: snapshot.datapoints.count,
      unit: "count",
      activity,
    },
    {
      ...base,
      metric: "pending_approval",
      value: snapshot.pendingApproval,
      unit: "count",
    },
    {
      ...base,
      metric: "reports",
      value: snapshot.reports.count,
      unit: "count",
      activity: activity?.kind === "report" ? activity : undefined,
    },
  ];
  return updates;
}

export function toPublicKpiPayload(snapshot: OrgKpiSnapshot): PublicKpiPayload {
  return {
    organisationId: snapshot.organisationId,
    periodId: snapshot.periodId,
    emissions: snapshot.emissions,
    datapoints: snapshot.datapoints,
    pendingApproval: snapshot.pendingApproval,
    reports: snapshot.reports,
    timestamp: snapshot.timestamp,
    metrics: ["emissions", "datapoints", "reports", "pending_approval"],
  };
}
