import type {
  Scope3Category,
  Scope3Activity,
  EmissionsFactor,
  UncertaintyRange,
} from "./types";
import { EmissionsFactorService } from "./emissionsFactorService";

export interface ActivityCalculation {
  emissions: number;
  calculation: string; // e.g., "100 miles × 0.00021 tCO2e/mile = 0.021 tCO2e"
}

export interface CategoryTotal {
  category: Scope3Category;
  emissions: number;
  sourceCount: number;
  sourceBreakdown: Array<{
    sourceId: string;
    sourceName: string;
    emissions: number;
  }>;
}

export interface YearComparison {
  year1Total: number;
  year2Total: number;
  change: number;
  percentChange: number;
}

export class Scope3Calculator {
  private factorService: EmissionsFactorService;

  constructor(factorService?: EmissionsFactorService) {
    this.factorService =
      factorService ??
      new EmissionsFactorService({
        factors: [],
        standard: "GHGProtocol2004",
      });
  }

  // Calculate emissions for single activity
  async calculateActivityEmissions(
    activityValue: number,
    emissionsFactor: EmissionsFactor,
  ): Promise<ActivityCalculation> {
    const emissions = this.factorService.calculateEmissions(
      activityValue,
      emissionsFactor,
    );

    const calculation = `${activityValue} ${emissionsFactor.unit} × ${emissionsFactor.value} tCO2e/${emissionsFactor.unit} = ${emissions.toFixed(6)} tCO2e`;

    return {
      emissions,
      calculation,
    };
  }

  // Calculate total emissions from multiple activities
  calculateTotal(activities: Array<{ emissions: number }>): number {
    return activities.reduce((sum, activity) => sum + activity.emissions, 0);
  }

  // Calculate total by category (aggregate sources)
  calculateCategoryTotal(
    activities: Array<Scope3Activity & { source: { name: string } }>,
    _category: Scope3Category,
  ): CategoryTotal {
    const categoryActivities = activities.filter(() => {
      // Filter by category - this assumes activity has source type info
      return true; // Will be filtered upstream
    });

    const sourceMap = new Map<string, { name: string; emissions: number }>();

    for (const activity of categoryActivities) {
      const existing = sourceMap.get(activity.sourceId) || {
        name: activity.source.name,
        emissions: 0,
      };
      existing.emissions += activity.calculatedEmissions;
      sourceMap.set(activity.sourceId, existing);
    }

    const sourceBreakdown = Array.from(sourceMap.entries()).map(([sourceId, data]) => ({
      sourceId,
      sourceName: data.name,
      emissions: data.emissions,
    }));

    return {
      category: _category,
      emissions: sourceBreakdown.reduce((sum, b) => sum + b.emissions, 0),
      sourceCount: sourceBreakdown.length,
      sourceBreakdown,
    };
  }

  // Year-over-year comparison
  compareYears(
    activities1: Array<{ emissions: number }>,
    activities2: Array<{ emissions: number }>,
  ): YearComparison {
    const year1Total = this.calculateTotal(activities1);
    const year2Total = this.calculateTotal(activities2);
    const change = year2Total - year1Total;
    const percentChange = year1Total === 0 ? 0 : (change / year1Total) * 100;

    return {
      year1Total,
      year2Total,
      change,
      percentChange,
    };
  }

  // Uncertainty analysis using simple confidence intervals
  calculateUncertaintyRange(
    bestEstimate: number,
    confidence: "high" | "medium" | "low" = "medium",
    confidenceLevel: 0.68 | 0.95 = 0.95,
  ): UncertaintyRange {
    return this.factorService.calculateUncertaintyRange(
      bestEstimate,
      confidence,
      confidenceLevel,
    );
  }

  // Monte Carlo simulation for uncertainty propagation
  // Simulates activity values and factors within confidence ranges
  async monteCarloUncertainty(
    activityValue: number,
    emissionsFactor: EmissionsFactor,
    iterations: number = 100,
  ): Promise<UncertaintyRange> {
    const results: number[] = [];

    // Assume normal distribution for activity value and factor value
    const activityStdDev = activityValue * 0.05; // ±5% std dev on activity
    const factorStdDev =
      emissionsFactor.value *
      (emissionsFactor.confidence === "high"
        ? 0.05
        : emissionsFactor.confidence === "medium"
          ? 0.15
          : 0.3);

    for (let i = 0; i < iterations; i++) {
      // Generate random normal values
      const randomActivity = this.randomNormal(activityValue, activityStdDev);
      const randomFactor = this.randomNormal(emissionsFactor.value, factorStdDev);

      const emissions = Math.max(0, randomActivity * randomFactor);
      results.push(emissions);
    }

    // Sort to find percentiles
    results.sort((a, b) => a - b);

    return {
      low: results[Math.floor(results.length * 0.025)], // 2.5th percentile
      best: results[Math.floor(results.length * 0.5)], // 50th percentile (median)
      high: results[Math.floor(results.length * 0.975)], // 97.5th percentile
    };
  }

  // Helper: Generate random normal distribution value
  private randomNormal(mean: number, stdDev: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  // Calculate weighted average of emissions across multiple activities
  calculateWeightedAverage(
    activities: Array<{ emissions: number; weight: number }>,
  ): number {
    const totalWeight = activities.reduce((sum, a) => sum + a.weight, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = activities.reduce((sum, a) => sum + a.emissions * a.weight, 0);
    return weightedSum / totalWeight;
  }

  // Aggregate emissions by multiple dimensions
  aggregateByDimensions(
    activities: Scope3Activity[],
    dimension: "source" | "period" | "category",
  ): Array<{ key: string; emissions: number; count: number }> {
    const groups = new Map<string, { emissions: number; count: number }>();

    for (const activity of activities) {
      let key: string;
      if (dimension === "source") {
        key = activity.sourceId;
      } else if (dimension === "period") {
        key = activity.periodId;
      } else {
        key = dimension;
      }

      const existing = groups.get(key) || { emissions: 0, count: 0 };
      existing.emissions += activity.calculatedEmissions;
      existing.count += 1;
      groups.set(key, existing);
    }

    return Array.from(groups.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));
  }
}
