export type FrameworkType = "csrd" | "brsr" | "gri" | "sasb";

export interface FrameworkMapping {
  checkpointId: string;
  framework: FrameworkType;
  mappedRequirements: string[];
  alignment: "full" | "partial" | "indirect";
  notes: string;
}

export interface FrameworkComplianceStatus {
  framework: FrameworkType;
  totalRequirements: number;
  fullyMappedCheckpoints: number;
  partiallyMappedCheckpoints: number;
  alignmentPercentage: number;
}

const GHG_TO_CSRD_MAPPING: Record<string, string[]> = {
  "GHG-001": ["CSRD-E1-1", "CSRD-E1-2"],
  "GHG-002": ["CSRD-E1-1"],
  "GHG-003": ["CSRD-E1-2"],
  "GHG-004": ["CSRD-E1-3"],
  "GHG-005": ["CSRD-E1-4"],
  "GHG-006": ["CSRD-E1-5"],
  "GHG-007": ["CSRD-E1-6"],
  "GHG-008": ["CSRD-E1-7"],
  "GHG-009": ["CSRD-E1-8"],
  "GHG-010": ["CSRD-E1-9"],
  "GHG-011": ["CSRD-E1-10"],
  "GHG-012": ["CSRD-E1-9"],
  "GHG-013": ["CSRD-E1-11"],
  "GHG-014": ["CSRD-E1-12"],
  "GHG-015": ["CSRD-E1-13"],
  "GHG-016": ["CSRD-E1-14"],
  "GHG-017": ["CSRD-E1-5"],
  "GHG-018": ["CSRD-E1-15"],
  "GHG-019": ["CSRD-E1-16"],
  "GHG-020": ["CSRD-E1-17"],
  "GHG-021": ["CSRD-E1-18"],
  "GHG-022": ["CSRD-E1-19"],
  "GHG-023": ["CSRD-E1-4"],
  "GHG-024": ["CSRD-E1-7"],
  "GHG-025": ["CSRD-E1-20"],
  "GHG-026": ["CSRD-E1-21"],
  "GHG-027": ["CSRD-E1-22"],
  "GHG-028": ["CSRD-E1-23"],
  "GHG-029": ["CSRD-E1-24"],
  "GHG-030": ["CSRD-E1-25"],
  "GHG-031": ["CSRD-E1-26"],
  "GHG-032": ["CSRD-E1-27"],
  "GHG-033": ["CSRD-E1-28"],
  "GHG-034": ["CSRD-E1-29"],
  "GHG-035": ["CSRD-E1-30"],
  "GHG-036": ["CSRD-E1-31"],
  "GHG-037": ["CSRD-E1-32"],
  "GHG-038": ["CSRD-E1-33"],
  "GHG-039": ["CSRD-E1-34"],
  "GHG-040": ["CSRD-E1-35"],
  "GHG-041": ["CSRD-E1-36"],
  "GHG-042": ["CSRD-E1-37"],
  "GHG-043": ["CSRD-E1-38"],
  "GHG-044": ["CSRD-E1-39"],
  "GHG-045": ["CSRD-E1-40"],
  "GHG-046": ["CSRD-E1-41"],
  "GHG-047": ["CSRD-E1-42"],
  "GHG-048": ["CSRD-E1-43"],
  "GHG-049": ["CSRD-E1-44"],
  "GHG-050": ["CSRD-E1-45"],
};

