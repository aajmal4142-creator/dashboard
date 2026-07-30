/**
 * EU Green Taxonomy classification and alignment calculations.
 * Implements Article 10 SFDR disclosure support.
 */

export interface TaxonomyActivity {
  code: string;
  name: string;
  sector: string;
  subSector: string;
  alignmentCriteria: {
    substantialContribution: string[];
    doNoSignificantHarm: string[];
  };
}

export interface ActivityClassification {
  metricKey: string;
  taxonomyCode?: string;
  isAligned: boolean;
  alignmentReason?: string;
  financialValue?: number;
  confidence: "high" | "medium" | "low";
}

export interface TaxonomyAlignment {
  totalActivities: number;
  alignedActivities: number;
  alignmentPercentage: number;
  financialAlignment: {
    totalValue: number;
    alignedValue: number;
    percentage: number;
  };
  byEconomicActivity: Record<string, { count: number; aligned: number }>;
  sfdrDisclosure: {
    article10: boolean;
    alignedPercentage: number;
    alignedActivitiesList: string[];
  };
}

// Simplified EU Taxonomy mapping (common ESG metrics)
const TAXONOMY_MAPPINGS: Record<string, TaxonomyActivity> = {
  electricity_kwh: {
    code: "3.1.1",
    name: "Electricity generation from solar energy",
    sector: "Energy",
    subSector: "Renewable Energy",
    alignmentCriteria: {
      substantialContribution: [
        "GHG emissions avoided by generation of renewable electricity",
      ],
      doNoSignificantHarm: [
        "Climate change mitigation criteria met",
        "No significant water or marine pollution",
      ],
    },
  },
  renewable_energy_kwh: {
    code: "3.1",
    name: "Renewable energy generation",
    sector: "Energy",
    subSector: "Renewable Energy",
    alignmentCriteria: {
      substantialContribution: ["Contribution to climate mitigation"],
      doNoSignificantHarm: ["Environmental safeguards met"],
    },
  },
  electric_vehicle_count: {
    code: "6.5",
    name: "Transport by motorbikes, cars and vans",
    sector: "Transport",
    subSector: "Road Transport",
    alignmentCriteria: {
      substantialContribution: ["Zero direct emissions or <50g CO2/km"],
      doNoSignificantHarm: ["Battery recycling standards met"],
    },
  },
  waste_recycled_kg: {
    code: "5.1",
    name: "Waste prevention and management",
    sector: "Waste Management",
    subSector: "Circular Economy",
    alignmentCriteria: {
      substantialContribution: ["Transition to circular economy"],
      doNoSignificantHarm: ["Proper waste handling"],
    },
  },
  water_reduction_m3: {
    code: "2.1",
    name: "Water and wastewater management",
    sector: "Water",
    subSector: "Water Management",
    alignmentCriteria: {
      substantialContribution: ["Water efficiency and reuse"],
      doNoSignificantHarm: ["Ecosystem protection"],
    },
  },
  natural_gas_m3: {
    code: "1.3",
    name: "Electricity generation from gas",
    sector: "Energy",
    subSector: "Fossil Fuels (Transitional)",
    alignmentCriteria: {
      substantialContribution: ["Lower emissions than coal"],
      doNoSignificantHarm: ["Methane leakage minimized"],
    },
  },
};

// Activity codes for EU Taxonomy economic activities
export const EU_TAXONOMY_SECTORS = [
  "Agriculture, forestry and fishing",
  "Manufacturing",
  "Energy",
  "Water supply, sewerage and waste",
  "Construction",
  "Transport",
  "Information and communication",
  "Professional, scientific and technical activities",
  "Other economic activities",
];

export function classifyActivity(metricKey: string): ActivityClassification {
  const taxonomy = TAXONOMY_MAPPINGS[metricKey];

  if (!taxonomy) {
    return {
      metricKey,
      isAligned: false,
      confidence: "low",
      alignmentReason: "Metric not mapped to taxonomy",
    };
  }

  return {
    metricKey,
    taxonomyCode: taxonomy.code,
    isAligned: true,
    alignmentReason: `Classified as ${taxonomy.name}`,
    confidence: "high",
  };
}

export function calculateTaxonomyAlignment(
  activities: Array<{
    metricKey: string;
    value: number;
  }>,
  financialValues?: Record<string, number>,
): TaxonomyAlignment {
  const classifications = activities.map((a) => classifyActivity(a.metricKey));
  const alignedCount = classifications.filter((c) => c.isAligned).length;

  // Calculate financial alignment if provided
  let totalFinancialValue = 0;
  let alignedFinancialValue = 0;

  if (financialValues) {
    activities.forEach((activity, idx) => {
      const value = financialValues[activity.metricKey] || 0;
      totalFinancialValue += value;

      if (classifications[idx]?.isAligned) {
        alignedFinancialValue += value;
      }
    });
  }

  // Group by economic activity
  const byEconomicActivity: Record<string, { count: number; aligned: number }> = {};
  classifications.forEach((c) => {
    const taxonomy = TAXONOMY_MAPPINGS[c.metricKey];
    if (taxonomy) {
      const key = taxonomy.sector;
      if (!byEconomicActivity[key]) {
        byEconomicActivity[key] = { count: 0, aligned: 0 };
      }
      byEconomicActivity[key].count++;
      if (c.isAligned) {
        byEconomicActivity[key].aligned++;
      }
    }
  });

  const alignmentPercentage =
    activities.length > 0 ? (alignedCount / activities.length) * 100 : 0;
  const financialPercentage =
    totalFinancialValue > 0 ? (alignedFinancialValue / totalFinancialValue) * 100 : 0;

  return {
    totalActivities: activities.length,
    alignedActivities: alignedCount,
    alignmentPercentage: Math.round(alignmentPercentage * 10) / 10,
    financialAlignment: {
      totalValue: totalFinancialValue,
      alignedValue: alignedFinancialValue,
      percentage: Math.round(financialPercentage * 10) / 10,
    },
    byEconomicActivity,
    sfdrDisclosure: {
      article10: alignmentPercentage > 0,
      alignedPercentage: Math.round(alignmentPercentage * 10) / 10,
      alignedActivitiesList: classifications
        .filter((c) => c.isAligned && c.taxonomyCode)
        .map((c) => c.taxonomyCode!)
        .filter((v, i, a) => a.indexOf(v) === i), // unique
    },
  };
}

export function generateSFDRArticle10(alignment: TaxonomyAlignment): string {
  const { sfdrDisclosure } = alignment;

  if (!sfdrDisclosure.article10) {
    return "The organisation has no economic activities aligned with the EU Taxonomy.";
  }

  const percentage = sfdrDisclosure.alignedPercentage;
  const activities = sfdrDisclosure.alignedActivitiesList.join(", ");

  return `${percentage}% of economic activities are aligned with the EU Taxonomy for climate change mitigation. Aligned activities include: ${activities}. This disclosure is provided pursuant to Article 10 of Regulation (EU) 2019/2088 (SFDR).`;
}

export function getTaxonomyActivity(metricKey: string): TaxonomyActivity | undefined {
  return TAXONOMY_MAPPINGS[metricKey];
}

export function listAlignedMetrics(): Array<{ key: string; name: string }> {
  return Object.entries(TAXONOMY_MAPPINGS).map(([key, value]) => ({
    key,
    name: value.name,
  }));
}
