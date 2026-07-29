/**
 * Supplier Tier Categorization Engine
 * Classifies suppliers by criticality: Tier 1 (direct), Tier 2 (indirect), Tier 3+ (second-level)
 */

export type SupplierTier = "tier_1" | "tier_2" | "tier_3" | "tier_4";
export type DataTemplate = "full" | "abbreviated" | "minimal";

export interface TierDefinition {
  tier: SupplierTier;
  description: string;
  dataTemplate: DataTemplate;
  questionnaireLength: number;
  slaTargetDays: number;
  priority: number; // 1-5, higher = more important
}

export interface TierCategorization {
  tier: SupplierTier;
  reason: string;
  confidence: number; // 0-1
  importance: number; // 0-100, based on spend
  suggestedTemplate: DataTemplate;
  slaTargetDays: number;
}

const TIER_DEFINITIONS: Record<SupplierTier, TierDefinition> = {
  tier_1: {
    tier: "tier_1",
    description: "Direct suppliers to organization",
    dataTemplate: "full",
    questionnaireLength: 30,
    slaTargetDays: 30,
    priority: 5,
  },
  tier_2: {
    tier: "tier_2",
    description: "Suppliers to Tier 1 suppliers (indirect)",
    dataTemplate: "abbreviated",
    questionnaireLength: 15,
    slaTargetDays: 45,
    priority: 3,
  },
  tier_3: {
    tier: "tier_3",
    description: "Second-level indirect suppliers",
    dataTemplate: "minimal",
    questionnaireLength: 5,
    slaTargetDays: 60,
    priority: 2,
  },
  tier_4: {
    tier: "tier_4",
    description: "Third-level indirect suppliers",
    dataTemplate: "minimal",
    questionnaireLength: 0,
    slaTargetDays: 90,
    priority: 1,
  },
};

/**
 * Categorize a single supplier into a tier
 * Rules:
 * - Tier 1: Any direct supplier (has purchase order or invitation sent)
 * - Tier 2: Suppliers that supply Tier 1 suppliers
 * - Tier 3+: Transitive suppliers
 */
export function categorizeSingleSupplier(
  supplier: {
    id: string;
    name: string;
    annualSpend?: number;
    requestToken?: string; // Has been invited = Tier 1
    respondedAt?: Date; // Has responded = Tier 1
    hasPurchaseOrder?: boolean;
  },
  tier1SupplierIds?: Set<string>,
): TierCategorization {
  // Tier 1: Direct suppliers
  if (supplier.requestToken || supplier.hasPurchaseOrder) {
    return {
      tier: "tier_1",
      reason: "Direct supplier - has active request or purchase order",
      confidence: 0.95,
      importance: (supplier.annualSpend ?? 0) / 100000, // Normalize to 0-100
      suggestedTemplate: "full",
      slaTargetDays: 30,
    };
  }

  // Tier 2: Suppliers of Tier 1 (if known)
  if (tier1SupplierIds?.size) {
    return {
      tier: "tier_2",
      reason: "Indirect supplier - supplies Tier 1 suppliers",
      confidence: 0.8,
      importance: Math.min(100, (supplier.annualSpend ?? 0) / 50000),
      suggestedTemplate: "abbreviated",
      slaTargetDays: 45,
    };
  }

  // Default to Tier 1 for unknown (conservative)
  return {
    tier: "tier_1",
    reason: "Unclassified - assuming direct supplier",
    confidence: 0.5,
    importance: Math.min(100, (supplier.annualSpend ?? 0) / 100000),
    suggestedTemplate: "full",
    slaTargetDays: 30,
  };
}

/**
 * Calculate spend-weighted importance score
 * Used to prioritize which Tier 2 suppliers get full questionnaires
 */
export function calculateImportanceScore(
  supplier: {
    tier: SupplierTier;
    spend: number;
    riskTier?: "low" | "medium" | "high" | "critical";
  },
  totalSpend: number,
): number {
  const spendPct = (supplier.spend / totalSpend) * 100;
  const tierPriority = TIER_DEFINITIONS[supplier.tier].priority;

  // Risk multiplier
  const riskMultiplier = supplier.riskTier
    ? {
        low: 0.5,
        medium: 1,
        high: 1.5,
        critical: 2,
      }[supplier.riskTier]
    : 1;

  // Score = (spend % + tier priority) * risk multiplier
  return Math.min(100, (spendPct + tierPriority * 10) * riskMultiplier);
}