const GHG_TO_BRSR_MAPPING: Record<string, string[]> = {
  "GHG-001": ["BRSR-P1", "BRSR-P2"],
  "GHG-002": ["BRSR-P1"],
  "GHG-003": ["BRSR-P2"],
  "GHG-004": ["BRSR-P3"],
  "GHG-005": ["BRSR-P4"],
  "GHG-006": ["BRSR-P5"],
  "GHG-007": ["BRSR-P6"],
  "GHG-008": ["BRSR-P7"],
  "GHG-009": ["BRSR-P8"],
  "GHG-010": ["BRSR-P9"],
  "GHG-011": ["BRSR-P10"],
  "GHG-012": ["BRSR-P9"],
  "GHG-013": ["BRSR-P11"],
  "GHG-014": ["BRSR-P12"],
  "GHG-015": ["BRSR-P13"],
  "GHG-016": ["BRSR-P14"],
  "GHG-017": ["BRSR-P5"],
  "GHG-018": ["BRSR-P15"],
  "GHG-019": ["BRSR-P16"],
  "GHG-020": ["BRSR-P17"],
  "GHG-021": ["BRSR-P18"],
  "GHG-022": ["BRSR-P19"],
  "GHG-023": ["BRSR-P4"],
  "GHG-024": ["BRSR-P7"],
  "GHG-025": ["BRSR-P20"],
  "GHG-026": ["BRSR-P21"],
  "GHG-027": ["BRSR-P22"],
  "GHG-028": ["BRSR-P23"],
  "GHG-029": ["BRSR-P24"],
  "GHG-030": ["BRSR-P25"],
  "GHG-031": ["BRSR-P26"],
  "GHG-032": ["BRSR-P27"],
  "GHG-033": ["BRSR-P28"],
  "GHG-034": ["BRSR-P29"],
  "GHG-035": ["BRSR-P30"],
  "GHG-036": ["BRSR-P31"],
  "GHG-037": ["BRSR-P32"],
  "GHG-038": ["BRSR-P33"],
  "GHG-039": ["BRSR-P34"],
  "GHG-040": ["BRSR-P35"],
  "GHG-041": ["BRSR-P36"],
  "GHG-042": ["BRSR-P37"],
  "GHG-043": ["BRSR-P38"],
  "GHG-044": ["BRSR-P39"],
  "GHG-045": ["BRSR-P40"],
  "GHG-046": ["BRSR-P41"],
  "GHG-047": ["BRSR-P42"],
  "GHG-048": ["BRSR-P43"],
  "GHG-049": ["BRSR-P44"],
  "GHG-050": ["BRSR-P45"],
};

const GHG_TO_GRI_MAPPING: Record<string, string[]> = {
  "GHG-001": ["GRI-305-1"],
  "GHG-002": ["GRI-305-1"],
  "GHG-003": ["GRI-305-1"],
  "GHG-004": ["GRI-305-1"],
  "GHG-005": ["GRI-305-1"],
  "GHG-006": ["GRI-305-2"],
  "GHG-007": ["GRI-305-2"],
  "GHG-008": ["GRI-305-3"],
  "GHG-009": ["GRI-305-3"],
  "GHG-010": ["GRI-305-1", "GRI-305-2", "GRI-305-3"],
  "GHG-011": ["GRI-305-1"],
  "GHG-012": ["GRI-305-1"],
  "GHG-013": ["GRI-305-1"],
  "GHG-014": ["GRI-305-1"],
  "GHG-015": ["GRI-305-1"],
  "GHG-016": ["GRI-305-1"],
  "GHG-017": ["GRI-305-2"],
  "GHG-018": ["GRI-305-1"],
  "GHG-019": ["GRI-305-1"],
  "GHG-020": ["GRI-305-3"],
  "GHG-021": ["GRI-305-1"],
  "GHG-022": ["GRI-305-1"],
  "GHG-023": ["GRI-305-1"],
  "GHG-024": ["GRI-305-3"],
  "GHG-025": ["GRI-305-1"],
  "GHG-026": ["GRI-305-1"],
  "GHG-027": ["GRI-305-1"],
  "GHG-028": ["GRI-305-1"],
  "GHG-029": ["GRI-305-1"],
  "GHG-030": ["GRI-305-1"],
  "GHG-031": ["GRI-305-1"],
  "GHG-032": ["GRI-305-1"],
  "GHG-033": ["GRI-305-1"],
  "GHG-034": ["GRI-305-1"],
  "GHG-035": ["GRI-305-1"],
  "GHG-036": ["GRI-305-1"],
  "GHG-037": ["GRI-305-1"],
  "GHG-038": ["GRI-305-1"],
  "GHG-039": ["GRI-305-1"],
  "GHG-040": ["GRI-305-1"],
  "GHG-041": ["GRI-305-1"],
  "GHG-042": ["GRI-305-1"],
  "GHG-043": ["GRI-305-1"],
  "GHG-044": ["GRI-305-1"],
  "GHG-045": ["GRI-305-1"],
  "GHG-046": ["GRI-305-1"],
  "GHG-047": ["GRI-305-1"],
  "GHG-048": ["GRI-305-1"],
  "GHG-049": ["GRI-305-1"],
  "GHG-050": ["GRI-305-1"],
};

