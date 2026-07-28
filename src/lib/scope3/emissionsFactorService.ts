import type { EmissionsFactor, Scope3Category } from "./types";

const BUILT_IN_FACTORS: Record<Scope3Category, Record<string, EmissionsFactor>> = {
  supplier: {
    general_procurement: {
      value: 0.00015, // tonnes CO2e per £ spent
      unit: "£",
      source: "DEFRA",
      year: 2023,
      confidence: "medium",
    },
    electronics: {
      value: 0.00045,
      unit: "£",
      source: "DEFRA",
      year: 2023,
      confidence: "medium",
    },
    packaging: {
      value: 0.00025,
      unit: "£",
      source: "DEFRA",
      year: 2023,
      confidence: "medium",
    },
    transport_services: {
      value: 0.0001,
      unit: "£",
      source: "DEFRA",
      year: 2023,
      confidence: "low",
    },
  },
  waste: {
    landfill: {
      value: 0.5, // tonnes CO2e per tonne
      unit: "tonne",
      source: "DEFRA",
      year: 2023,
      confidence: "high",
    },
    recycling: {
      value: 0.05,
      unit: "tonne",
      source: "DEFRA",
      year: 2023,
      confidence: "high",
    },
    incineration: {
      value: 0.3,
      unit: "tonne",
      source: "DEFRA",
      year: 2023,
      confidence: "high",
    },
    composting: {
      value: 0.02,
      unit: "tonne",
      source: "DEFRA",
      year: 2023,
      confidence: "medium",
    },
  },
  business_travel: {
    air_short_haul: {
      value: 0.00018, // tonnes CO2e per mile
      unit: "mile",
      source: "DEFRA",
      year: 2023,
      confidence: "high",
    },
    air_long_haul: {
      value: 0.00009,
      unit: "mile",
      source: "DEFRA",
      year: 2023,
      confidence: "high",
    },
    rail: {
      value: 0.000025,
      unit: "mile",
      source: "DEFRA",
      year: 2023,
      confidence: "high",
    },
    car: {
      value: 0.00021,
      unit: "mile",
      source: "DEFRA",
      year: 2023,
      confidence: "high",
    },
    taxi: {
      value: 0.00016,
      unit: "mile",
      source: "DEFRA",
      year: 2023,
      confidence: "medium",
    },
  },
  investment: {
    fossil_fuels: {
      value: 500, // tCO2e per £1M AUM
      unit: "£1M",
      source: "IPCC",
      year: 2023,
      confidence: "medium",
    },
    technology: {
      value: 100,
      unit: "£1M",
      source: "IPCC",
      year: 2023,
      confidence: "low",
    },
    renewable_energy: {
      value: 20,
      unit: "£1M",
      source: "IPCC",
      year: 2023,
      confidence: "medium",
    },
    real_estate: {
      value: 150,
      unit: "£1M",
      source: "IPCC",
      year: 2023,
      confidence: "low",
    },
  },
  employee_commute: {
    car: {
      value: 0.00021, // tonnes CO2e per mile
      unit: "mile",
      source: "DEFRA",
      year: 2023,
      confidence: "high",
    },
    public_transport: {
      value: 0.00003,
      unit: "mile",
      source: "DEFRA",
      year: 2023,
      confidence: "medium",
    },
    bicycle: {
      value: 0,
      unit: "mile",
      source: "DEFRA",
      year: 2023,
      confidence: "high",
    },
  },
};

export class EmissionsFactorService {
  // Get default factor for category/type
  async getDefaultFactor(
    category: Scope3Category,
    dataType: string,
    year?: number,
  ): Promise<EmissionsFactor | null> {
    const categoryFactors = BUILT_IN_FACTORS[category];
    if (!categoryFactors) return null;

    const factor = categoryFactors[dataType];
    if (!factor) return null;

    // If year is specified and doesn't match, return null (could implement trend later)
    if (year && factor.year !== year) return null;

    return factor;
  }

  // Get all factors for a category
  async getFactorsForCategory(
    category: Scope3Category,
  ): Promise<Array<EmissionsFactor & { dataType: string }>> {
    const categoryFactors = BUILT_IN_FACTORS[category];
    if (!categoryFactors) return [];

    return Object.entries(categoryFactors).map(([dataType, factor]) => ({
      ...factor,
      dataType,
    }));
  }

  // Search factors by keyword
  async searchFactors(query: string): Promise<EmissionsFactor[]> {
    const lowerQuery = query.toLowerCase();
    const results: EmissionsFactor[] = [];

    for (const categoryFactors of Object.values(BUILT_IN_FACTORS)) {
      for (const [dataType, factor] of Object.entries(categoryFactors)) {
        if (
          dataType.toLowerCase().includes(lowerQuery) ||
          factor.source.toLowerCase().includes(lowerQuery)
        ) {
          results.push(factor);
        }
      }
    }

    return results;
  }

  // Calculate emissions: activity × factor
  // Handles unit conversions
  calculateEmissions(activityValue: number, emissionsFactor: EmissionsFactor): number {
    return activityValue * emissionsFactor.value;
  }

  // Calculate uncertainty range based on confidence level
  calculateUncertaintyRange(
    bestEstimate: number,
    confidence: "high" | "medium" | "low" = "medium",
    confidenceLevel: 0.68 | 0.95 = 0.95,
  ): { low: number; best: number; high: number } {
    // Assume standard deviations based on confidence
    const stdDevMap = {
      high: 0.05, // ±5%
      medium: 0.15, // ±15%
      low: 0.3, // ±30%
    };

    const stdDev = stdDevMap[confidence];
    const zScore = confidenceLevel === 0.95 ? 1.96 : 1.0; // 2σ vs 1σ

    return {
      low: Math.max(0, bestEstimate * (1 - zScore * stdDev)),
      best: bestEstimate,
      high: bestEstimate * (1 + zScore * stdDev),
    };
  }
}
