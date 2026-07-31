import { formulaKeys, validateFormula } from "./formula";
import {
  CUSTOM_METRIC_CATEGORIES,
  type CreateCustomMetricInput,
  type CustomMetricCategory,
  type PreviewCustomMetricInput,
  type UpdateCustomMetricInput,
} from "./customTypes";

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

export function isCustomMetricCategory(v: string): v is CustomMetricCategory {
  return (CUSTOM_METRIC_CATEGORIES as readonly string[]).includes(v);
}

export function parseCreateCustomMetricBody(
  body: unknown,
  allowedKeys: ReadonlySet<string>,
): { ok: true; data: CreateCustomMetricInput } | { ok: false; error: string } {
  const obj = asRecord(body);
  if (!obj) return { ok: false, error: "Body must be an object." };

  if (typeof obj.label !== "string" || !obj.label.trim()) {
    return { ok: false, error: "label is required." };
  }
  if (typeof obj.description !== "string" || !obj.description.trim()) {
    return { ok: false, error: "description is required." };
  }
  if (typeof obj.unit !== "string" || !obj.unit.trim()) {
    return { ok: false, error: "unit is required." };
  }
  if (typeof obj.formula !== "string" || !obj.formula.trim()) {
    return { ok: false, error: "formula is required." };
  }
  if (typeof obj.category !== "string" || !isCustomMetricCategory(obj.category)) {
    return {
      ok: false,
      error: `category must be one of: ${CUSTOM_METRIC_CATEGORIES.join(", ")}.`,
    };
  }

  const validated = validateFormula(obj.formula.trim(), allowedKeys);
  if (!validated.ok) return validated;

  const data: CreateCustomMetricInput = {
    label: obj.label.trim(),
    description: obj.description.trim(),
    unit: obj.unit.trim(),
    formula: obj.formula.trim(),
    category: obj.category,
  };

  if (typeof obj.enabled === "boolean") data.enabled = obj.enabled;

  if (obj.key !== undefined) {
    if (typeof obj.key !== "string" || !obj.key.trim()) {
      return { ok: false, error: "key must be a non-empty string when provided." };
    }
    const key = obj.key.trim();
    if (!key.startsWith("custom.")) {
      return { ok: false, error: 'Custom metric key must start with "custom.".' };
    }
    data.key = key;
  }

  return { ok: true, data };
}

export function parseUpdateCustomMetricBody(
  body: unknown,
  allowedKeys: ReadonlySet<string>,
): { ok: true; data: UpdateCustomMetricInput } | { ok: false; error: string } {
  const obj = asRecord(body);
  if (!obj) return { ok: false, error: "Body must be an object." };

  const data: UpdateCustomMetricInput = {};

  if (obj.label !== undefined) {
    if (typeof obj.label !== "string" || !obj.label.trim()) {
      return { ok: false, error: "label must be a non-empty string." };
    }
    data.label = obj.label.trim();
  }

  if (obj.description !== undefined) {
    if (typeof obj.description !== "string" || !obj.description.trim()) {
      return { ok: false, error: "description must be a non-empty string." };
    }
    data.description = obj.description.trim();
  }

  if (obj.unit !== undefined) {
    if (typeof obj.unit !== "string" || !obj.unit.trim()) {
      return { ok: false, error: "unit must be a non-empty string." };
    }
    data.unit = obj.unit.trim();
  }

  if (obj.formula !== undefined) {
    if (typeof obj.formula !== "string" || !obj.formula.trim()) {
      return { ok: false, error: "formula must be a non-empty string." };
    }
    const validated = validateFormula(obj.formula.trim(), allowedKeys);
    if (!validated.ok) return validated;
    data.formula = obj.formula.trim();
  }

  if (obj.category !== undefined) {
    if (typeof obj.category !== "string" || !isCustomMetricCategory(obj.category)) {
      return {
        ok: false,
        error: `category must be one of: ${CUSTOM_METRIC_CATEGORIES.join(", ")}.`,
      };
    }
    data.category = obj.category;
  }

  if (obj.enabled !== undefined) {
    if (typeof obj.enabled !== "boolean") {
      return { ok: false, error: "enabled must be a boolean." };
    }
    data.enabled = obj.enabled;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No updatable fields provided." };
  }

  return { ok: true, data };
}

export function parsePreviewBody(
  body: unknown,
  allowedKeys: ReadonlySet<string>,
): { ok: true; data: PreviewCustomMetricInput } | { ok: false; error: string } {
  const obj = asRecord(body);
  if (!obj) return { ok: false, error: "Body must be an object." };

  if (typeof obj.formula !== "string" || !obj.formula.trim()) {
    return { ok: false, error: "formula is required." };
  }

  const validated = validateFormula(obj.formula.trim(), allowedKeys);
  if (!validated.ok) return validated;

  const data: PreviewCustomMetricInput = {
    formula: obj.formula.trim(),
  };

  if (obj.periodId !== undefined) {
    if (typeof obj.periodId !== "string" || !obj.periodId.trim()) {
      return { ok: false, error: "periodId must be a non-empty string." };
    }
    data.periodId = obj.periodId.trim();
  }

  if (obj.sampleValues !== undefined) {
    if (
      !obj.sampleValues ||
      typeof obj.sampleValues !== "object" ||
      Array.isArray(obj.sampleValues)
    ) {
      return { ok: false, error: "sampleValues must be an object of numbers." };
    }
    const sampleValues: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj.sampleValues)) {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        return { ok: false, error: `sampleValues.${k} must be a finite number.` };
      }
      sampleValues[k] = v;
    }
    data.sampleValues = sampleValues;
  }

  if (!data.periodId && !data.sampleValues) {
    // Allow preview with empty sample — evaluate will report missing keys.
    data.sampleValues = {};
  }

  // Touch keys so callers know what to fill when sample is empty.
  void formulaKeys(data.formula);

  return { ok: true, data };
}
