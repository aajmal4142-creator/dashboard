import {
  isSpendLedgerCategory,
  type SpendLedgerCategory,
} from "@/lib/calc/spendBasedEmissions";

import type {
  CategoryMapping,
  CategoryMappingEntry,
  DiscoveredAccount,
  GhgScope,
} from "./types";

/** Preset keyword → emissions mapping (Fuel→S1, Electricity→S2, services→S3). */
const KEYWORD_PRESETS: Array<{
  pattern: RegExp;
  entry: CategoryMappingEntry;
}> = [
  {
    pattern: /\b(fuel|petrol|diesel|gasoline|natural\s*gas|cng|lpg)\b/i,
    entry: { category: "fuel_energy", scope: "1", label: "Fuel / combustion" },
  },
  {
    pattern: /\b(electricity|power|utilities?|grid)\b/i,
    entry: { category: "fuel_energy", scope: "2", label: "Electricity / utilities" },
  },
  {
    pattern: /\b(travel|airfare|hotel|lodging|mileage)\b/i,
    entry: { category: "services", scope: "3", label: "Business travel" },
  },
  {
    pattern: /\b(freight|shipping|courier|logistics|transport)\b/i,
    entry: { category: "transportation", scope: "3", label: "Transportation" },
  },
  {
    pattern: /\b(waste|disposal|recycling)\b/i,
    entry: { category: "waste", scope: "3", label: "Waste" },
  },
  {
    pattern: /\b(packaging|carton|pallet)\b/i,
    entry: { category: "packaging", scope: "3", label: "Packaging" },
  },
  {
    pattern: /\b(raw\s*material|inventory|supplies|procurement)\b/i,
    entry: { category: "raw_materials", scope: "3", label: "Raw materials" },
  },
  {
    pattern: /\b(software|saas|it\b|cloud|hardware|computer)\b/i,
    entry: { category: "it", scope: "3", label: "IT & software" },
  },
  {
    pattern: /\b(rent|lease|facility|office|building|facility)\b/i,
    entry: { category: "facilities", scope: "3", label: "Facilities" },
  },
  {
    pattern: /\b(vendor|professional|consulting|service)\b/i,
    entry: { category: "services", scope: "3", label: "Vendor services" },
  },
];

/** Common GL / account codes used across Xero, QB, and Wave sandboxes. */
export const DEFAULT_ACCOUNT_MAPPINGS: CategoryMapping = {
  "6100": { category: "fuel_energy", scope: "2", label: "Electricity" },
  "6110": { category: "fuel_energy", scope: "1", label: "Fuel" },
  "6200": { category: "transportation", scope: "3", label: "Travel / freight" },
  "6300": { category: "services", scope: "3", label: "Vendor services" },
  "6400": { category: "facilities", scope: "3", label: "Facilities / rent" },
  "6500": { category: "it", scope: "3", label: "IT & software" },
  "6600": { category: "waste", scope: "3", label: "Waste disposal" },
  "6700": { category: "packaging", scope: "3", label: "Packaging" },
  "6800": { category: "raw_materials", scope: "3", label: "Raw materials" },
  Fuel: { category: "fuel_energy", scope: "1", label: "Fuel" },
  Electricity: { category: "fuel_energy", scope: "2", label: "Electricity" },
  Travel: { category: "transportation", scope: "3", label: "Travel" },
  "Office Supplies": { category: "facilities", scope: "3", label: "Office supplies" },
  "Professional Services": {
    category: "services",
    scope: "3",
    label: "Professional services",
  },
};

export const UNMATCHED_MAPPING: CategoryMappingEntry = {
  category: "other",
  scope: "3",
  label: "Other (unmatched)",
};

/**
 * Resolve an account code/name to a category mapping.
 * Priority: exact code override → exact name override → keyword preset → unmatched.
 */
export function resolveAccountMapping(
  account: { code: string; name: string },
  overrides: CategoryMapping = {},
): CategoryMappingEntry {
  const codeKey = account.code.trim();
  const nameKey = account.name.trim();

  if (codeKey && overrides[codeKey]) return overrides[codeKey];
  if (nameKey && overrides[nameKey]) return overrides[nameKey];
  if (codeKey && DEFAULT_ACCOUNT_MAPPINGS[codeKey]) {
    return DEFAULT_ACCOUNT_MAPPINGS[codeKey];
  }
  if (nameKey && DEFAULT_ACCOUNT_MAPPINGS[nameKey]) {
    return DEFAULT_ACCOUNT_MAPPINGS[nameKey];
  }

  const haystack = `${account.code} ${account.name}`;
  for (const preset of KEYWORD_PRESETS) {
    if (preset.pattern.test(haystack)) return preset.entry;
  }

  return { ...UNMATCHED_MAPPING };
}

/** Convert accounting "other" into a spend-ledger category for persistence. */
export function toSpendLedgerCategory(
  category: SpendLedgerCategory | "other",
): SpendLedgerCategory {
  if (category === "other") return "services";
  return category;
}

export function isCategoryMappingEntry(value: unknown): value is CategoryMappingEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as { category?: unknown; scope?: unknown };
  const cat = v.category;
  const scope = v.scope;
  const catOk =
    cat === "other" || (typeof cat === "string" && isSpendLedgerCategory(cat));
  const scopeOk = scope === "1" || scope === "2" || scope === "3";
  return catOk && scopeOk;
}

/** Parse stored JSON mapping; ignore malformed entries. */
export function parseCategoryMapping(raw: unknown): CategoryMapping {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CategoryMapping = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.trim()) continue;
    if (isCategoryMappingEntry(value)) {
      out[key] = value;
      continue;
    }
    // Legacy shape: { travel: "6200" } or { "6200": "travel" }
    if (typeof value === "string") {
      const asCat = value
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
      if (asCat === "other" || isSpendLedgerCategory(asCat)) {
        out[key] = {
          category: asCat as SpendLedgerCategory | "other",
          scope: defaultScopeForCategory(asCat as SpendLedgerCategory | "other"),
        };
      } else if (isSpendLedgerCategory(key) || key === "other") {
        // Inverted legacy: category → gl code
        out[value] = {
          category: key as SpendLedgerCategory | "other",
          scope: defaultScopeForCategory(key as SpendLedgerCategory | "other"),
        };
      }
    }
  }
  return out;
}

export function defaultScopeForCategory(
  category: SpendLedgerCategory | "other",
): GhgScope {
  if (category === "fuel_energy") return "1";
  if (category === "other") return "3";
  return "3";
}

/**
 * Seed wizard rows from discovered accounts using presets + existing overrides.
 */
export function buildMappingWizardRows(
  accounts: DiscoveredAccount[],
  overrides: CategoryMapping = {},
): Array<DiscoveredAccount & { mapping: CategoryMappingEntry; isOverride: boolean }> {
  return accounts.map((account) => {
    const hasOverride = Boolean(
      overrides[account.code.trim()] || overrides[account.name.trim()],
    );
    return {
      ...account,
      mapping: resolveAccountMapping(account, overrides),
      isOverride: hasOverride,
    };
  });
}

export function mergeMappingOverride(
  current: CategoryMapping,
  accountCode: string,
  entry: CategoryMappingEntry,
): CategoryMapping {
  return { ...current, [accountCode]: entry };
}
