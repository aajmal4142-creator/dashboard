import type { Payload, Where } from "payload";

import { resolveOrgBaselineByScope } from "@/lib/analytics/resolveOrgBaseline";
import { buildComparison } from "@/lib/benchmarks";

function relId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export function parseBiPagination(url: URL): { limit: number; page: number } {
  const rawLimit = Number(url.searchParams.get("limit") ?? "100");
  const rawPage = Number(url.searchParams.get("page") ?? "1");
  const limit = Number.isFinite(rawLimit)
    ? Math.min(500, Math.max(1, Math.floor(rawLimit)))
    : 100;
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  return { limit, page };
}

/** Period-scoped emissions totals for BI tools (read-only). */
export async function listBiEmissions(
  payload: Payload,
  organisationId: string,
): Promise<{
  organisationId: string;
  unit: "tCO2e";
  periods: Array<{
    periodId: string;
    label: string | null;
    year: number;
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
    quality: "calculated" | "missing";
    message?: string;
  }>;
}> {
  const periods = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: organisationId } },
    sort: "-startDate",
    limit: 50,
    overrideAccess: true,
  });

  const rows = [];
  for (const period of periods.docs) {
    const year = new Date(String(period.startDate)).getFullYear();
    const resolved = await resolveOrgBaselineByScope(payload, organisationId, year);
    const { scope1, scope2, scope3 } = resolved.baseline;
    rows.push({
      periodId: period.id,
      label: typeof period.label === "string" ? period.label : null,
      year,
      scope1,
      scope2,
      scope3,
      total: scope1 + scope2 + scope3,
      quality: resolved.quality,
      ...(resolved.message ? { message: resolved.message } : {}),
    });
  }

  return { organisationId, unit: "tCO2e", periods: rows };
}

export async function listBiDatapoints(
  payload: Payload,
  organisationId: string,
  opts: { limit: number; page: number; periodId?: string | null },
) {
  const and: Where[] = [{ organisation: { equals: organisationId } }];
  if (opts.periodId) {
    and.push({ period: { equals: opts.periodId } });
  }

  const result = await payload.find({
    collection: "datapoints",
    where: { and },
    sort: "-updatedAt",
    limit: opts.limit,
    page: opts.page,
    overrideAccess: true,
  });

  return {
    organisationId,
    page: result.page ?? opts.page,
    totalPages: result.totalPages,
    totalDocs: result.totalDocs,
    datapoints: result.docs.map((d) => ({
      id: d.id,
      metricKey: d.metricKey,
      value: d.value ?? null,
      unit: d.unit ?? null,
      quality: d.quality ?? null,
      approvalState: d.approvalState ?? null,
      source: d.source ?? null,
      periodId: relId(d.period),
      supplierKey: d.supplierKey ?? null,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
    })),
  };
}

export async function listBiSuppliers(
  payload: Payload,
  organisationId: string,
  opts: { limit: number; page: number },
) {
  const result = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: organisationId } },
    sort: "-updatedAt",
    limit: opts.limit,
    page: opts.page,
    overrideAccess: true,
  });

  return {
    organisationId,
    page: result.page ?? opts.page,
    totalPages: result.totalPages,
    totalDocs: result.totalDocs,
    suppliers: result.docs.map((s) => {
      const risk = s.riskMetrics;
      return {
        id: s.id,
        name: s.name,
        category: s.category ?? null,
        country: s.country ?? null,
        annualSpend: s.annualSpend ?? null,
        requestStatus: s.requestStatus ?? null,
        riskScore: typeof risk?.score === "number" ? risk.score : null,
        riskTier: risk?.tier ?? null,
        environmentalScore:
          typeof risk?.environmentalScore === "number" ? risk.environmentalScore : null,
        socialScore: typeof risk?.socialScore === "number" ? risk.socialScore : null,
        governanceScore:
          typeof risk?.governanceScore === "number" ? risk.governanceScore : null,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
      };
    }),
  };
}

export async function listBiScenarios(
  payload: Payload,
  organisationId: string,
  opts: { limit: number; page: number },
) {
  const result = await payload.find({
    collection: "scenarios",
    where: { organisation: { equals: organisationId } },
    sort: "-createdAt",
    limit: opts.limit,
    page: opts.page,
    overrideAccess: true,
  });

  return {
    organisationId,
    page: result.page ?? opts.page,
    totalPages: result.totalPages,
    totalDocs: result.totalDocs,
    scenarios: result.docs.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type ?? null,
      status: s.status ?? null,
      baselineYear: s.baselineYear ?? null,
      targetYear: s.targetYear ?? null,
      reductionPercent: s.reductionPercent ?? null,
      scopes: s.scopes ?? [],
      category: s.category ?? null,
      timelineYears: s.timelineYears ?? null,
      capex: s.capex ?? null,
      costPerTco2e: s.costPerTco2e ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  };
}

export async function getBiBenchmarks(
  payload: Payload,
  organisationId: string,
  metricKey: string,
) {
  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });

  const result = await buildComparison(
    payload,
    {
      id: organisationId,
      sector: org.sector,
      revenueBand: org.revenueBand,
      country: org.country,
      benchmarkOptOut: org.benchmarkOptOut,
    },
    metricKey,
  );

  return {
    organisationId,
    metricKey,
    ...result,
  };
}
