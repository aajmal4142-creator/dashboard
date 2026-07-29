/**
 * Supply Chain Bottleneck & Concentration Analyzer
 * Identifies risks from concentrated spend, emissions, or supplier relationships
 */

export interface BottleneckResult {
  type: "spend" | "emissions" | "geographic" | "category";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  affectedSuppliers: string[];
  recommendations: string[];
  metric: number; // e.g., 0.75 for 75% concentration
}

export interface ConcentrationMetrics {
  herfindahlSpend: number; // 0-1: 0=diverse, 1=monopoly
  herfindahlEmissions: number;
  concentrationLevel: "low" | "medium" | "high" | "critical";
  topThreeSpendPct: number;
  topThreeEmissionsPct: number;
  bottlenecks: BottleneckResult[];
}

/**
 * Calculate Herfindahl-Hirschman Index (HHI)
 * HHI = sum(market_share_i^2)
 * 0 = perfect competition, 1 = monopoly
 * >0.25 = concerning concentration
 * >0.4 = high concentration (antitrust threshold)
 */
export function calculateHerfindahlIndex(values: number[]): number {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;

  const shares = values.map((v) => v / total);
  const hhi = shares.reduce((sum, s) => sum + s * s, 0);

  return Math.min(1, Math.max(0, hhi));
}

/**
 * Analyze supply chain for bottlenecks and concentration risks
 */
export function analyzeBottlenecks(
  suppliers: Array<{
    id: string;
    name: string;
    tier: number;
    spend: number;
    emissions: number;
    country?: string;
    category?: string;
  }>,
): ConcentrationMetrics {
  const bottlenecks: BottleneckResult[] = [];

  // Spend concentration analysis
  const spendValues = suppliers.map((s) => s.spend);
  const herfindahlSpend = calculateHerfindahlIndex(spendValues);

  const totalSpend = spendValues.reduce((sum, v) => sum + v, 0);
  const topThreeSpend = spendValues
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, v) => sum + v, 0);
  const topThreeSpendPct = totalSpend > 0 ? (topThreeSpend / totalSpend) * 100 : 0;

  if (topThreeSpendPct > 60) {
    const topSuppliers = suppliers.sort((a, b) => b.spend - a.spend).slice(0, 3);
    bottlenecks.push({
      type: "spend",
      severity: "critical",
      message: `Spend concentration risk: Top 3 suppliers represent ${Math.round(topThreeSpendPct)}% of total spend`,
      affectedSuppliers: topSuppliers.map((s) => s.name),
      recommendations: [
        "Diversify supplier base to reduce dependency on key suppliers",
        "Develop secondary sourcing options for critical categories",
        "Implement supply chain redundancy strategy",
      ],
      metric: topThreeSpendPct / 100,
    });
  }

  // Emissions concentration analysis
  const emissionValues = suppliers.map((s) => s.emissions);
  const herfindahlEmissions = calculateHerfindahlIndex(emissionValues);

  const totalEmissions = emissionValues.reduce((sum, v) => sum + v, 0);
  const topThreeEmissions = emissionValues
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, v) => sum + v, 0);
  const topThreeEmissionsPct =
    totalEmissions > 0 ? (topThreeEmissions / totalEmissions) * 100 : 0;

  if (topThreeEmissionsPct > 60) {
    const topEmitters = suppliers.sort((a, b) => b.emissions - a.emissions).slice(0, 3);
    bottlenecks.push({
      type: "emissions",
      severity: "high",
      message: `Emissions concentration: Top 3 suppliers represent ${Math.round(topThreeEmissionsPct)}% of Scope 3 emissions`,
      affectedSuppliers: topEmitters.map((s) => s.name),
      recommendations: [
        "Prioritize engagement with top emitters for decarbonization",
        "Set emissions reduction targets for these suppliers",
        "Consider alternative low-carbon suppliers",
        "Implement supply chain decarbonization program",
      ],
      metric: topThreeEmissionsPct / 100,
    });
  }

  // Geographic concentration
  const countries = suppliers.reduce(
    (acc, s) => {
      if (s.country) {
        acc[s.country] = (acc[s.country] || 0) + s.spend;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const maxGeoConcentration = Math.max(
    ...Object.values(countries).map((v) => (v / totalSpend) * 100),
    0,
  );

  if (maxGeoConcentration > 50) {
    const topCountries = Object.entries(countries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1);

    bottlenecks.push({
      type: "geographic",
      severity: "medium",
      message: `Geographic concentration: ${Math.round(maxGeoConcentration)}% of suppliers in single region creates geopolitical/climate risk`,
      affectedSuppliers: suppliers
        .filter((s) => s.country === topCountries[0][0])
        .map((s) => s.name),
      recommendations: [
        "Diversify supplier locations to mitigate geopolitical risk",
        "Consider climate risks in high-concentration regions",
        "Develop regional backup suppliers",
      ],
      metric: maxGeoConcentration / 100,
    });
  }

  // Category concentration (single supplier for critical category)
  const byCategory = suppliers.reduce(
    (acc, s) => {
      if (s.category) {
        if (!acc[s.category]) acc[s.category] = [];
        acc[s.category].push(s);
      }
      return acc;
    },
    {} as Record<string, typeof suppliers>,
  );

  for (const [category, suppliersInCat] of Object.entries(byCategory)) {
    if (suppliersInCat.length === 1 && suppliersInCat[0].spend > 0) {
      bottlenecks.push({
        type: "category",
        severity: "high",
        message: `Single supplier for ${category}: ${suppliersInCat[0].name} is only source`,
        affectedSuppliers: suppliersInCat.map((s) => s.name),
        recommendations: [
          `Develop secondary supplier for ${category}`,
          "Reduce dependency on single source of critical materials",
          "Establish qualification process for alternative suppliers",
        ],
        metric: 1,
      });
    }
  }

  // Determine overall concentration level
  let concentrationLevel: "low" | "medium" | "high" | "critical" = "low";
  if (herfindahlSpend > 0.3 || herfindahlEmissions > 0.3) {
    concentrationLevel = "high";
  }
  if (herfindahlSpend > 0.4 || herfindahlEmissions > 0.4 || bottlenecks.length > 2) {
    concentrationLevel = "critical";
  } else if (bottlenecks.length > 0) {
    concentrationLevel = "medium";
  }

  return {
    herfindahlSpend,
    herfindahlEmissions,
    concentrationLevel,
    topThreeSpendPct,
    topThreeEmissionsPct,
    bottlenecks,
  };
}

/**
 * Build supply chain graph data for visualization
 */
export interface GraphNode {
  id: string;
  label: string;
  tier: number;
  spend: number;
  emissions: number;
  value: number; // for force graph sizing
  color: string;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number; // spend or emissions for thickness
  type: "spend" | "emissions";
}

export interface SupplyChainGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    totalSuppliers: number;
    totalSpend: number;
    totalEmissions: number;
  };
}

