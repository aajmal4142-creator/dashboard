import { DERIVED_METRICS } from "./registry";
import { FORMULA_ALIAS_KEYS } from "./customQuery";
import type { MetricKeyOption } from "./customTypes";

export function buildAllowedFormulaKeys(
  rawMetrics: Array<{ key: string; label: string; unit: string | null }>,
): { allowed: Set<string>; options: MetricKeyOption[] } {
  const options: MetricKeyOption[] = [];
  const allowed = new Set<string>();

  for (const m of rawMetrics) {
    allowed.add(m.key);
    options.push({
      key: m.key,
      label: m.label,
      unit: m.unit,
      source: "raw",
    });
  }

  for (const d of DERIVED_METRICS) {
    allowed.add(d.key);
    options.push({
      key: d.key,
      label: d.label,
      unit: d.unit,
      source: "derived",
    });
  }

  for (const a of FORMULA_ALIAS_KEYS) {
    if (!allowed.has(a.key)) {
      allowed.add(a.key);
      options.push({
        key: a.key,
        label: a.label,
        unit: a.unit,
        source: "alias",
      });
    }
  }

  options.sort((a, b) => a.key.localeCompare(b.key));
  return { allowed, options };
}
