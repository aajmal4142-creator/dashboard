import { resolveFactor, type FactorRecord } from "@/lib/calc";
import {
  DEFAULT_EMISSIONS_STANDARD,
  type EmissionsStandard,
} from "@/lib/factors/standards";

import type { EmissionsFactor, Scope3Category } from "./types";

/**
 * Maps Scope 3 category + activity data type → EmissionFactors.key.
 * Values live in the registry — never hardcoded here.
 */
export function scope3FactorKey(category: Scope3Category, dataType: string): string {
  return `scope3_${category}_${dataType}`;
}

function confidenceFromUncertainty(
  uncertaintyPct: number | undefined,
): "high" | "medium" | "low" {
  if (uncertaintyPct === undefined) return "medium";
  if (uncertaintyPct <= 10) return "high";
  if (uncertaintyPct <= 25) return "medium";
  return "low";
}

function toEmissionsFactor(factor: FactorRecord): EmissionsFactor {
  return {
    value: factor.value,
    unit: factor.unit,
    source: factor.source,
    year: factor.publicationYear,
    confidence: confidenceFromUncertainty(factor.uncertaintyPct),
    standard: factor.standard,
    factorId: factor.id,
    key: factor.key,
  };
}

/**
 * Registry-backed Scope 3 factor resolution.
 * Hardcoded DEFRA/IPCC tables were removed — missing factor throws.
 */
export class EmissionsFactorService {
  private factors: FactorRecord[];
  private standard: EmissionsStandard;
  private region: string;

  constructor(opts: {
    factors: FactorRecord[];
    standard?: EmissionsStandard;
    region?: string;
  }) {
    this.factors = opts.factors;
    this.standard = opts.standard ?? DEFAULT_EMISSIONS_STANDARD;
    this.region = opts.region ?? "GLOBAL";
  }

  /**
   * Resolve default factor for category/type from the registry.
   * Throws when no matching factor exists — never silent fallback.
   */
  getDefaultFactor(
    category: Scope3Category,
    dataType: string,
    year?: number,
  ): EmissionsFactor {
    const key = scope3FactorKey(category, dataType);
    const resolveYear = year ?? new Date().getUTCFullYear();
    const factor = resolveFactor(
      this.factors,
      key,
      this.region,
      resolveYear,
      this.standard,
    );
    return toEmissionsFactor(factor);
  }

  /** All registry factors for a Scope 3 category under the active standard. */
  getFactorsForCategory(
    category: Scope3Category,
  ): Array<EmissionsFactor & { dataType: string }> {
    const prefix = `scope3_${category}_`;
    const byKey = new Map<string, FactorRecord>();

    for (const f of this.factors) {
      if (!f.key.startsWith(prefix)) continue;
      if (f.standard !== undefined && f.standard !== this.standard) continue;
      const existing = byKey.get(f.key);
      if (!existing || f.publicationYear > existing.publicationYear) {
        byKey.set(f.key, f);
      }
    }

    return Array.from(byKey.entries()).map(([key, factor]) => ({
      ...toEmissionsFactor(factor),
      dataType: key.slice(prefix.length),
    }));
  }

  searchFactors(query: string): EmissionsFactor[] {
    const lowerQuery = query.toLowerCase();
    const results: EmissionsFactor[] = [];

    for (const factor of this.factors) {
      if (factor.standard !== undefined && factor.standard !== this.standard) continue;
      if (!factor.key.startsWith("scope3_")) continue;
      if (
        factor.key.toLowerCase().includes(lowerQuery) ||
        factor.source.toLowerCase().includes(lowerQuery) ||
        (factor.standard ?? "").toLowerCase().includes(lowerQuery)
      ) {
        results.push(toEmissionsFactor(factor));
      }
    }

    return results;
  }

  calculateEmissions(activityValue: number, emissionsFactor: EmissionsFactor): number {
    return activityValue * emissionsFactor.value;
  }

  calculateUncertaintyRange(
    bestEstimate: number,
    confidence: "high" | "medium" | "low" = "medium",
    confidenceLevel: 0.68 | 0.95 = 0.95,
  ): { low: number; best: number; high: number } {
    const stdDevMap = {
      high: 0.05,
      medium: 0.15,
      low: 0.3,
    };

    const stdDev = stdDevMap[confidence];
    const zScore = confidenceLevel === 0.95 ? 1.96 : 1.0;

    return {
      low: Math.max(0, bestEstimate * (1 - zScore * stdDev)),
      best: bestEstimate,
      high: bestEstimate * (1 + zScore * stdDev),
    };
  }
}