const GHG_TO_SASB_MAPPING: Record<string, string[]> = {
  "GHG-001": ["GHG-001"],
  "GHG-002": ["GHG-001"],
  "GHG-003": ["GHG-001"],
  "GHG-004": ["GHG-001"],
  "GHG-005": ["GHG-001"],
  "GHG-006": ["GHG-002"],
  "GHG-007": ["GHG-002"],
  "GHG-008": ["GHG-001"],
  "GHG-009": ["GHG-001"],
  "GHG-010": ["GHG-001"],
  "GHG-011": ["GHG-001"],
  "GHG-012": ["GHG-001"],
  "GHG-013": ["GHG-001"],
  "GHG-014": ["GHG-001"],
  "GHG-015": ["GHG-001"],
  "GHG-016": ["GHG-001"],
  "GHG-017": ["GHG-002"],
  "GHG-018": ["GHG-001"],
  "GHG-019": ["GHG-001"],
  "GHG-020": ["GHG-001"],
  "GHG-021": ["GHG-001"],
  "GHG-022": ["GHG-001"],
  "GHG-023": ["GHG-001"],
  "GHG-024": ["GHG-001"],
  "GHG-025": ["GHG-001"],
  "GHG-026": ["GHG-001"],
  "GHG-027": ["GHG-001"],
  "GHG-028": ["GHG-001"],
  "GHG-029": ["GHG-001"],
  "GHG-030": ["GHG-001"],
  "GHG-031": ["GHG-001"],
  "GHG-032": ["GHG-001"],
  "GHG-033": ["GHG-001"],
  "GHG-034": ["GHG-001"],
  "GHG-035": ["GHG-001"],
  "GHG-036": ["GHG-001"],
  "GHG-037": ["GHG-001"],
  "GHG-038": ["GHG-001"],
  "GHG-039": ["GHG-001"],
  "GHG-040": ["GHG-001"],
  "GHG-041": ["GHG-001"],
  "GHG-042": ["GHG-001"],
  "GHG-043": ["GHG-001"],
  "GHG-044": ["GHG-001"],
  "GHG-045": ["GHG-001"],
  "GHG-046": ["GHG-001"],
  "GHG-047": ["GHG-001"],
  "GHG-048": ["GHG-001"],
  "GHG-049": ["GHG-001"],
  "GHG-050": ["GHG-001"],
};

export function getFrameworkMapping(
  checkpointId: string,
  framework: FrameworkType
): FrameworkMapping {
  let mappedRequirements: string[] = [];
  let alignment: "full" | "partial" | "indirect" = "indirect";

  switch (framework) {
    case "csrd":
      mappedRequirements = GHG_TO_CSRD_MAPPING[checkpointId] || [];
      alignment = mappedRequirements.length > 0 ? "full" : "indirect";
      break;
    case "brsr":
      mappedRequirements = GHG_TO_BRSR_MAPPING[checkpointId] || [];
      alignment = mappedRequirements.length > 0 ? "full" : "indirect";
      break;
    case "gri":
      mappedRequirements = GHG_TO_GRI_MAPPING[checkpointId] || [];
      alignment = mappedRequirements.length > 0 ? "full" : "indirect";
      break;
    case "sasb":
      mappedRequirements = GHG_TO_SASB_MAPPING[checkpointId] || [];
      alignment = mappedRequirements.length > 0 ? "full" : "indirect";
      break;
  }

  return {
    checkpointId,
    framework,
    mappedRequirements,
    alignment,
    notes: generateMappingNotes(checkpointId, framework, mappedRequirements),
  };
}

