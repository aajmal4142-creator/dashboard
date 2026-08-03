import { getPayload } from "payload";

import { calculateEmissionsForecast } from "@/lib/analytics/forecast";
import { loadEmissionsByPeriod } from "@/lib/analytics/loadEmissionsByPeriod";
import { calculate, type CalcResult, type Quality } from "@/lib/calc";
import { loadActiveScope2Instruments } from "@/lib/certificates";
import {
  EMISSIONS_STANDARD_LABELS,
  loadOrgEmissionFactors,
  resolveOrgEmissionsStandard,
  type EmissionsStandard,
} from "@/lib/factors";
import type { MatrixPoint } from "@/lib/materiality";
import { metricsAndCompositionFromDatapoints } from "@/lib/suppliers";
import config from "@/payload.config";

import { detectReportDataGaps } from "./dataGaps";
import { buildComplianceDeclaration, buildEsrsDisclosures } from "./esrsNarrative";
import { buildReportForecastSection } from "./forecastSection";
import { evaluateOrgCustomMetricsForSnapshot } from "./customMetricsSnapshot";
import { REPORT_DISCLAIMER, type ReportSnapshot, type ScopeBreakdownRow } from "./types";

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function mediaUrl(value: unknown): string | null {
  if (!value || typeof value === "string") return null;
  if (typeof value === "object" && value !== null && "url" in value) {
    const url = (value as { url?: string | null }).url;
    return url ? String(url) : null;
  }
  return null;
}

function userDisplay(user: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): { id: string; name: string } {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return { id: user.id, name: name || user.email || user.id };
}

function scopeRow(
  value: number,
  quality: Quality,
  factorKeys: string[],
  label: string,
  standardLabel: string,
): ScopeBreakdownRow {
  const sources =
    factorKeys.length > 0
      ? factorKeys
      : quality === "missing"
        ? ["No activity data"]
        : ["Management-reported activity"];

  const methodology =
    quality === "missing"
      ? `${label}: no calculable activity for this period.`
      : `${label}: activity × pinned emission factor (${standardLabel}). Quality marked ${quality}.`;

  const uncertainties =
    quality === "missing"
      ? "Figure unavailable — treat as a data gap."
      : quality === "estimated"
        ? "Estimate uncertainty is higher; prefer measured invoices or meters."
        : quality === "calculated"
          ? "Calculated from activity and registry factors; residual factor-year uncertainty remains."
          : "Measured activity reduces uncertainty; factor source year still applies.";

  return { value, quality, sources, methodology, uncertainties };
}

