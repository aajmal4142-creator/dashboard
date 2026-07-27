import { getPayload } from "payload";

import { calculate, type CalcResult, type FactorRecord } from "@/lib/calc";
import type { MatrixPoint } from "@/lib/materiality";
import { metricsAndCompositionFromDatapoints } from "@/lib/suppliers";
import config from "@/payload.config";

import { REPORT_DISCLAIMER, type ReportSnapshot } from "./types";

export async function buildReportSnapshot(opts: {
  organisationId: string;
  periodId: string;
  framework: string;
  version: number;
}): Promise<ReportSnapshot> {
  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: opts.organisationId,
    depth: 0,
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

  const factorsResult = await payload.find({
    collection: "emission-factors",
    limit: 500,
    overrideAccess: true,
  });
  const factors: FactorRecord[] = factorsResult.docs.map((f) => ({
    id: f.id,
    key: f.key,
    value: f.value,
    unit: f.unit,
    source: f.source,
    publicationYear: f.publicationYear,
    region: f.region,
    validFrom: f.validFrom ? String(f.validFrom) : undefined,
    validUntil: f.validUntil ? String(f.validUntil) : undefined,
  }));

  let calc: CalcResult;
  try {
    calc = calculate({ metrics, context: { region, year } }, factors);
  } catch {
    calc = {
      scores: { overall: 0, e: 0, s: 0, g: 0 },
      emissions: {
        scope1: { value: 0, unit: "tCO2e", quality: "missing" },
        scope2: { value: 0, unit: "tCO2e", quality: "missing" },
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

  return {
    organisationName: org.name,
    periodLabel: period.label,
    framework: opts.framework,
    version: opts.version,
    publishedAt: new Date().toISOString(),
    scores: calc.scores,
    emissions: {
      scope1: calc.emissions.scope1.value,
      scope2: calc.emissions.scope2.value,
      scope3: calc.emissions.scope3.value,
      total: calc.emissions.total.value,
      dataQualityPct: calc.dataQualityPct,
      scope3PrimarySharePct: composition.primarySharePct,
      scope3PrimaryTco2e: composition.primaryTco2e,
      scope3EstimateTco2e: composition.estimateTco2e,
    },
    band: calc.band,
    breakdown: calc.breakdown,
    factorsUsed: calc.factorsUsed,
    materiality: {
      narrative: assessment?.narrative ?? null,
      points,
    },
    evidenceIndex: evidence.docs.map((e) => ({
      filename: e.filename,
      sha256: e.sha256,
      metricKey:
        e.extractedData &&
        typeof e.extractedData === "object" &&
        e.extractedData !== null &&
        "metricKey" in e.extractedData
          ? String((e.extractedData as { metricKey?: string }).metricKey ?? "")
          : undefined,
    })),
    disclaimer: REPORT_DISCLAIMER,
  };
}