function generateMappingNotes(
  checkpointId: string,
  framework: FrameworkType,
  mappedRequirements: string[]
): string {
  if (mappedRequirements.length === 0) {
    return `This GHG Protocol checkpoint has indirect relevance to ${framework.toUpperCase()}.`;
  }

  return `This checkpoint directly addresses ${framework.toUpperCase()} requirement(s): ${mappedRequirements.join(", ")}`;
}

export function calculateFrameworkComplianceStatus(
  checkpointStatuses: Record<string, "not-started" | "in-progress" | "completed" | "verified" | "waived">,
  framework: FrameworkType
): FrameworkComplianceStatus {
  let mapping: Record<string, string[]>;

  switch (framework) {
    case "csrd":
      mapping = GHG_TO_CSRD_MAPPING;
      break;
    case "brsr":
      mapping = GHG_TO_BRSR_MAPPING;
      break;
    case "gri":
      mapping = GHG_TO_GRI_MAPPING;
      break;
    case "sasb":
      mapping = GHG_TO_SASB_MAPPING;
      break;
  }

  let fullyMappedCheckpoints = 0;
  let partiallyMappedCheckpoints = 0;
  let totalRequirements = 0;

  Object.entries(checkpointStatuses).forEach(([checkpointId, status]) => {
    const frameworkRequirements = mapping[checkpointId] || [];
    if (frameworkRequirements.length > 0) {
      totalRequirements += frameworkRequirements.length;
      if (status === "verified" || status === "waived") {
        fullyMappedCheckpoints++;
      } else if (status === "completed" || status === "in-progress") {
        partiallyMappedCheckpoints++;
      }
    }
  });

  const alignmentPercentage =
    totalRequirements > 0
      ? Math.round((fullyMappedCheckpoints / totalRequirements) * 100)
      : 0;

  return {
    framework,
    totalRequirements,
    fullyMappedCheckpoints,
    partiallyMappedCheckpoints,
    alignmentPercentage,
  };
}

export function generateFrameworkComplianceNarrative(
  status: FrameworkComplianceStatus
): string {
  const frameworkNames: Record<FrameworkType, string> = {
    csrd: "Corporate Sustainability Reporting Directive (CSRD)",
    brsr: "Business Responsibility and Sustainability Report (BRSR)",
    gri: "Global Reporting Initiative (GRI)",
    sasb: "Sustainability Accounting Standards Board (SASB)",
  };

  const parts: string[] = [];
  parts.push(`### ${frameworkNames[status.framework]} Compliance\n`);
  parts.push(
    `**Alignment Score:** ${status.alignmentPercentage}% (${status.fullyMappedCheckpoints}/${status.totalRequirements} requirements met)\n`
  );

  if (status.alignmentPercentage >= 90) {
    parts.push(
      `The organization is **highly aligned** with ${status.framework.toUpperCase()} requirements.`
    );
  } else if (status.alignmentPercentage >= 70) {
    parts.push(
      `The organization has **strong alignment** with ${status.framework.toUpperCase()} requirements.`
    );
  } else if (status.alignmentPercentage >= 50) {
    parts.push(
      `The organization has **moderate alignment** with ${status.framework.toUpperCase()} requirements.`
    );
  } else {
    parts.push(
      `The organization should strengthen alignment with ${status.framework.toUpperCase()} requirements.`
    );
  }

  return parts.join("\n");
}
