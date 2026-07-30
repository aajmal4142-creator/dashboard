/**
 * Pure spend-based emissions math. Zero I/O — factors are injected by the caller.
 * Missing / invalid factor → throw (never silent fallback).
 */

export type SpendEmissionsInput = {
  category: string;
  totalSpend: number;
  currency: string;
  glCodeRange?: string[];
  industryCode?: string;
  region?: string;
  periodStart?: string;
  periodEnd?: string;
  subcategory?: string;
};

export type SpendFactor = {
  value: number;
  confidence: "low" | "medium" | "high";
  uncertainty: number;
  source: string;
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
  region?: string;
  quality: "estimated";
};

export type SpendAggregateRecord = {
  category: string;
  calculatedEmissions: number;
  emissionsFactorSource: string;
};

export type SpendAggregateResult = {
  totalEmissions: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
};

export type SpendImportRow = SpendEmissionsInput & {
  rowNumber: number;
  glCode?: string;
};

export type SpendImportValidationError = {
  rowNumber: number;
  field: string;
  value: unknown;
  error: string;
};

export type SpendImportParseResult = {
  valid: boolean;
  rows: SpendImportRow[];
  errors: SpendImportValidationError[];
};

/** Spend ledger categories stored on spend-based-emissions. */
export const SPEND_LEDGER_CATEGORIES = [
  "raw_materials",
  "packaging",
  "fuel_energy",
  "waste",
  "services",
  "transportation",
  "facilities",
  "it",
] as const;

export type SpendLedgerCategory = (typeof SPEND_LEDGER_CATEGORIES)[number];

const VALID_CURRENCIES = ["USD", "EUR", "GBP", "INR"] as const;

/** Factor-registry category aliases → ledger category. */
const FACTOR_CATEGORY_TO_LEDGER: Record<string, SpendLedgerCategory> = {
  energy: "fuel_energy",
  transport: "transportation",
  water: "facilities",
  waste: "waste",
  procurement: "raw_materials",
  manufacturing: "raw_materials",
  travel: "services",
  commuting: "services",
  raw_materials: "raw_materials",
  packaging: "packaging",
  fuel_energy: "fuel_energy",
  services: "services",
  transportation: "transportation",
  facilities: "facilities",
  it: "it",
};

/** Ledger category → preferred factor-registry lookup keys (ordered). */
const LEDGER_TO_FACTOR_CATEGORIES: Record<SpendLedgerCategory, string[]> = {
  raw_materials: ["raw_materials", "procurement", "manufacturing"],
  packaging: ["packaging", "procurement"],
  fuel_energy: ["fuel_energy", "energy"],
  waste: ["waste"],
  services: ["services", "travel", "commuting"],
  transportation: ["transportation", "transport"],
  facilities: ["facilities", "water"],
  it: ["it", "procurement", "services"],
};

/**
 * GL account prefix → spend ledger category (USEEIO-style mapping defaults).
 * Callers may override via injected maps; this table is the default wizard seed.
 */
const DEFAULT_GL_PREFIX_MAP: Array<{ prefix: string; category: SpendLedgerCategory }> = [
  { prefix: "5", category: "raw_materials" },
  { prefix: "51", category: "raw_materials" },
  { prefix: "52", category: "packaging" },
  { prefix: "53", category: "fuel_energy" },
  { prefix: "54", category: "waste" },
  { prefix: "55", category: "services" },
  { prefix: "56", category: "transportation" },
  { prefix: "57", category: "facilities" },
  { prefix: "58", category: "it" },
  { prefix: "6100", category: "fuel_energy" },
  { prefix: "6200", category: "transportation" },
  { prefix: "6300", category: "services" },
  { prefix: "6400", category: "facilities" },
  { prefix: "6500", category: "it" },
  { prefix: "6600", category: "waste" },
  { prefix: "6700", category: "packaging" },
  { prefix: "6800", category: "raw_materials" },
];

function assertSpendFactor(factor: SpendFactor, category: string): void {
  if (!Number.isFinite(factor.value)) {
    throw new Error(`Invalid emissions factor value for category: ${category}`);
  }
  if (factor.value < 0) {
    throw new Error(`Emissions factor must be non-negative for category: ${category}`);
  }
  if (!factor.source) {
    throw new Error(`Emissions factor source is required for category: ${category}`);
  }
  if (
    !Number.isFinite(factor.uncertainty) ||
    factor.uncertainty < 0 ||
    factor.uncertainty > 100
  ) {
    throw new Error(`Uncertainty must be 0–100 for category: ${category}`);
  }
}

