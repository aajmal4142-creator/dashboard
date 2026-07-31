import type { Payload } from "payload";
import {
  buildAllowedFormulaKeys,
  buildOrgCustomMetricsWhere,
  evaluateFormula,
  findDerivedMetricDefs,
  findMetricDefinitionKeys,
  mapCustomMetricDoc,
} from "@/lib/derive";

export type SnapshotCustomMetricQuality = "measured" | "estimated" | "missing";

export type SnapshotCustomMetric = {
  key: string;
  label: string;
  value: number | null;
  unit: string | null;
  quality: SnapshotCustomMetricQuality;
  error?: string;
};

/**
 * Evaluate enabled org custom derived metrics against period datapoint values
 * and calc emission aliases. Keeps I/O out of pure lib/calc.
 */
export async function evaluateOrgCustomMetricsForSnapshot(
  payload: Payload,
  args: {
    organisationId: string;
    datapoints: Array<{
      metricKey?: string | null;
      value?: number | null;
    }>;
    emissions: {
      scope1: number;
      scope2: number;
      scope3: number;
      total: number;
    };
  },
): Promise<SnapshotCustomMetric[]> {
  const listed = await findDerivedMetricDefs(payload, {
    where: {
      and: [
        buildOrgCustomMetricsWhere(args.organisationId),
        { enabled: { equals: true } },
      ],
    },
    limit: 100,
  });

  const defs = listed.docs
    .map((d) => mapCustomMetricDoc(d))
    .filter((d): d is NonNullable<typeof d> => d !== null && Boolean(d.formula));

  if (defs.length === 0) return [];

  const rawKeys = await findMetricDefinitionKeys(payload);
  const { allowed } = buildAllowedFormulaKeys(rawKeys);

  const values: Record<string, number | null> = {
    scope1_emissions: args.emissions.scope1,
    scope2_emissions: args.emissions.scope2,
    scope3_emissions: args.emissions.scope3,
    scope1_total: args.emissions.scope1,
    scope2_total: args.emissions.scope2,
    scope3_total: args.emissions.scope3,
    emissions_total: args.emissions.total,
  };

  for (const dp of args.datapoints) {
    const key = typeof dp.metricKey === "string" ? dp.metricKey : "";
    if (!key) continue;
    if (typeof dp.value === "number" && Number.isFinite(dp.value)) {
      values[key] = dp.value;
    }
  }

  const out: SnapshotCustomMetric[] = [];
  for (const def of defs) {
    const result = evaluateFormula(def.formula, values, allowed);
    if (!result.ok) {
      out.push({
        key: def.key,
        label: def.label,
        value: null,
        unit: def.unit || null,
        quality: "missing",
        error: result.error,
      });
      continue;
    }
    out.push({
      key: def.key,
      label: def.label,
      value: result.value,
      unit: def.unit || null,
      quality: "measured",
    });
  }
  return out;
}
