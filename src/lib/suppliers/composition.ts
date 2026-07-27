/**
 * Pure Scope 3 composition from per-supplier contribution rows.
 * Zero I/O. Supersession: primary excludes that supplier's estimate from totals.
 */

export const SUPPLIER_SPEND_ESTIMATE_METRIC = "supplier_spend_estimate_tco2e";
export const SUPPLIER_REPORTED_METRIC = "supplier_reported_tco2e";

export type Scope3Contribution = {
  supplierId: string;
  provenance: "supplier_primary" | "spend_estimate";
  /** Ignore when quality is missing (superseded or gap). */
  quality: "measured" | "calculated" | "estimated" | "missing";
  value: number | null;
};

export type Scope3Composition = {
  primaryTco2e: number;
  estimateTco2e: number;
  totalTco2e: number;
  /** 0–100; 0 when total is 0. */
  primarySharePct: number;
  /** Suppliers with neither active primary nor active estimate. */
  gapSupplierIds: string[];
};

/**
 * Roll up contributions without double-counting.
 * If a supplier has an active primary, their spend_estimate is excluded
 * even if still present with quality estimated (defense in depth).
 */
export function composeScope3Contributions(
  rows: Scope3Contribution[],
  allSupplierIds: string[] = [],
): Scope3Composition {
  const activePrimary = new Set<string>();
  let primaryTco2e = 0;
  let estimateTco2e = 0;

  for (const row of rows) {
    if (row.quality === "missing" || row.value == null) continue;
    if (row.provenance === "supplier_primary") {
      activePrimary.add(row.supplierId);
      primaryTco2e += row.value;
    }
  }

  for (const row of rows) {
    if (row.quality === "missing" || row.value == null) continue;
    if (row.provenance === "spend_estimate") {
      if (activePrimary.has(row.supplierId)) continue;
      estimateTco2e += row.value;
    }
  }

  const covered = new Set<string>();
  for (const row of rows) {
    if (row.quality === "missing" || row.value == null) continue;
    if (row.provenance === "supplier_primary") covered.add(row.supplierId);
    if (row.provenance === "spend_estimate" && !activePrimary.has(row.supplierId)) {
      covered.add(row.supplierId);
    }
  }

  const gapSupplierIds = allSupplierIds.filter((id) => !covered.has(id));
  const totalTco2e = primaryTco2e + estimateTco2e;
  const primarySharePct =
    totalTco2e > 0 ? Math.round((primaryTco2e / totalTco2e) * 1000) / 10 : 0;

  return {
    primaryTco2e,
    estimateTco2e,
    totalTco2e,
    primarySharePct,
    gapSupplierIds,
  };
}
