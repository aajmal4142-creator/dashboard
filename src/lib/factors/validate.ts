/**
 * Pure validation for org custom emission-factor admin.
 * Missing factors still throw / quality missing in calc — this never invents defaults.
 */

/** snake_case key: starts with a letter, lowercase alphanumerics and underscores. */
export const FACTOR_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export type FactorKeyValidation =
  { ok: true; key: string } | { ok: false; error: string };

export type FactorValueValidation =
  { ok: true; value: number } | { ok: false; error: string };

export type FactorYearValidation =
  { ok: true; year: number } | { ok: false; error: string };

export type FactorRegionValidation =
  { ok: true; region: string } | { ok: false; error: string };

export function validateFactorKey(raw: unknown): FactorKeyValidation {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "key is required." };
  }
  const key = raw.trim();
  if (key.length > 64) {
    return { ok: false, error: "key must be 64 characters or fewer." };
  }
  if (!FACTOR_KEY_PATTERN.test(key)) {
    return {
      ok: false,
      error:
        "key must be snake_case: start with a letter, then lowercase letters, digits, or underscores.",
    };
  }
  return { ok: true, key };
}

/**
 * Factor values must be positive and finite.
 * Zero / negative / NaN / Infinity are rejected — calc never silently defaults.
 */
export function validateFactorValue(raw: unknown): FactorValueValidation {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, error: "value must be a finite number." };
  }
  if (raw <= 0) {
    return { ok: false, error: "value must be a positive finite number." };
  }
  return { ok: true, value: raw };
}

export function validateFactorYear(raw: unknown): FactorYearValidation {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    return { ok: false, error: "year must be an integer." };
  }
  if (raw < 1990 || raw > 2100) {
    return { ok: false, error: "year must be between 1990 and 2100." };
  }
  return { ok: true, year: raw };
}

/**
 * Geography is optional in the form; empty → GLOBAL.
 * Otherwise ISO 3166-1 alpha-2 or the literal GLOBAL.
 */
export function validateFactorRegion(raw: unknown): FactorRegionValidation {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, region: "GLOBAL" };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "geography must be a string when provided." };
  }
  const region = raw.trim().toUpperCase();
  if (region === "GLOBAL") return { ok: true, region: "GLOBAL" };
  if (!/^[A-Z]{2}$/.test(region)) {
    return {
      ok: false,
      error: "geography must be ISO 3166-1 alpha-2 (e.g. IN, GB) or GLOBAL.",
    };
  }
  return { ok: true, region };
}