function demoteConfidence(
  confidence: SpendFactor["confidence"],
): SpendFactor["confidence"] {
  if (confidence === "high") return "medium";
  if (confidence === "medium") return "low";
  return "low";
}

export function isSpendLedgerCategory(value: string): value is SpendLedgerCategory {
  return (SPEND_LEDGER_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Normalise CSV / API category strings to a ledger category.
 * Throws when the category cannot be mapped.
 */
export function mapToSpendLedgerCategory(category: string): SpendLedgerCategory {
  const key = category
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Record<string, SpendLedgerCategory> = {
    ...FACTOR_CATEGORY_TO_LEDGER,
    energy: "fuel_energy",
    fuel: "fuel_energy",
    transport: "transportation",
    procurement: "raw_materials",
    manufacturing: "raw_materials",
    travel: "services",
    commuting: "services",
    water: "facilities",
  };
  const mapped = aliases[key];
  if (!mapped) {
    throw new Error(
      `Unknown spend category: ${category}. Allowed: ${SPEND_LEDGER_CATEGORIES.join(", ")}`,
    );
  }
  return mapped;
}

/** Ordered factor-registry category keys to try for a ledger category. */
export function factorLookupKeysForLedger(ledger: SpendLedgerCategory): string[] {
  return LEDGER_TO_FACTOR_CATEGORIES[ledger];
}

/**
 * Map a GL account code to a spend ledger category using prefix rules.
 * Longest matching prefix wins. Throws when no rule matches.
 */
export function mapGlCodeToCategory(
  glCode: string,
  rules: Array<{ prefix: string; category: SpendLedgerCategory }> = DEFAULT_GL_PREFIX_MAP,
): SpendLedgerCategory {
  const code = glCode.trim();
  if (!code) {
    throw new Error("GL code is required for category mapping");
  }

  const sorted = [...rules].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sorted) {
    if (code.startsWith(rule.prefix)) {
      return rule.category;
    }
  }

  throw new Error(`No GL mapping for account code: ${glCode}`);
}

export function defaultGlPrefixMap(): Array<{
  prefix: string;
  category: SpendLedgerCategory;
}> {
  return DEFAULT_GL_PREFIX_MAP.map((r) => ({ ...r }));
}

/**
 * Apply a regional multiplier to a base (usually Global) factor.
 * Multiplier must be injected by the caller — never invents region coefficients.
 * Adjusting away from 1.0 demotes confidence and bumps uncertainty.
 */
export function applyRegionalAdjustment(
  factor: SpendFactor,
  opts: { multiplier: number; region: string },
): SpendFactor {
  if (!Number.isFinite(opts.multiplier) || opts.multiplier <= 0) {
    throw new Error(`Invalid regional multiplier for region: ${opts.region}`);
  }
  if (!opts.region) {
    throw new Error("Region is required for regional adjustment");
  }

  assertSpendFactor(factor, opts.region);

  if (opts.multiplier === 1) {
    return { ...factor, region: opts.region };
  }

  const adjustedUncertainty = Math.min(100, factor.uncertainty + 10);

  return {
    value: Math.round(factor.value * opts.multiplier * 1_000_000) / 1_000_000,
    confidence: demoteConfidence(factor.confidence),
    uncertainty: adjustedUncertainty,
    source: factor.source,
    region: opts.region,
  };
}

/**
 * emissions_kg = totalSpend × factor.value (kg CO2e per currency unit).
 */
export function calculateSpendBasedEmissions(
  input: SpendEmissionsInput,
  factor: SpendFactor,
): SpendEmissionsResult {
  assertSpendFactor(factor, input.category);

  const calculatedEmissions = input.totalSpend * factor.value;

  return {
    category: input.category,
    totalSpend: input.totalSpend,
    emissionsFactor: factor.value,
    calculatedEmissions: Math.round(calculatedEmissions * 100) / 100,
    confidence: factor.confidence,
    uncertainty: factor.uncertainty,
    factorSource: factor.source,
    region: factor.region ?? input.region,
    quality: "estimated",
  };
}

export function calculateSpendBatchEmissions(
  items: Array<{ input: SpendEmissionsInput; factor: SpendFactor }>,
): SpendEmissionsResult[] {
  const results: SpendEmissionsResult[] = [];

  for (const item of items) {
    results.push(calculateSpendBasedEmissions(item.input, item.factor));
  }

  return results;
}

export function aggregateSpendEmissions(
  records: SpendAggregateRecord[],
): SpendAggregateResult {
  const byCategory: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalEmissions = 0;

  for (const record of records) {
    const emissions = record.calculatedEmissions;
    totalEmissions += emissions;
    byCategory[record.category] = (byCategory[record.category] || 0) + emissions;
    bySource[record.emissionsFactorSource] =
      (bySource[record.emissionsFactorSource] || 0) + emissions;
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
  else {
    try {
      mapToSpendLedgerCategory(spend.category);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Invalid category");
    }
  }
  if (!spend.totalSpend || spend.totalSpend <= 0) {
    errors.push("Total spend must be greater than 0");
  }
  if (!spend.currency) errors.push("Currency is required");

  if (
    spend.currency &&
    !(VALID_CURRENCIES as readonly string[]).includes(spend.currency)
  ) {
    errors.push(`Currency must be one of: ${VALID_CURRENCIES.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function headerIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[\s-]+/g, "_"));
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse and validate a spend CSV batch.
 * Required columns: category (or gl_code), total_spend, currency.
 * Optional: region, period_start, period_end, industry_code, subcategory, gl_code.
 */
export function parseSpendImportCsv(csvContent: string): SpendImportParseResult {
  const lines = csvContent
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      valid: false,
      rows: [],
      errors: [
        {
          rowNumber: 1,
          field: "csv",
          value: "",
          error: "CSV must include a header row and at least one data row",
        },
      ],
    };
  }

  const headers = splitCsvLine(lines[0]!);
  const col = {
    category: headerIndex(headers, ["category", "spend_category"]),
    totalSpend: headerIndex(headers, ["total_spend", "spend", "amount", "totalspend"]),
    currency: headerIndex(headers, ["currency", "ccy"]),
    region: headerIndex(headers, ["region", "geo", "country"]),
    glCode: headerIndex(headers, ["gl_code", "glcode", "account_code", "account"]),
    periodStart: headerIndex(headers, ["period_start", "periodstart", "start"]),
    periodEnd: headerIndex(headers, ["period_end", "periodend", "end"]),
    industryCode: headerIndex(headers, ["industry_code", "naics", "industry"]),
    subcategory: headerIndex(headers, ["subcategory", "sub_category"]),
  };

  if (col.totalSpend < 0) {
    return {
      valid: false,
      rows: [],
      errors: [
        {
          rowNumber: 1,
          field: "total_spend",
          value: null,
          error: "Missing required column: total_spend",
        },
      ],
    };
  }
  if (col.currency < 0) {
    return {
      valid: false,
      rows: [],
      errors: [
        {
          rowNumber: 1,
          field: "currency",
          value: null,
          error: "Missing required column: currency",
        },
      ],
    };
  }
  if (col.category < 0 && col.glCode < 0) {
    return {
      valid: false,
      rows: [],
      errors: [
        {
          rowNumber: 1,
          field: "category",
          value: null,
          error: "CSV must include category or gl_code",
        },
      ],
    };
  }

  const rows: SpendImportRow[] = [];
  const errors: SpendImportValidationError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cells = splitCsvLine(lines[i]!);
    const cell = (idx: number): string => (idx >= 0 ? (cells[idx] ?? "").trim() : "");

    const totalSpendRaw = cell(col.totalSpend);
    const totalSpend = Number(totalSpendRaw);
    const currency = cell(col.currency).toUpperCase();
    const glCode = cell(col.glCode) || undefined;
    const region = cell(col.region) || undefined;
    const periodStart = cell(col.periodStart) || undefined;
    const periodEnd = cell(col.periodEnd) || undefined;
    const industryCode = cell(col.industryCode) || undefined;
    const subcategory = cell(col.subcategory) || undefined;

    let category = cell(col.category);

    if (!category && glCode) {
      try {
        category = mapGlCodeToCategory(glCode);
      } catch (err) {
        errors.push({
          rowNumber,
          field: "gl_code",
          value: glCode,
          error: err instanceof Error ? err.message : "GL mapping failed",
        });
        continue;
      }
    }

    const input: SpendEmissionsInput = {
      category,
      totalSpend,
      currency,
      region,
      periodStart,
      periodEnd,
      industryCode,
      subcategory,
      glCodeRange: glCode ? [glCode] : undefined,
    };

    const validation = validateSpendData(input);
    if (!validation.valid) {
      for (const msg of validation.errors) {
        errors.push({
          rowNumber,
          field: "row",
          value: totalSpendRaw,
          error: msg,
        });
      }
      continue;
    }

    try {
      const ledger = mapToSpendLedgerCategory(category);
      rows.push({
        ...input,
        category: ledger,
        rowNumber,
        glCode,
      });
    } catch (err) {
      errors.push({
        rowNumber,
        field: "category",
        value: category,
        error: err instanceof Error ? err.message : "Invalid category",
      });
    }
  }

  return {
    valid: errors.length === 0,
    rows,
    errors,
  };
}
