import { SUPPLIER_FORM_FIELDS } from "@/lib/suppliers/fields";

/** Fraction of required fields with a non-empty draft value (0–1). */
export function portalFormProgress(values: Record<string, string>): {
  filled: number;
  total: number;
  ratio: number;
} {
  const required = SUPPLIER_FORM_FIELDS.filter((f) => f.required);
  const total = required.length;
  let filled = 0;
  for (const f of required) {
    const raw = values[f.key]?.trim() ?? "";
    if (raw.length > 0 && Number.isFinite(Number(raw))) filled += 1;
  }
  return {
    filled,
    total,
    ratio: total === 0 ? 0 : filled / total,
  };
}