export function buildSupplyChainGraph(
  orgName: string,
  suppliers: Array<{
    id: string;
    name: string;
    tier: number;
    spend: number;
    emissions: number;
    riskTier?: "low" | "medium" | "high" | "critical";
  }>,
): SupplyChainGraph {
  const nodes: GraphNode[] = [
    {
      id: "org",
      label: orgName,
      tier: 0,
      spend: 0,
      emissions: 0,
      value: 30,
      color: "#3b82f6",
    },
  ];

  const links: GraphLink[] = [];

  const tierSuppliers = suppliers.reduce(
    (acc, s) => {
      if (!acc[s.tier]) acc[s.tier] = [];
      acc[s.tier].push(s);
      return acc;
    },
    {} as Record<number, typeof suppliers>,
  );

  for (const [tier, suppliersInTier] of Object.entries(tierSuppliers)) {
    const tierNum = parseInt(tier);
    const avgSpend =
      suppliersInTier.reduce((sum, s) => sum + s.spend, 0) / suppliersInTier.length;

    for (const supplier of suppliersInTier) {
      const riskColor = supplier.riskTier
        ? {
            low: "#22c55e",
            medium: "#eab308",
            high: "#f97316",
            critical: "#ef4444",
          }[supplier.riskTier]
        : "#9ca3af";

      nodes.push({
        id: supplier.id,
        label: supplier.name,
        tier: tierNum,
        spend: supplier.spend,
        emissions: supplier.emissions,
        value: Math.max(5, Math.min(25, supplier.spend / avgSpend + 10)),
        color: riskColor,
      });

      // Connect to org (Tier 1) or previous tier
      const sourceId = tierNum === 1 ? "org" : undefined;
      if (sourceId || tierNum > 1) {
        links.push({
          source: sourceId || "org", // Simplification: all connect to org
          target: supplier.id,
          weight: supplier.spend,
          type: "spend",
        });
      }
    }
  }

  return {
    nodes,
    links,
    stats: {
      totalSuppliers: suppliers.length,
      totalSpend: suppliers.reduce((sum, s) => sum + s.spend, 0),
      totalEmissions: suppliers.reduce((sum, s) => sum + s.emissions, 0),
    },
  };
}
