import type { Where } from "payload";

import { formulaKeys } from "./formula";
import {
  CUSTOM_METRIC_CATEGORIES,
  type CustomMetricCategory,
  type CustomMetricDoc,
  type CustomMetricSource,
  type CustomMetricSummary,
} from "./customTypes";

export function orgIdFromCustomDoc(doc: CustomMetricDoc): string | null {
  const org = doc.organisation;
  if (!org) return null;
  return typeof org === "string" ? org : org.id;
}

function asCategory(v: string | null | undefined): CustomMetricCategory {
  if (v && (CUSTOM_METRIC_CATEGORIES as readonly string[]).includes(v)) {
    return v as CustomMetricCategory;
  }
  return "other";
}

function asSource(v: string | null | undefined): CustomMetricSource {
  return v === "custom" ? "custom" : "system";
}

export function mapCustomMetricDoc(doc: CustomMetricDoc): CustomMetricSummary | null {
  if (!doc.id || typeof doc.key !== "string" || typeof doc.label !== "string") {
    return null;
  }
  const formula = typeof doc.formula === "string" ? doc.formula : "";
  return {
    id: doc.id,
    key: doc.key,
    label: doc.label,
    description: typeof doc.description === "string" ? doc.description : "",
    unit: typeof doc.unit === "string" ? doc.unit : "",
    formula,
    category: asCategory(doc.category),
    enabled: doc.enabled !== false,
    usageCount: typeof doc.usageCount === "number" ? doc.usageCount : 0,
    source: asSource(doc.source),
    organisationId: orgIdFromCustomDoc(doc),
    inputKeys: formula ? formulaKeys(formula) : [],
    createdAt: doc.createdAt ?? "",
    updatedAt: doc.updatedAt ?? "",
  };
}

export function buildOrgCustomMetricsWhere(orgId: string): Where {
  return {
    and: [{ organisation: { equals: orgId } }, { source: { equals: "custom" } }],
  };
}

/** Common alias keys accepted in formulas (preview / dashboards). */
export const FORMULA_ALIAS_KEYS = [
  { key: "scope1_emissions", label: "Scope 1 emissions (alias)", unit: "tCO2e" },
  { key: "scope2_emissions", label: "Scope 2 emissions (alias)", unit: "tCO2e" },
  { key: "scope3_emissions", label: "Scope 3 emissions (alias)", unit: "tCO2e" },
  { key: "revenue", label: "Revenue (alias)", unit: null },
  { key: "headcount", label: "Headcount (alias)", unit: null },
] as const;
