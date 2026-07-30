import type { Payload } from "payload";

import { calculate } from "@/lib/calc";
import { loadOrgEmissionFactors, resolveOrgEmissionsStandard } from "@/lib/factors";
import { metricsAndCompositionFromDatapoints } from "@/lib/suppliers";

import type { ScopeBaseline } from "./scenarioCalculator";

/**
 * Resolve org baseline emissions by scope via datapoints + registry factors.
 * Returns zeros with quality missing when period/data absent — never invents factors.
 */
export async function resolveOrgBaselineByScope(
  payload: Payload,
  organisationId: string,
  baselineYear: number,
): Promise<{
  baseline: ScopeBaseline;
  periodId: string | null;
  quality: "calculated" | "missing";
  message?: string;
}> {
  const periods = await payload.find({
    collection: "reporting-periods",
    where: { organisation: { equals: organisationId } },
    limit: 50,
    overrideAccess: true,
  });

  const baselinePeriod = periods.docs.find(
    (p) => new Date(String(p.startDate)).getFullYear() === baselineYear,
  );

  if (!baselinePeriod) {
    return {
      baseline: { scope1: 0, scope2: 0, scope3: 0 },
      periodId: null,
      quality: "missing",
      message: `No reporting period found for baseline year ${baselineYear}.`,
    };
  }

  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });

  const dps = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { period: { equals: baselinePeriod.id } },
      ],
    },
    limit: 500,
    overrideAccess: true,
  });

  const suppliers = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: organisationId } },
    limit: 500,
    overrideAccess: true,
  });

  const { metrics } = metricsAndCompositionFromDatapoints(
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

  const year = new Date(String(baselinePeriod.endDate)).getFullYear() || baselineYear;
  const region = org.country || "GB";
  const emissionsStandard = resolveOrgEmissionsStandard(org);
  const { factors } = await loadOrgEmissionFactors(payload, {
    settings: { emissionsStandard },
  });

  if (factors.length === 0) {
    return {
      baseline: { scope1: 0, scope2: 0, scope3: 0 },
      periodId: String(baselinePeriod.id),
      quality: "missing",
      message:
        "Emission factor registry is empty for the organisation standard. Seed factors before calculating scenarios.",
    };
  }

  try {
    const calc = calculate({ metrics, context: { region, year } }, factors);
    return {
      baseline: {
        scope1: calc.emissions.scope1.value,
        scope2: calc.emissions.scope2.value,
        scope3: calc.emissions.scope3.value,
      },
      periodId: String(baselinePeriod.id),
      quality: calc.emissions.total.quality === "missing" ? "missing" : "calculated",
      message:
        calc.emissions.total.quality === "missing"
          ? "Baseline period has no calculable activity data."
          : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Calculation failed";
    return {
      baseline: { scope1: 0, scope2: 0, scope3: 0 },
      periodId: String(baselinePeriod.id),
      quality: "missing",
      message: msg,
    };
  }
}
