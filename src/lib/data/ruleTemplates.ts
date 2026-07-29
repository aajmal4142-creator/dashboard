export type RuleTemplate = {
  name: string;
  ruleType: string;
  priority: string;
  logic?: string;
  field?: string;
  min?: number;
  max?: number;
};

export const SCOPE1_RULES: RuleTemplate[] = [
  {
    name: "Scope 1 Total Validation",
    ruleType: "business",
    logic: "scope1_fuels + scope1_process = scope1_total",
    priority: "high",
  },
  {
    name: "Fuel Consumption Range",
    ruleType: "range",
    field: "fuelConsumption",
    min: 0,
    max: 1000000,
    priority: "medium",
  },
  {
    name: "Process Emissions Validation",
    ruleType: "range",
    field: "processEmissions",
    min: 0,
    max: 500000,
    priority: "medium",
  },
];

export const SCOPE2_RULES: RuleTemplate[] = [
  {
    name: "Electricity Consumption",
    ruleType: "range",
    field: "electricityConsumption",
    min: 0,
    max: 5000000,
    priority: "high",
  },
  {
    name: "Steam/Heat Consumption",
    ruleType: "range",
    field: "steamConsumption",
    min: 0,
    max: 2000000,
    priority: "medium",
  },
];

export const SCOPE3_RULES: RuleTemplate[] = [
  {
    name: "Purchase Spend Range",
    ruleType: "range",
    field: "purchaseSpend",
    min: 0,
    max: 100000000,
    priority: "medium",
  },
  {
    name: "Supplier Count Validation",
    ruleType: "range",
    field: "supplierCount",
    min: 0,
    max: 10000,
    priority: "low",
  },
];

export function getTemplateForFramework(framework: string): RuleTemplate[] {
  switch (framework) {
    case "scope1":
      return SCOPE1_RULES;
    case "scope2":
      return SCOPE2_RULES;
    case "scope3":
      return SCOPE3_RULES;
    default:
      return [];
  }
}

export function applyRuleTemplate(
  _orgId: string,
  framework: string,
): { ruleName: string; ruleType: string; priority: string }[] {
  const rules = getTemplateForFramework(framework);
  return rules.map((r) => ({
    ruleName: r.name,
    ruleType: r.ruleType,
    priority: r.priority,
  }));
}
