/**
 * F33 — Industry template marketplace (free starters only).
 * Pure catalog + apply helpers. Zero I/O.
 */

export type MarketplaceIndustry =
  "retail" | "manufacturing" | "finance" | "services" | "logistics" | "energy";

export type MarketplaceKind = "questionnaire" | "report_pack" | "metric_set";

export type MarketplaceFramework = "csrd" | "brsr" | "gri" | "sasb" | "custom";

export type MarketplaceSection = {
  sectionTitle: string;
  sectionKey: string;
  sectionType: "questions" | "calculations" | "narrative" | "text" | "table" | "chart";
  order: number;
};

export type MarketplaceQuestion = {
  questionId: string;
  sectionKey: string;
  label: string;
  prompt: string;
  answerType: "text" | "number" | "boolean" | "select";
  unit?: string;
  required: boolean;
  order: number;
};

export type MarketplaceCalculation = {
  calcId: string;
  label: string;
  op: "sum" | "product" | "ratio" | "difference";
  inputs: string[];
  unit?: string;
  sectionKey?: string;
};

export type MarketplaceTemplate = {
  key: string;
  name: string;
  description: string;
  industry: MarketplaceIndustry;
  kind: MarketplaceKind;
  framework: MarketplaceFramework;
  tags: string[];
  sections: MarketplaceSection[];
  questions: MarketplaceQuestion[];
  calculations: MarketplaceCalculation[];
  /** Metric keys for metric_set packs (and optional extras on other kinds). */
  metricKeys: string[];
};

export type MarketplaceListItem = {
  key: string;
  name: string;
  description: string;
  industry: MarketplaceIndustry;
  kind: MarketplaceKind;
  framework: MarketplaceFramework;
  tags: string[];
  questionCount: number;
  calculationCount: number;
  metricCount: number;
  sectionCount: number;
};

export type MarketplaceFilter = {
  q?: string;
  industry?: MarketplaceIndustry | "all";
  kind?: MarketplaceKind | "all";
};

export type AppliedMarketplaceEntry = {
  templateKey: string;
  templateName: string;
  kind: MarketplaceKind;
  industry: MarketplaceIndustry;
  reportTemplateId: string;
  appliedAt: string;
  appliedBy: string | null;
};

export type OrgTemplateCreateData = {
  organisation: string;
  templateName: string;
  description: string;
  purpose: "report" | "compliance";
  industry: MarketplaceIndustry;
  framework: MarketplaceFramework;
  type: "pdf" | "json";
  isPublic: false;
  version: 1;
  createdBy: string | null;
  sections: Array<{
    sectionTitle: string;
    sectionKey: string;
    sectionType: MarketplaceSection["sectionType"];
    order: number;
  }>;
  questions: Array<{
    questionId: string;
    sectionKey: string;
    label: string;
    prompt: string;
    answerType: MarketplaceQuestion["answerType"];
    unit?: string;
    required: boolean;
    order: number;
  }>;
  calculations: Array<{
    calcId: string;
    label: string;
    op: MarketplaceCalculation["op"];
    inputs: string[];
    unit?: string;
    sectionKey?: string;
  }>;
  templateConfig: {
    marketplaceKey: string;
    marketplaceKind: MarketplaceKind;
    metricKeys: string[];
  };
};

export const MARKETPLACE_INDUSTRIES: MarketplaceIndustry[] = [
  "retail",
  "manufacturing",
  "finance",
  "services",
  "logistics",
  "energy",
];

export const MARKETPLACE_KINDS: MarketplaceKind[] = [
  "questionnaire",
  "report_pack",
  "metric_set",
];

export const MARKETPLACE_INDUSTRY_LABELS: Record<MarketplaceIndustry, string> = {
  retail: "Retail",
  manufacturing: "Manufacturing",
  finance: "Finance",
  services: "Services",
  logistics: "Logistics",
  energy: "Energy",
};