/**
 * Bulk categorize suppliers
 */
export interface BulkCategorizationResult {
  processed: number;
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
  errors: string[];
}

export function categorizeBulk(
  suppliers: Array<{
    id: string;
    name: string;
    annualSpend?: number;
    requestToken?: string;
    respondedAt?: Date;
  }>,
): {
  results: Array<{
    id: string;
    name: string;
    categorization: TierCategorization;
  }>;
  summary: BulkCategorizationResult;
} {
  const results: Array<{
    id: string;
    name: string;
    categorization: TierCategorization;
  }> = [];

  const summary: BulkCategorizationResult = {
    processed: 0,
    tier1: 0,
    tier2: 0,
    tier3: 0,
    tier4: 0,
    errors: [],
  };

  // First pass: identify Tier 1 suppliers
  const tier1Ids = new Set<string>();
  for (const supplier of suppliers) {
    if (supplier.requestToken || supplier.respondedAt) {
      tier1Ids.add(supplier.id);
    }
  }

  // Second pass: categorize all
  for (const supplier of suppliers) {
    try {
      const categorization = categorizeSingleSupplier(supplier, tier1Ids);
      results.push({
        id: supplier.id,
        name: supplier.name,
        categorization,
      });

      summary.processed++;
      if (categorization.tier === "tier_1") summary.tier1++;
      else if (categorization.tier === "tier_2") summary.tier2++;
      else if (categorization.tier === "tier_3") summary.tier3++;
      else if (categorization.tier === "tier_4") summary.tier4++;
    } catch (error) {
      summary.errors.push(
        `Error categorizing ${supplier.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  return { results, summary };
}

/**
 * Generate data collection template based on tier
 */
export interface QuestionnaireTemplate {
  templateType: DataTemplate;
  questionCount: number;
  scope1Questions: number;
  scope2Questions: number;
  scope3Questions: number;
  estimatedCompletionTime: number; // minutes
  description: string;
}

export function getTemplateForTier(tier: SupplierTier): QuestionnaireTemplate {
  const def = TIER_DEFINITIONS[tier];

  if (def.dataTemplate === "full") {
    return {
      templateType: "full",
      questionCount: 30,
      scope1Questions: 8,
      scope2Questions: 8,
      scope3Questions: 14,
      estimatedCompletionTime: 30,
      description:
        "Comprehensive ESG questionnaire covering direct operations (Scope 1/2) and supply chain (Scope 3)",
    };
  }

  if (def.dataTemplate === "abbreviated") {
    return {
      templateType: "abbreviated",
      questionCount: 15,
      scope1Questions: 5,
      scope2Questions: 5,
      scope3Questions: 5,
      estimatedCompletionTime: 15,
      description:
        "Abbreviated questionnaire focusing on core Scope 1/2 emissions and key practices",
    };
  }

  return {
    templateType: "minimal",
    questionCount: 5,
    scope1Questions: 2,
    scope2Questions: 2,
    scope3Questions: 1,
    estimatedCompletionTime: 5,
    description:
      "Minimal high-level questionnaire for data collection and basic emissions estimate",
  };
}

/**
 * Calculate what % of suppliers are in each tier
 */
export function calculateTierDistribution(
  suppliers: Array<{
    tier: SupplierTier;
    spend: number;
  }>,
): {
  byCount: Record<SupplierTier, { count: number; pct: number }>;
  bySpend: Record<SupplierTier, { spend: number; pct: number }>;
} {
  const totalCount = suppliers.length;
  const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);

  const byCount = {
    tier_1: { count: 0, pct: 0 },
    tier_2: { count: 0, pct: 0 },
    tier_3: { count: 0, pct: 0 },
    tier_4: { count: 0, pct: 0 },
  };

  const bySpend = {
    tier_1: { spend: 0, pct: 0 },
    tier_2: { spend: 0, pct: 0 },
    tier_3: { spend: 0, pct: 0 },
    tier_4: { spend: 0, pct: 0 },
  };

  for (const supplier of suppliers) {
    byCount[supplier.tier].count++;
    bySpend[supplier.tier].spend += supplier.spend;
  }

  for (const tier of Object.keys(byCount) as SupplierTier[]) {
    byCount[tier].pct = totalCount > 0 ? (byCount[tier].count / totalCount) * 100 : 0;
    bySpend[tier].pct = totalSpend > 0 ? (bySpend[tier].spend / totalSpend) * 100 : 0;
  }

  return { byCount, bySpend };
}
