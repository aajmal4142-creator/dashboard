/**
 * Collapse datapoint docs into calc metrics + Scope 3 composition.
 * Contribution rows (supplierKey !== "") are rolled via composeScope3Contributions
 * so spend estimates never double-count with primary responses.
 */

import type { DatapointValue, Quality } from "@/lib/calc";
import {
  composeScope3Contributions,
  SUPPLIER_REPORTED_METRIC,
  SUPPLIER_SPEND_ESTIMATE_METRIC,
  type Scope3Composition,
  type Scope3Contribution,
} from "@/lib/suppliers/composition";
import { NO_SUPPLIER_KEY } from "@/lib/suppliers/supplierKey";

export type DatapointLike = {
  id: string;
  metricKey: string;
  value?: number | null;
  quality: Quality;
  unit?: string | null;
  provenance?: "supplier_primary" | "spend_estimate" | "manual" | null;
  supplierKey?: string | null;
  supplier?: string | { id: string } | null;
};

function supplierIdOf(dp: DatapointLike): string | null {
  if (dp.supplierKey && dp.supplierKey !== NO_SUPPLIER_KEY) return dp.supplierKey;
  if (!dp.supplier) return null;
  if (typeof dp.supplier === "string") return dp.supplier;
  return dp.supplier.id;
}

export function metricsAndCompositionFromDatapoints(
  docs: DatapointLike[],
  allSupplierIds: string[] = [],
): {
  metrics: Record<string, DatapointValue>;
  composition: Scope3Composition;
} {
  const metrics: Record<string, DatapointValue> = {};
  const contributions: Scope3Contribution[] = [];

  for (const dp of docs) {
    const isContribution =
      dp.supplierKey != null &&
      dp.supplierKey !== NO_SUPPLIER_KEY &&
      (dp.metricKey === SUPPLIER_REPORTED_METRIC ||
        dp.metricKey === SUPPLIER_SPEND_ESTIMATE_METRIC);

    if (isContribution) {
      const sid = supplierIdOf(dp);
      if (!sid) continue;
      const provenance =
        dp.provenance ??
        (dp.metricKey === SUPPLIER_SPEND_ESTIMATE_METRIC
          ? "spend_estimate"
          : "supplier_primary");
      if (provenance === "manual") continue;
      contributions.push({
        supplierId: sid,
        provenance,
        quality: dp.quality,
        value: typeof dp.value === "number" ? dp.value : null,
      });
      continue;
    }

    // Org-level / non-contribution metrics — last write wins per key.
    metrics[dp.metricKey] = {
      value: typeof dp.value === "number" ? dp.value : null,
      quality: dp.quality,
      unit: dp.unit ?? undefined,
    };
  }

  const composition = composeScope3Contributions(contributions, allSupplierIds);

  // Feed calc with rolled primary + estimate; strip raw spend to avoid double-count.
  if (contributions.length > 0) {
    metrics[SUPPLIER_REPORTED_METRIC] = {
      value: composition.primaryTco2e > 0 ? composition.primaryTco2e : null,
      quality: composition.primaryTco2e > 0 ? "calculated" : "missing",
      unit: "tCO2e",
    };
    metrics[SUPPLIER_SPEND_ESTIMATE_METRIC] = {
      value: composition.estimateTco2e > 0 ? composition.estimateTco2e : null,
      quality: composition.estimateTco2e > 0 ? "estimated" : "missing",
      unit: "tCO2e",
    };
    // Prefer estimate rollup over legacy org spend×factor when contributions exist.
    delete metrics.supplier_spend_total;
  }

  return { metrics, composition };
}
