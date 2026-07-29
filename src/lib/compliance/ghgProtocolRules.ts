export interface ComplianceRequirement {
  checkpointId: string;
  category: string;
  requirementName: string;
  requirementCode: string;
  requirementText: string;
  applicableScopes: ("scope1" | "scope2" | "scope3")[];
}

export const GHG_PROTOCOL_REQUIREMENTS: ComplianceRequirement[] = [
  // Organizational Boundaries
  {
    checkpointId: "GHG-001",
    category: "organizational-boundaries",
    requirementName: "Define organizational boundaries",
    requirementCode: "Section 2.1",
    requirementText:
      "Determine whether to use the equity share approach, financial control approach, or operational control approach",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-002",
    category: "organizational-boundaries",
    requirementName: "Document boundary approach",
    requirementCode: "Section 2.1.1",
    requirementText:
      "Document the chosen approach and ensure consistency across reporting periods",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-003",
    category: "organizational-boundaries",
    requirementName: "Identify all entities",
    requirementCode: "Section 2.1.2",
    requirementText:
      "Identify all entities within organizational boundaries (subsidiaries, joint ventures, associate companies)",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },

  // Operational Boundaries - Scope 1
  {
    checkpointId: "GHG-004",
    category: "operational-boundaries",
    requirementName: "Define Scope 1 boundaries",
    requirementCode: "Section 3.2",
    requirementText:
      "Scope 1: Direct GHG emissions from owned or controlled sources",
    applicableScopes: ["scope1"],
  },
  {
    checkpointId: "GHG-005",
    category: "operational-boundaries",
    requirementName: "Identify all Scope 1 sources",
    requirementCode: "Section 3.2.1",
    requirementText:
      "Identify stationary combustion, mobile combustion, process emissions, and fugitive emissions",
    applicableScopes: ["scope1"],
  },

  // Operational Boundaries - Scope 2
  {
    checkpointId: "GHG-006",
    category: "operational-boundaries",
    requirementName: "Define Scope 2 boundaries",
    requirementCode: "Section 4.2",
    requirementText:
      "Scope 2: Indirect GHG emissions from purchased electricity, steam, or cooling",
    applicableScopes: ["scope2"],
  },
  {
    checkpointId: "GHG-007",
    category: "operational-boundaries",
    requirementName: "Select Scope 2 calculation method",
    requirementCode: "Section 4.2.2",
    requirementText:
      "Choose location-based method, market-based method, or combined approach",
    applicableScopes: ["scope2"],
  },

  // Operational Boundaries - Scope 3
  {
    checkpointId: "GHG-008",
    category: "operational-boundaries",
    requirementName: "Define Scope 3 boundaries",
    requirementCode: "Section 5.2",
    requirementText:
      "Scope 3: All other indirect emissions in value chain (categories 1-15)",
    applicableScopes: ["scope3"],
  },
  {
    checkpointId: "GHG-009",
    category: "operational-boundaries",
    requirementName: "Identify material Scope 3 categories",
    requirementCode: "Section 5.2.1",
    requirementText:
      "Determine which of 15 Scope 3 categories are material and relevant",
    applicableScopes: ["scope3"],
  },

  // Data Collection
  {
    checkpointId: "GHG-010",
    category: "data-collection",
    requirementName: "Establish data collection procedures",
    requirementCode: "Section 6.2",
    requirementText:
      "Document systematic procedures for collecting activity data and emission factors",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-011",
    category: "data-collection",
    requirementName: "Data sources documentation",
    requirementCode: "Section 6.2.1",
    requirementText:
      "Document source of all activity data (meters, invoices, estimates, etc.)",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-012",
    category: "data-collection",
    requirementName: "Measurement systems",
    requirementCode: "Section 6.2.2",
    requirementText:
      "Use direct measurement where available; use estimation methods only when necessary",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-013",
    category: "data-collection",
    requirementName: "Consolidation periods",
    requirementCode: "Section 6.2.3",
    requirementText:
      "Use consistent calendar year or fiscal year for all entities",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },

  // Calculation Methods
  {
    checkpointId: "GHG-014",
    category: "calculation-methods",
    requirementName: "Select calculation approaches",
    requirementCode: "Section 7.1",
    requirementText:
      "Use specification approach or mass balance approach where appropriate",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-015",
    category: "calculation-methods",
    requirementName: "Document calculation methodology",
    requirementCode: "Section 7.1.1",
    requirementText:
      "Document all calculations, including formulas and intermediate steps",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-016",
    category: "calculation-methods",
    requirementName: "GWP values selection",
    requirementCode: "Section 7.2",
    requirementText:
      "Use consistent IPCC GWP values (100-year global warming potential)",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-017",
    category: "calculation-methods",
    requirementName: "Scope 2 emissions calculation",
    requirementCode: "Section 4.3",
    requirementText:
      "Calculate as: Activity data (kWh/MJ) × Emission factor (kg CO2e per unit)",
    applicableScopes: ["scope2"],
  },

  // Emission Factors
  {
    checkpointId: "GHG-018",
    category: "emission-factors",
    requirementName: "Select emission factor sources",
    requirementCode: "Section 8.1",
    requirementText:
      "Use default emission factors; justify any deviations with data quality",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-019",
    category: "emission-factors",
    requirementName: "Documentation of emission factors",
    requirementCode: "Section 8.1.1",
    requirementText:
      "Document source, date, and applicability of all emission factors used",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-020",
    category: "emission-factors",
    requirementName: "Supplier-specific emission factors",
    requirementCode: "Section 8.1.2",
    requirementText:
      "Use company-specific or supplier-specific factors where available (Scope 3)",
    applicableScopes: ["scope3"],
  },

  // Scope Boundaries
  {
    checkpointId: "GHG-021",
    category: "scope-boundaries",
    requirementName: "Completeness check",
    requirementCode: "Section 9.1",
    requirementText:
      "Ensure all material sources within defined boundaries are included",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-022",
    category: "scope-boundaries",
    requirementName: "Exclusion justification",
    requirementCode: "Section 9.1.1",
    requirementText:
      "Document and justify any excluded sources or categories",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-023",
    category: "scope-boundaries",
    requirementName: "Scope 1 categories covered",
    requirementCode: "Section 3.3",
    requirementText:
      "Cover: fuel combustion, process emissions, fugitive emissions, and biogenic CO2",
    applicableScopes: ["scope1"],
  },
  {
    checkpointId: "GHG-024",
    category: "scope-boundaries",
    requirementName: "Scope 3 categories documented",
    requirementCode: "Section 5.3",
    requirementText:
      "Document which of 15 categories are included and provide materiality assessment",
    applicableScopes: ["scope3"],
  },

  // Quality Assurance
  {
    checkpointId: "GHG-025",
    category: "quality-assurance",
    requirementName: "Quality assurance procedures",
    requirementCode: "Section 10.1",
    requirementText:
      "Establish procedures for reviewing accuracy and completeness of data",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-026",
    category: "quality-assurance",
    requirementName: "Data verification procedures",
    requirementCode: "Section 10.1.1",
    requirementText:
      "Verify data accuracy through sampling, reconciliation, or third-party validation",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-027",
    category: "quality-assurance",
    requirementName: "Personnel training",
    requirementCode: "Section 10.2",
    requirementText:
      "Train personnel responsible for collecting and calculating emissions data",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-028",
    category: "quality-assurance",
    requirementName: "Management oversight",
    requirementCode: "Section 10.3",
    requirementText:
      "Assign responsibility for accuracy and completeness to senior management",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },

  // Documentation
  {
    checkpointId: "GHG-029",
    category: "documentation",
    requirementName: "Inventory documentation",
    requirementCode: "Section 11.1",
    requirementText:
      "Maintain comprehensive documentation of methodology, data sources, and assumptions",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-030",
    category: "documentation",
    requirementName: "Supporting records retention",
    requirementCode: "Section 11.1.1",
    requirementText:
      "Retain all supporting records for at least 3 years (or per regulation)",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-031",
    category: "documentation",
    requirementName: "Assumptions documentation",
    requirementCode: "Section 11.2",
    requirementText:
      "Document all assumptions and estimates used in calculations",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },

  // Restatements
  {
    checkpointId: "GHG-032",
    category: "restatements",
    requirementName: "Restatement policy",
    requirementCode: "Section 12.1",
    requirementText:
      "Establish policy for when prior-year emissions should be recalculated",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-033",
    category: "restatements",
    requirementName: "Restatement documentation",
    requirementCode: "Section 12.1.1",
    requirementText:
      "Document reasons for restatements and notify stakeholders of changes",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-034",
    category: "restatements",
    requirementName: "Base year restatement",
    requirementCode: "Section 12.2",
    requirementText:
      "Restate base year when material acquisitions, divestures, or methodology changes occur",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },

  // Uncertainty
  {
    checkpointId: "GHG-035",
    category: "uncertainty",
    requirementName: "Uncertainty assessment",
    requirementCode: "Section 13.1",
    requirementText:
      "Quantify uncertainty ranges for material sources and document methodology",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-036",
    category: "uncertainty",
    requirementName: "Sensitivity analysis",
    requirementCode: "Section 13.1.1",
    requirementText:
      "Perform sensitivity analysis on key assumptions and parameters",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },

  // Additional Requirements
  {
    checkpointId: "GHG-037",
    category: "documentation",
    requirementName: "Assurance readiness",
    requirementCode: "Section 14.1",
    requirementText:
      "Maintain all documentation in format suitable for third-party assurance",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-038",
    category: "data-collection",
    requirementName: "Data gap identification",
    requirementCode: "Section 6.3",
    requirementText:
      "Identify data gaps and document methods for addressing them",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-039",
    category: "calculation-methods",
    requirementName: "Biogenic emissions tracking",
    requirementCode: "Section 7.3",
    requirementText:
      "Track and separately report biogenic CO2 emissions (not in total)",
    applicableScopes: ["scope1"],
  },
  {
    checkpointId: "GHG-040",
    category: "scope-boundaries",
    requirementName: "Avoided emissions clarity",
    requirementCode: "Section 9.2",
    requirementText:
      "Do not include avoided emissions in inventory; report separately if needed",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-041",
    category: "quality-assurance",
    requirementName: "Calculation software validation",
    requirementCode: "Section 10.4",
    requirementText:
      "Validate any spreadsheets or software used for calculations",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-042",
    category: "documentation",
    requirementName: "Stakeholder communication",
    requirementCode: "Section 11.3",
    requirementText:
      "Communicate inventory methodology and results to stakeholders transparently",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-043",
    category: "emission-factors",
    requirementName: "Emission factor recency",
    requirementCode: "Section 8.2",
    requirementText:
      "Use most recent emission factors available; document justification for older factors",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-044",
    category: "scope-boundaries",
    requirementName: "Comparative analysis",
    requirementCode: "Section 9.3",
    requirementText:
      "Report year-on-year comparison and analyze material changes",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-045",
    category: "data-collection",
    requirementName: "Primary data preference",
    requirementCode: "Section 6.4",
    requirementText:
      "Prioritize primary data over secondary data for accuracy",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-046",
    category: "organizational-boundaries",
    requirementName: "Boundary changes documentation",
    requirementCode: "Section 2.2",
    requirementText:
      "Document any changes to organizational boundaries and their impact",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-047",
    category: "quality-assurance",
    requirementName: "Internal review procedures",
    requirementCode: "Section 10.5",
    requirementText:
      "Implement internal review procedures before finalizing inventory",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-048",
    category: "documentation",
    requirementName: "Change log maintenance",
    requirementCode: "Section 11.4",
    requirementText:
      "Maintain complete change log of all methodology and data modifications",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-049",
    category: "calculation-methods",
    requirementName: "Precision standards",
    requirementCode: "Section 7.4",
    requirementText:
      "Report emissions to appropriate precision (typically 0.01 tCO2e or better)",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
  {
    checkpointId: "GHG-050",
    category: "scope-boundaries",
    requirementName: "Consistency verification",
    requirementCode: "Section 9.4",
    requirementText:
      "Verify consistent application of boundaries, methods, and assumptions across years",
    applicableScopes: ["scope1", "scope2", "scope3"],
  },
];
