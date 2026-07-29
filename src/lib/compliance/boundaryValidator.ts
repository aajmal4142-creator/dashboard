export interface BoundaryDefinition {
  organizationalApproach: "equity-share" | "financial-control" | "operational-control";
  operationalScope: ("scope1" | "scope2" | "scope3")[];
  includedEntities: string[];
  excludedEntities: string[];
  excludedReasons: Record<string, string>;
  scope1Sources: string[];
  scope2Sources: string[];
  scope3Categories: string[];
}

export interface BoundaryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateBoundary(boundary: BoundaryDefinition): BoundaryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate organizational approach
  if (!boundary.organizationalApproach) {
    errors.push("Organizational approach must be specified (equity-share, financial-control, or operational-control)");
  }

  // Validate operational scope
  if (!boundary.operationalScope || boundary.operationalScope.length === 0) {
    errors.push("At least one operational scope (Scope 1, 2, or 3) must be defined");
  }

  // Validate entities
  if (!boundary.includedEntities || boundary.includedEntities.length === 0) {
    errors.push("At least one entity must be included in the boundary");
  }

  if (boundary.includedEntities && boundary.excludedEntities) {
    const overlap = boundary.includedEntities.filter(e =>
      boundary.excludedEntities.includes(e)
    );
    if (overlap.length > 0) {
      errors.push(`Entities cannot be both included and excluded: ${overlap.join(", ")}`);
    }
  }

  // Validate Scope 1 if included
  if (boundary.operationalScope.includes("scope1")) {
    if (!boundary.scope1Sources || boundary.scope1Sources.length === 0) {
      warnings.push("Scope 1 is included but no sources are defined");
    }
    const validScope1Sources = [
      "stationary-combustion",
      "mobile-combustion",
      "process-emissions",
      "fugitive-emissions",
      "biogenic-co2",
    ];
    const invalidSources = (boundary.scope1Sources || []).filter(
      s => !validScope1Sources.includes(s)
    );
    if (invalidSources.length > 0) {
      warnings.push(`Invalid Scope 1 sources: ${invalidSources.join(", ")}`);
    }
  }

  // Validate Scope 2 if included
  if (boundary.operationalScope.includes("scope2")) {
    if (!boundary.scope2Sources || boundary.scope2Sources.length === 0) {
      warnings.push("Scope 2 is included but no sources are defined");
    }
    const validScope2Sources = [
      "purchased-electricity",
      "purchased-steam",
      "purchased-cooling",
      "purchased-heating",
    ];
    const invalidSources = (boundary.scope2Sources || []).filter(
      s => !validScope2Sources.includes(s)
    );
    if (invalidSources.length > 0) {
      warnings.push(`Invalid Scope 2 sources: ${invalidSources.join(", ")}`);
    }
  }

  // Validate Scope 3 if included
  if (boundary.operationalScope.includes("scope3")) {
    if (!boundary.scope3Categories || boundary.scope3Categories.length === 0) {
      warnings.push("Scope 3 is included but no categories are defined");
    }
    const validScope3Categories = [
      "purchased-goods-services",
      "capital-goods",
      "upstream-transportation",
      "waste-in-operations",
      "business-travel",
      "employee-commuting",
      "upstream-leased-assets",
      "downstream-transportation",
      "processing-sold-products",
      "use-sold-products",
      "end-life-sold-products",
      "downstream-leased-assets",
      "franchises",
      "investments",
      "other",
    ];
    const invalidCategories = (boundary.scope3Categories || []).filter(
      c => !validScope3Categories.includes(c)
    );
    if (invalidCategories.length > 0) {
      warnings.push(`Invalid Scope 3 categories: ${invalidCategories.join(", ")}`);
    }
  }

  // Validate exclusion reasons are documented
  if (boundary.excludedEntities && boundary.excludedEntities.length > 0) {
    boundary.excludedEntities.forEach(entity => {
      if (!boundary.excludedReasons[entity]) {
        warnings.push(`Excluded entity '${entity}' lacks documented exclusion reason`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function generateBoundaryNarrative(boundary: BoundaryDefinition): string {
  const parts: string[] = [];

  parts.push(`### Organizational Boundary\n`);
  parts.push(`The organization uses the ${formatApproach(boundary.organizationalApproach)} approach for determining organizational boundaries.\n`);
  parts.push(`**Included Entities:** ${boundary.includedEntities.join(", ")}\n`);

  if (boundary.excludedEntities && boundary.excludedEntities.length > 0) {
    parts.push(`\n**Excluded Entities:**`);
    boundary.excludedEntities.forEach(entity => {
      const reason = boundary.excludedReasons[entity] || "Not specified";
      parts.push(`- ${entity}: ${reason}`);
    });
    parts.push("");
  }

  parts.push(`\n### Operational Boundary\n`);
  if (boundary.operationalScope.includes("scope1")) {
    parts.push(`**Scope 1 Sources:** ${boundary.scope1Sources?.join(", ") || "Not specified"}`);
  }
  if (boundary.operationalScope.includes("scope2")) {
    parts.push(`**Scope 2 Sources:** ${boundary.scope2Sources?.join(", ") || "Not specified"}`);
  }
  if (boundary.operationalScope.includes("scope3")) {
    parts.push(`**Scope 3 Categories:** ${boundary.scope3Categories?.join(", ") || "Not specified"}`);
  }

  return parts.join("\n");
}

function formatApproach(approach: string): string {
  const map: Record<string, string> = {
    "equity-share": "Equity Share",
    "financial-control": "Financial Control",
    "operational-control": "Operational Control",
  };
  return map[approach] || approach;
}