export async function buildReportSnapshot(opts: {
  organisationId: string;
  periodId: string;
  framework: string;
  version: number;
  preparedById?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  preparerNotes?: string | null;
  /** Override org default — recalculate historical under a different standard. */
  emissionsStandard?: EmissionsStandard | null;
}): Promise<ReportSnapshot> {
  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: opts.organisationId,
    depth: 1,
    overrideAccess: true,
  });
  const period = await payload.findByID({
    collection: "reporting-periods",
    id: opts.periodId,
    depth: 0,
    overrideAccess: true,
  });

  const dps = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: opts.organisationId } },
        { period: { equals: opts.periodId } },
      ],
    },
    limit: 500,
    overrideAccess: true,
  });

  const suppliers = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: opts.organisationId } },
    limit: 500,
    overrideAccess: true,
  });

  const { metrics, composition } = metricsAndCompositionFromDatapoints(
    dps.docs.map((d) => ({
      id: d.id,
      metricKey: d.metricKey,
      value: d.value,
      quality: d.quality,
      unit: d.unit,
      provenance: d.provenance,
      supplierKey: d.supplierKey,
      supplier: d.supplier,
    })),
    suppliers.docs.map((s) => s.id),
  );

  const year = new Date(String(period.endDate)).getFullYear() || new Date().getFullYear();
  const region = org.country || "GB";

  const emissionsStandard = opts.emissionsStandard ?? resolveOrgEmissionsStandard(org);
  const { factors } = await loadOrgEmissionFactors(payload, {
    id: opts.organisationId,
    settings: { emissionsStandard },
  });

  let calc: CalcResult;
  try {
    const scope2Instruments = await loadActiveScope2Instruments(
      payload,
      opts.organisationId,
      opts.periodId,
    );
    calc = calculate({ metrics, context: { region, year, scope2Instruments } }, factors);
  } catch {
    calc = {
      scores: { overall: 0, e: 0, s: 0, g: 0 },
      emissions: {
        scope1: { value: 0, unit: "tCO2e", quality: "missing" },
        scope2: { value: 0, unit: "tCO2e", quality: "missing" },
        scope2Methods: {
          locationBased: { value: 0, unit: "tCO2e", quality: "missing" },
          marketBased: { value: 0, unit: "tCO2e", quality: "missing" },
        },
        scope3: { value: 0, unit: "tCO2e", quality: "missing" },
        total: { value: 0, unit: "tCO2e", quality: "missing" },
      },
      dataQualityPct: 0,
      factorsUsed: [],
      breakdown: [],
      band: "early",
    };
  }

  const mat = await payload.find({
    collection: "materiality-assessments",
    where: {
      and: [
        { organisation: { equals: opts.organisationId } },
        { period: { equals: opts.periodId } },
        { status: { equals: "final" } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  const assessment = mat.docs[0];
  const points: MatrixPoint[] = Array.isArray(
    (assessment?.matrixSnapshot as { points?: MatrixPoint[] } | null)?.points,
  )
    ? ((assessment?.matrixSnapshot as { points: MatrixPoint[] }).points ?? [])
    : [];

  const evidence = await payload.find({
    collection: "evidence",
    where: { organisation: { equals: opts.organisationId } },
    limit: 100,
    overrideAccess: true,
  });

  const evidenceIndex = evidence.docs.map((e) => ({
    filename: e.filename,
    sha256: e.sha256,
    metricKey:
      e.extractedData &&
      typeof e.extractedData === "object" &&
      e.extractedData !== null &&
      "metricKey" in e.extractedData
        ? String((e.extractedData as { metricKey?: string }).metricKey ?? "")
        : undefined,
  }));

  const dataGaps = detectReportDataGaps({
    calc,
    materialityPoints: points,
    materialityNarrative: assessment?.narrative ?? null,
    evidenceCount: evidenceIndex.length,
    framework: opts.framework,
  });

  const factorKeys = calc.factorsUsed.map((f) => `${f.key} (${f.source} ${f.year})`);
  const standardLabel = EMISSIONS_STANDARD_LABELS[emissionsStandard];
  const loc = calc.emissions.scope2Methods.locationBased;
  const mkt = calc.emissions.scope2Methods.marketBased;
  const scopeBreakdown = {
    scope1: scopeRow(
      calc.emissions.scope1.value,
      calc.emissions.scope1.quality,
      factorKeys.filter((k) =>
        /diesel|natural_gas|petrol|fuel|stationary|mobile/i.test(k),
      ),
      "Scope 1",
      standardLabel,
    ),
    scope2: scopeRow(
      loc.value,
      loc.quality,
      factorKeys.filter((k) => /grid|electric|heat|steam|residual|contractual/i.test(k)),
      "Scope 2 (location-based)",
      standardLabel,
    ),
    scope2Market: scopeRow(
      mkt.value,
      mkt.quality,
      factorKeys.filter((k) => /residual|contractual|instrument/i.test(k)),
      "Scope 2 (market-based)",
      standardLabel,
    ),
    scope3: scopeRow(
      calc.emissions.scope3.value,
      calc.emissions.scope3.quality,
      factorKeys.filter((k) => /spend|travel|scope3|waste|commute/i.test(k)),
      "Scope 3",
      standardLabel,
    ),
  };
  // If filter emptied sources, fall back to all pinned factors for transparency
  for (const key of ["scope1", "scope2", "scope2Market", "scope3"] as const) {
    if (
      scopeBreakdown[key].sources.length === 1 &&
      scopeBreakdown[key].sources[0]?.startsWith("Management")
    ) {
      scopeBreakdown[key].sources =
        factorKeys.length > 0 ? factorKeys.slice(0, 8) : scopeBreakdown[key].sources;
    }
  }

  let preparedBy: ReportSnapshot["preparedBy"] = null;
  if (opts.preparedById) {
    try {
      const u = await payload.findByID({
        collection: "users",
        id: opts.preparedById,
        depth: 0,
        overrideAccess: true,
      });
      preparedBy = userDisplay(u);
    } catch {
      preparedBy = { id: opts.preparedById, name: opts.preparedById };
    }
  }

  let approvedBy: ReportSnapshot["approvedBy"] = null;
  if (opts.approvedById) {
    try {
      const u = await payload.findByID({
        collection: "users",
        id: opts.approvedById,
        depth: 0,
        overrideAccess: true,
      });
      approvedBy = userDisplay(u);
    } catch {
      approvedBy = { id: opts.approvedById, name: opts.approvedById };
    }
  }

  const preparedAt = new Date().toISOString();
  const logoUrl =
    mediaUrl(org.settings?.branding?.logo) ?? mediaUrl(org.brand?.logo) ?? null;
  const brandingAccent =
    org.settings?.branding?.primaryColor ?? org.brand?.primaryColor ?? null;

  // YoY: prior published report for same org+framework with earlier period end
  let yoy: ReportSnapshot["yoy"] = null;
  try {
    const prior = await payload.find({
      collection: "reports",
      where: {
        and: [
          { organisation: { equals: opts.organisationId } },
          { framework: { equals: opts.framework } },
          { status: { equals: "published" } },
          { period: { not_equals: opts.periodId } },
        ],
      },
      sort: "-publishedAt",
      limit: 5,
      depth: 1,
      overrideAccess: true,
    });
    const currentEnd = new Date(String(period.endDate)).getTime();
    for (const r of prior.docs) {
      const p = r.period;
      const end =
        typeof p === "object" && p !== null && "endDate" in p
          ? new Date(String(p.endDate)).getTime()
          : NaN;
      if (!Number.isFinite(end) || end >= currentEnd) continue;
      const prevTotal =
        typeof r.emissions?.scope1 === "number" ||
        typeof r.emissions?.scope2 === "number" ||
        typeof r.emissions?.scope3 === "number"
          ? (r.emissions?.scope1 ?? 0) +
            (r.emissions?.scope2 ?? 0) +
            (r.emissions?.scope3 ?? 0)
          : null;
      if (prevTotal === null) continue;
      const currentTotal = calc.emissions.total.value;
      const changePct =
        prevTotal === 0
          ? currentTotal === 0
            ? 0
            : null
          : ((currentTotal - prevTotal) / prevTotal) * 100;
      const previousPeriodLabel =
        typeof p === "object" && p !== null && "label" in p
          ? String(p.label)
          : "Prior period";
      yoy = { previousPeriodLabel, previousTotal: prevTotal, changePct };
      break;
    }
  } catch {
    yoy = null;
  }

  const emissions = {
    scope1: calc.emissions.scope1.value,
    scope2: calc.emissions.scope2.value,
    scope2LocationBased: loc.value,
    scope2MarketBased: mkt.value,
    scope2LocationQuality: loc.quality,
    scope2MarketQuality: mkt.quality,
    scope3: calc.emissions.scope3.value,
    total: calc.emissions.total.value,
    dataQualityPct: calc.dataQualityPct,
    scope3PrimarySharePct: composition.primarySharePct,
    scope3PrimaryTco2e: composition.primaryTco2e,
    scope3EstimateTco2e: composition.estimateTco2e,
  };

  let customMetrics: NonNullable<ReportSnapshot["customMetrics"]> = [];
  try {
    customMetrics = await evaluateOrgCustomMetricsForSnapshot(payload, {
      organisationId: opts.organisationId,
      datapoints: dps.docs,
      emissions: {
        scope1: emissions.scope1,
        scope2: emissions.scope2,
        scope3: emissions.scope3,
        total: emissions.total,
      },
    });
  } catch (err) {
    console.error("[reports] custom metrics evaluation failed", err);
    customMetrics = [];
  }

  const esrsDisclosures = buildEsrsDisclosures({
    organisationName: org.name,
    scores: calc.scores,
    emissions,
    materialityNarrative: assessment?.narrative ?? null,
    materialityPoints: points,
    dataGaps,
    band: calc.band,
  });

  const complianceDeclaration = buildComplianceDeclaration({
    organisationName: org.name,
    framework: opts.framework,
    preparedByName: preparedBy?.name ?? null,
    preparedAt,
    approvedByName: approvedBy?.name ?? null,
    approvedAt: opts.approvedAt ?? null,
    version: opts.version,
    dataGapCount: dataGaps.filter((g) => g.severity === "high").length,
  });

  let forecast: ReportSnapshot["forecast"] = null;
  try {
    const { periods } = await loadEmissionsByPeriod(payload, opts.organisationId, {
      lookbackYears: 5,
      endYear: year,
    });
    if (periods.length >= 1) {
      const forecastResult = calculateEmissionsForecast({
        emissionsByPeriod: periods,
        orgGrowthRate:
          typeof org.expectedRevenueGrowth === "number"
            ? org.expectedRevenueGrowth
            : null,
        horizonYears: 3,
      });
      forecast = buildReportForecastSection(forecastResult);
    }
  } catch {
    forecast = null;
  }

  return {
    organisationName: org.name,
    periodLabel: period.label,
    framework: opts.framework,
    version: opts.version,
    publishedAt: preparedAt,
    scores: calc.scores,
    emissions,
    band: calc.band,
    breakdown: calc.breakdown,
    factorsUsed: calc.factorsUsed,
    emissionsStandard,
    materiality: {
      narrative: assessment?.narrative ?? null,
      points,
    },
    evidenceIndex,
    disclaimer: REPORT_DISCLAIMER,
    logoUrl,
    brandingAccent,
    preparedBy,
    preparedAt,
    approvedBy,
    approvedAt: opts.approvedAt ?? null,
    preparerNotes: opts.preparerNotes ?? null,
    yoy,
    scopeBreakdown,
    esrsDisclosures,
    dataGaps,
    dataIntegrity: {
      datePrepared: preparedAt,
      preparerNotes: opts.preparerNotes ?? null,
      evidenceCount: evidenceIndex.length,
      factorCount: calc.factorsUsed.length,
      auditTrail: [
        {
          label: "Prepared",
          detail: preparedBy
            ? `${preparedBy.name} · ${preparedAt.slice(0, 10)}`
            : preparedAt.slice(0, 10),
        },
        ...(approvedBy
          ? [
              {
                label: "Approved",
                detail: `${approvedBy.name}${opts.approvedAt ? ` · ${opts.approvedAt.slice(0, 10)}` : ""}`,
              },
            ]
          : [{ label: "Approved", detail: "Pending" }]),
        {
          label: "Evidence files",
          detail: String(evidenceIndex.length),
        },
        {
          label: "Pinned factors",
          detail: String(calc.factorsUsed.length),
        },
        {
          label: "Emissions standard",
          detail: `${EMISSIONS_STANDARD_LABELS[emissionsStandard]} (${emissionsStandard})`,
        },
        {
          label: "Data gaps flagged",
          detail: String(dataGaps.length),
        },
        {
          label: "Period",
          detail: period.label,
        },
        {
          label: "Organisation id",
          detail: opts.organisationId,
        },
      ],
    },
    complianceDeclaration,
    forecast,
    customMetrics: customMetrics.length > 0 ? customMetrics : undefined,
  };
}

/** Resolve optional user id from relationship-like values. */
export function asUserId(value: unknown): string | null {
  return relationId(value);
}
