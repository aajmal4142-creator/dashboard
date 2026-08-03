import type {
  ActivityDataField,
  EmissionsFactor,
  Scope3Category,
} from "@/lib/scope3/types";

export const SCOPE3_CATEGORY_LABELS: Record<Scope3Category, string> = {
  supplier: "Supplier",
  investment: "Investment",
  waste: "Waste",
  business_travel: "Business travel",
  employee_commute: "Employee commute",
};

const SCOPE3_CATEGORIES: Scope3Category[] = [
  "supplier",
  "investment",
  "waste",
  "business_travel",
  "employee_commute",
];

export function isScope3Category(value: string): value is Scope3Category {
  return (SCOPE3_CATEGORIES as string[]).includes(value);
}

export function asActivityFields(value: unknown): ActivityDataField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (field): field is ActivityDataField =>
      typeof field === "object" &&
      field !== null &&
      "name" in field &&
      typeof (field as { name: unknown }).name === "string" &&
      "unit" in field &&
      typeof (field as { unit: unknown }).unit === "string" &&
      "required" in field &&
      typeof (field as { required: unknown }).required === "boolean",
  );
}

export function asEmissionsFactor(value: unknown): EmissionsFactor | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const factor = value as Record<string, unknown>;
  if (typeof factor.value !== "number" || typeof factor.unit !== "string") {
    return null;
  }
  return {
    value: factor.value,
    unit: factor.unit,
    source: typeof factor.source === "string" ? factor.source : "Custom",
    year: typeof factor.year === "number" ? factor.year : new Date().getFullYear(),
    confidence:
      factor.confidence === "high" ||
      factor.confidence === "medium" ||
      factor.confidence === "low"
        ? factor.confidence
        : "medium",
  };
}

/** Sum numeric activity field values for factor multiplication. */
export function activityQuantitySum(data: Record<string, number>): number {
  return Object.values(data).reduce((sum, n) => sum + n, 0);
}

export function asActivityDataRecord(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw;
    } else if (typeof raw === "string" && raw.trim() !== "") {
      const n = Number(raw);
      if (Number.isFinite(n)) out[key] = n;
    }
  }
  return out;
}

export function relId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}