export const MARKETPLACE_KIND_LABELS: Record<MarketplaceKind, string> = {
  questionnaire: "Questionnaire",
  report_pack: "Report pack",
  metric_set: "Metric set",
};

/** Free industry starter catalog — static, no paid content, no AI generation. */
export const MARKETPLACE_TEMPLATES: MarketplaceTemplate[] = [
  {
    key: "retail_ops_questionnaire",
    name: "Retail operations questionnaire",
    description:
      "Store energy, logistics, and purchased-goods Scope 3 starters for retail operators.",
    industry: "retail",
    kind: "questionnaire",
    framework: "gri",
    tags: ["scope3", "stores", "retail"],
    sections: [
      {
        sectionTitle: "Stores & logistics",
        sectionKey: "ops",
        sectionType: "questions",
        order: 1,
      },
      {
        sectionTitle: "Value chain",
        sectionKey: "value_chain",
        sectionType: "questions",
        order: 2,
      },
      {
        sectionTitle: "Totals",
        sectionKey: "totals",
        sectionType: "calculations",
        order: 3,
      },
    ],
    questions: [
      {
        questionId: "ret-store-energy",
        sectionKey: "ops",
        label: "Store electricity",
        prompt: "Electricity across stores (MWh).",
        answerType: "number",
        unit: "MWh",
        required: true,
        order: 1,
      },
      {
        questionId: "ret-logistics",
        sectionKey: "ops",
        label: "Logistics emissions",
        prompt: "Outbound logistics GHG (tCO₂e).",
        answerType: "number",
        unit: "tCO₂e",
        required: true,
        order: 2,
      },
      {
        questionId: "ret-stores",
        sectionKey: "ops",
        label: "Store count",
        prompt: "Number of stores in reporting boundary.",
        answerType: "number",
        unit: "stores",
        required: true,
        order: 3,
      },
      {
        questionId: "ret-purchased",
        sectionKey: "value_chain",
        label: "Purchased goods (Cat. 1)",
        prompt: "Estimated Scope 3 Category 1 emissions (tCO₂e).",
        answerType: "number",
        unit: "tCO₂e",
        required: true,
        order: 1,
      },
    ],
    calculations: [
      {
        calcId: "ret-scope3-partial",
        label: "Partial Scope 3 (logistics + purchased goods)",
        op: "sum",
        inputs: ["ret-logistics", "ret-purchased"],
        unit: "tCO₂e",
        sectionKey: "totals",
      },
      {
        calcId: "ret-energy-per-store",
        label: "Electricity per store",
        op: "ratio",
        inputs: ["ret-store-energy", "ret-stores"],
        unit: "MWh / store",
        sectionKey: "totals",
      },
    ],
    metricKeys: ["electricity_kwh", "supplier_spend_total"],
  },
  {
    key: "manufacturing_process_questionnaire",
    name: "Manufacturing process questionnaire",
    description: "Process energy, scrap, and product intensity for manufacturing sites.",
    industry: "manufacturing",
    kind: "questionnaire",
    framework: "gri",
    tags: ["energy", "intensity", "manufacturing"],
    sections: [
      {
        sectionTitle: "Energy & process",
        sectionKey: "energy",
        sectionType: "questions",
        order: 1,
      },
      {
        sectionTitle: "Material efficiency",
        sectionKey: "materials",
        sectionType: "questions",
        order: 2,
      },
      {
        sectionTitle: "Derived metrics",
        sectionKey: "derived",
        sectionType: "calculations",
        order: 3,
      },
    ],
    questions: [
      {
        questionId: "mfg-electricity",
        sectionKey: "energy",
        label: "Purchased electricity",
        prompt: "Electricity consumed (MWh).",
        answerType: "number",
        unit: "MWh",
        required: true,
        order: 1,
      },
      {
        questionId: "mfg-fuel",
        sectionKey: "energy",
        label: "On-site fuel",
        prompt: "On-site fuel energy (MWh equivalent).",
        answerType: "number",
        unit: "MWh",
        required: true,
        order: 2,
      },
      {
        questionId: "mfg-process",
        sectionKey: "energy",
        label: "Process emissions",
        prompt: "Process GHG emissions (tCO₂e).",
        answerType: "number",
        unit: "tCO₂e",
        required: true,
        order: 3,
      },
      {
        questionId: "mfg-output",
        sectionKey: "materials",
        label: "Finished goods output",
        prompt: "Units of finished product shipped.",
        answerType: "number",
        unit: "units",
        required: true,
        order: 1,
      },
    ],
    calculations: [
      {
        calcId: "mfg-energy-total",
        label: "Total site energy",
        op: "sum",
        inputs: ["mfg-electricity", "mfg-fuel"],
        unit: "MWh",
        sectionKey: "derived",
      },
      {
        calcId: "mfg-energy-intensity",
        label: "Energy intensity",
        op: "ratio",
        inputs: ["mfg-energy-total", "mfg-output"],
        unit: "MWh / unit",
        sectionKey: "derived",
      },
    ],
    metricKeys: ["electricity_kwh", "diesel_litres", "natural_gas_m3"],
  },
  {
    key: "finance_portfolio_questionnaire",
    name: "Finance portfolio questionnaire",
    description:
      "Financed emissions coverage, exclusions, and portfolio intensity for financial institutions.",
    industry: "finance",
    kind: "questionnaire",
    framework: "custom",
    tags: ["financed-emissions", "portfolio", "finance"],
    sections: [
      {
        sectionTitle: "Portfolio",
        sectionKey: "portfolio",
        sectionType: "questions",
        order: 1,
      },
      {
        sectionTitle: "Governance",
        sectionKey: "governance",
        sectionType: "questions",
        order: 2,
      },
      {
        sectionTitle: "Coverage metrics",
        sectionKey: "coverage",
        sectionType: "calculations",
        order: 3,
      },
    ],
    questions: [
      {
        questionId: "fin-aum",
        sectionKey: "portfolio",
        label: "Assets under management",
        prompt: "Total AUM in scope (million currency units).",
        answerType: "number",
        unit: "mn",
        required: true,
        order: 1,
      },
      {
        questionId: "fin-covered",
        sectionKey: "portfolio",
        label: "AUM with financed emissions",
        prompt: "AUM for which financed emissions are calculated (million).",
        answerType: "number",
        unit: "mn",
        required: true,
        order: 2,
      },
      {
        questionId: "fin-financed",
        sectionKey: "portfolio",
        label: "Financed emissions",
        prompt: "Absolute financed emissions (tCO₂e).",
        answerType: "number",
        unit: "tCO₂e",
        required: true,
        order: 3,
      },
      {
        questionId: "fin-exclusions",
        sectionKey: "governance",
        label: "Sector exclusions",
        prompt: "List climate-related sector exclusions or screens applied.",
        answerType: "text",
        required: true,
        order: 1,
      },
    ],
    calculations: [
      {
        calcId: "fin-coverage",
        label: "Financed-emissions coverage",
        op: "ratio",
        inputs: ["fin-covered", "fin-aum"],
        unit: "ratio",
        sectionKey: "coverage",
      },
      {
        calcId: "fin-intensity",
        label: "Portfolio intensity",
        op: "ratio",
        inputs: ["fin-financed", "fin-covered"],
        unit: "tCO₂e / mn AUM",
        sectionKey: "coverage",
      },
    ],
    metricKeys: ["employees_total", "board_independent"],
  },
  {
    key: "services_metric_set",
    name: "Professional services metric set",
    description:
      "Core office energy, travel, and workforce metrics for IT and professional services.",
    industry: "services",
    kind: "metric_set",
    framework: "gri",
    tags: ["office", "travel", "services"],
    sections: [
      {
        sectionTitle: "Priority metrics",
        sectionKey: "metrics",
        sectionType: "narrative",
        order: 1,
      },
    ],
    questions: [],
    calculations: [],
    metricKeys: [
      "electricity_kwh",
      "electricity_renewable_pct",
      "business_travel_km",
      "employees_total",
      "employees_women",
      "training_hours_total",
      "policy_data_privacy",
      "board_independent",
    ],
  },
  {
    key: "logistics_report_pack",
    name: "Logistics report pack",
    description:
      "Report layout sections for freight intensity, fleet fuel, and network coverage.",
    industry: "logistics",
    kind: "report_pack",
    framework: "gri",
    tags: ["freight", "fleet", "logistics"],
    sections: [
      {
        sectionTitle: "Executive summary",
        sectionKey: "exec",
        sectionType: "narrative",
        order: 1,
      },
      {
        sectionTitle: "Fleet & fuel",
        sectionKey: "fleet",
        sectionType: "table",
        order: 2,
      },
      {
        sectionTitle: "Network intensity",
        sectionKey: "intensity",
        sectionType: "chart",
        order: 3,
      },
      {
        sectionTitle: "Scope 3 logistics",
        sectionKey: "scope3",
        sectionType: "narrative",
        order: 4,
      },
    ],
    questions: [
      {
        questionId: "log-tkm",
        sectionKey: "fleet",
        label: "Tonne-kilometres",
        prompt: "Annual freight tonne-kilometres.",
        answerType: "number",
        unit: "tkm",
        required: true,
        order: 1,
      },
      {
        questionId: "log-fuel",
        sectionKey: "fleet",
        label: "Fleet fuel",
        prompt: "Fleet diesel / fuel consumed (litres).",
        answerType: "number",
        unit: "L",
        required: true,
        order: 2,
      },
      {
        questionId: "log-ghg",
        sectionKey: "intensity",
        label: "Logistics GHG",
        prompt: "Logistics-related GHG (tCO₂e).",
        answerType: "number",
        unit: "tCO₂e",
        required: true,
        order: 1,
      },
    ],
    calculations: [
      {
        calcId: "log-intensity",
        label: "Emissions intensity",
        op: "ratio",
        inputs: ["log-ghg", "log-tkm"],
        unit: "tCO₂e / tkm",
        sectionKey: "intensity",
      },
    ],
    metricKeys: ["diesel_litres", "petrol_litres", "business_travel_km"],
  },
  {
    key: "energy_ops_questionnaire",
    name: "Energy operations questionnaire",
    description:
      "Generation mix, methane, flaring, and intensity starters for energy operators.",
    industry: "energy",
    kind: "questionnaire",
    framework: "sasb",
    tags: ["generation", "methane", "energy"],
    sections: [
      {
        sectionTitle: "Operations",
        sectionKey: "operations",
        sectionType: "questions",
        order: 1,
      },
      {
        sectionTitle: "Methane & flaring",
        sectionKey: "methane",
        sectionType: "questions",
        order: 2,
      },
      {
        sectionTitle: "Intensity",
        sectionKey: "intensity",
        sectionType: "calculations",
        order: 3,
      },
    ],
    questions: [
      {
        questionId: "en-scope1",
        sectionKey: "operations",
        label: "Scope 1 total",
        prompt: "Report Scope 1 GHG emissions for the assessment year (tCO₂e).",
        answerType: "number",
        unit: "tCO₂e",
        required: true,
        order: 1,
      },
      {
        questionId: "en-scope2",
        sectionKey: "operations",
        label: "Scope 2 total",
        prompt: "Report Scope 2 GHG emissions (tCO₂e).",
        answerType: "number",
        unit: "tCO₂e",
        required: true,
        order: 2,
      },
      {
        questionId: "en-output",
        sectionKey: "operations",
        label: "Energy output",
        prompt: "Net energy output for the year (MWh).",
        answerType: "number",
        unit: "MWh",
        required: true,
        order: 3,
      },
      {
        questionId: "en-methane",
        sectionKey: "methane",
        label: "Methane emissions",
        prompt: "Estimate methane emissions converted to CO₂e (tCO₂e).",
        answerType: "number",
        unit: "tCO₂e",
        required: true,
        order: 1,
      },
      {
        questionId: "en-flaring",
        sectionKey: "methane",
        label: "Flaring volume",
        prompt: "Volume of gas flared (mscm), if applicable.",
        answerType: "number",
        unit: "mscm",
        required: false,
        order: 2,
      },
    ],
    calculations: [
      {
        calcId: "en-ops-total",
        label: "Operational Scope 1+2",
        op: "sum",
        inputs: ["en-scope1", "en-scope2"],
        unit: "tCO₂e",
        sectionKey: "intensity",
      },
      {
        calcId: "en-intensity",
        label: "Emissions intensity",
        op: "ratio",
        inputs: ["en-ops-total", "en-output"],
        unit: "tCO₂e / MWh",
        sectionKey: "intensity",
      },
    ],
    metricKeys: ["electricity_kwh", "natural_gas_m3", "electricity_renewable_pct"],
  },
];

