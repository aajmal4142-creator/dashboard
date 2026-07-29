import { getPayload } from "payload";
import config from "@/payload.config";
import { CUSTOM_EMISSION_FACTORS_SLUG } from "@/collections/CustomEmissionFactors";
import { SPEND_BASED_EMISSIONS_SLUG } from "@/collections/SpendBasedEmissions";

export type SpendEmissionsInput = {
  category: string;
  totalSpend: number;
  currency: string;
  glCodeRange?: string[];
  industryCode?: string;
  region?: string;
};

export type SpendEmissionsResult = {
  category: string;
  totalSpend: number;
  emissionsFactor: number;
  calculatedEmissions: number; // kg CO2e
  confidence: "low" | "medium" | "high";
  uncertainty: number;
  factorSource: string;
};

export async function calculateSpendBasedEmissions(
  input: SpendEmissionsInput,
): Promise<SpendEmissionsResult> {
  const payload = await getPayload({ config });

  // Look up emissions factor from database
  const factors = await payload.find({
    collection: CUSTOM_EMISSION_FACTORS_SLUG,
    where: {
      category: { equals: input.category },
      region: { equals: input.region || "Global" },
      status: { equals: "active" },
    },
    sort: "-effectiveDate",
    limit: 1,
  });

  const factor = factors.docs?.[0];
  if (!factor) {
    throw new Error(`No emissions factor found for category: ${input.category}`);
  }

  const emissionsFactor = factor.value as number;
  const calculatedEmissions = input.totalSpend * emissionsFactor;

  return {
    category: input.category,
    totalSpend: input.totalSpend,
    emissionsFactor,
    calculatedEmissions: Math.round(calculatedEmissions * 100) / 100,
    confidence: (factor.confidence as "low" | "medium" | "high") || "medium",
    uncertainty: (factor.uncertainty as number) || 25,
    factorSource: factor.source as string,
  };
}

export async function calculateSpendBatchEmissions(
  spends: SpendEmissionsInput[],
): Promise<SpendEmissionsResult[]> {
  const results: SpendEmissionsResult[] = [];

  for (const spend of spends) {
    try {
      const result = await calculateSpendBasedEmissions(spend);
      results.push(result);
    } catch (error) {
      console.error(`Failed to calculate emissions for ${spend.category}:`, error);
      // Continue with other calculations
    }
  }

  return results;
}

export async function aggregateSpendEmissions(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{
  totalEmissions: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
}> {
  const payload = await getPayload({ config });

  // Get all spend-based emissions records for this period
  const spendRecords = await payload.find({
    collection: SPEND_BASED_EMISSIONS_SLUG,
    where: {
      organisation: { equals: orgId },
      periodStart: { greater_than_equal: periodStart },
      periodEnd: { less_than_equal: periodEnd },
    },
  });

  const byCategory: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalEmissions = 0;

  for (const record of spendRecords.docs) {
    const emissions = record.calculatedEmissions as number;
    const category = record.category as string;
    const source = record.emissionsFactorSource as string;

    totalEmissions += emissions;
    byCategory[category] = (byCategory[category] || 0) + emissions;
    bySource[source] = (bySource[source] || 0) + emissions;
  }

  return {
    totalEmissions: Math.round(totalEmissions * 100) / 100,
    byCategory,
    bySource,
  };
}

export function validateSpendData(spend: SpendEmissionsInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!spend.category) errors.push("Category is required");
  if (!spend.totalSpend || spend.totalSpend <= 0)
    errors.push("Total spend must be greater than 0");
  if (!spend.currency) errors.push("Currency is required");

  const validCurrencies = ["USD", "EUR", "GBP", "INR"];
  if (!validCurrencies.includes(spend.currency))
    errors.push(`Currency must be one of: ${validCurrencies.join(", ")}`);

  return {
    valid: errors.length === 0,
    errors,
  };
}