export function isMarketplaceIndustry(value: unknown): value is MarketplaceIndustry {
  return (
    typeof value === "string" && (MARKETPLACE_INDUSTRIES as string[]).includes(value)
  );
}

export function isMarketplaceKind(value: unknown): value is MarketplaceKind {
  return typeof value === "string" && (MARKETPLACE_KINDS as string[]).includes(value);
}

export function getMarketplaceTemplate(key: string): MarketplaceTemplate | null {
  const trimmed = key.trim();
  if (!trimmed) return null;
  return MARKETPLACE_TEMPLATES.find((t) => t.key === trimmed) ?? null;
}

export function toMarketplaceListItem(
  template: MarketplaceTemplate,
): MarketplaceListItem {
  return {
    key: template.key,
    name: template.name,
    description: template.description,
    industry: template.industry,
    kind: template.kind,
    framework: template.framework,
    tags: [...template.tags],
    questionCount: template.questions.length,
    calculationCount: template.calculations.length,
    metricCount: template.metricKeys.length,
    sectionCount: template.sections.length,
  };
}

export function filterMarketplaceTemplates(
  filter: MarketplaceFilter = {},
): MarketplaceListItem[] {
  const q = (filter.q ?? "").trim().toLowerCase();
  const industry = filter.industry ?? "all";
  const kind = filter.kind ?? "all";

  return MARKETPLACE_TEMPLATES.filter((t) => {
    if (industry !== "all" && t.industry !== industry) return false;
    if (kind !== "all" && t.kind !== kind) return false;
    if (!q) return true;
    const hay = [
      t.name,
      t.description,
      t.industry,
      t.kind,
      t.framework,
      ...t.tags,
      ...t.metricKeys,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  }).map(toMarketplaceListItem);
}

export function parseMarketplaceSearchParams(url: URL): MarketplaceFilter {
  const q = url.searchParams.get("q") ?? undefined;
  const industryRaw = url.searchParams.get("industry");
  const kindRaw = url.searchParams.get("kind");

  const industry =
    industryRaw && industryRaw !== "all" && isMarketplaceIndustry(industryRaw)
      ? industryRaw
      : "all";
  const kind =
    kindRaw && kindRaw !== "all" && isMarketplaceKind(kindRaw) ? kindRaw : "all";

  return { q, industry, kind };
}

export function parseApplyBody(
  body: unknown,
): { ok: true; templateKey: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const record = body as Record<string, unknown>;
  const templateKey =
    typeof record.templateKey === "string"
      ? record.templateKey.trim()
      : typeof record.key === "string"
        ? record.key.trim()
        : "";
  if (!templateKey) {
    return { ok: false, error: "templateKey is required" };
  }
  if (!getMarketplaceTemplate(templateKey)) {
    return { ok: false, error: "Unknown marketplace template" };
  }
  return { ok: true, templateKey };
}

/** Unique org-owned template name — mirrors compliance template suffix pattern. */
export function orgTemplateName(baseName: string, orgId: string): string {
  const suffix = orgId.slice(-6) || "org";
  return `${baseName.trim()} [${suffix}]`;
}

export function purposeForKind(kind: MarketplaceKind): "report" | "compliance" {
  return kind === "report_pack" ? "report" : "compliance";
}

export function buildOrgTemplateCreateData(input: {
  template: MarketplaceTemplate;
  organisationId: string;
  userId: string | null;
}): OrgTemplateCreateData {
  const { template, organisationId, userId } = input;
  return {
    organisation: organisationId,
    templateName: orgTemplateName(template.name, organisationId),
    description: template.description,
    purpose: purposeForKind(template.kind),
    industry: template.industry,
    framework: template.framework,
    type: template.kind === "metric_set" ? "json" : "pdf",
    isPublic: false,
    version: 1,
    createdBy: userId,
    sections: template.sections.map((s) => ({
      sectionTitle: s.sectionTitle,
      sectionKey: s.sectionKey,
      sectionType: s.sectionType,
      order: s.order,
    })),
    questions: template.questions.map((q) => ({
      questionId: q.questionId,
      sectionKey: q.sectionKey,
      label: q.label,
      prompt: q.prompt,
      answerType: q.answerType,
      ...(q.unit ? { unit: q.unit } : {}),
      required: q.required,
      order: q.order,
    })),
    calculations: template.calculations.map((c) => ({
      calcId: c.calcId,
      label: c.label,
      op: c.op,
      inputs: [...c.inputs],
      ...(c.unit ? { unit: c.unit } : {}),
      ...(c.sectionKey ? { sectionKey: c.sectionKey } : {}),
    })),
    templateConfig: {
      marketplaceKey: template.key,
      marketplaceKind: template.kind,
      metricKeys: [...template.metricKeys],
    },
  };
}

export function buildAppliedEntry(input: {
  template: MarketplaceTemplate;
  reportTemplateId: string;
  appliedAt: string;
  appliedBy: string | null;
}): AppliedMarketplaceEntry {
  return {
    templateKey: input.template.key,
    templateName: input.template.name,
    kind: input.template.kind,
    industry: input.template.industry,
    reportTemplateId: input.reportTemplateId,
    appliedAt: input.appliedAt,
    appliedBy: input.appliedBy,
  };
}

/**
 * Append-only merge — never removes or rewrites prior applications.
 * Re-applying the same key still appends a new entry.
 */
export function appendAppliedTemplate(
  existing: AppliedMarketplaceEntry[] | null | undefined,
  entry: AppliedMarketplaceEntry,
): AppliedMarketplaceEntry[] {
  const prior = Array.isArray(existing) ? existing.map((e) => ({ ...e })) : [];
  return [...prior, { ...entry }];
}

function relationIdOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return null;
}

export function parseAppliedEntries(value: unknown): AppliedMarketplaceEntry[] {
  if (!Array.isArray(value)) return [];
  const out: AppliedMarketplaceEntry[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.templateKey !== "string" || typeof r.templateName !== "string") {
      continue;
    }
    if (!isMarketplaceKind(r.kind) || !isMarketplaceIndustry(r.industry)) continue;
    if (typeof r.reportTemplateId !== "string" || typeof r.appliedAt !== "string") {
      continue;
    }
    out.push({
      templateKey: r.templateKey,
      templateName: r.templateName,
      kind: r.kind,
      industry: r.industry,
      reportTemplateId: r.reportTemplateId,
      appliedAt: r.appliedAt,
      appliedBy: relationIdOrNull(r.appliedBy),
    });
  }
  return out;
}

export function canApplyMarketplace(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}
