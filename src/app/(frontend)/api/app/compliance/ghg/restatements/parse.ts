import type { InventorySnapshot } from "@/lib/compliance/ghg";

function optionalScope(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return Number.NaN;
  return n;
}

/**
 * Parse optional inventory body fields.
 * Returns null when omitted, "invalid" when scopes are non-numeric.
 */
export function parseInventoryBody(value: unknown): InventorySnapshot | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") return "invalid";
  const g = value as Record<string, unknown>;
  const scope1 = optionalScope(g.scope1);
  const scope2 = optionalScope(g.scope2);
  const scope3 = optionalScope(g.scope3);
  if (
    (scope1 !== undefined && Number.isNaN(scope1)) ||
    (scope2 !== undefined && Number.isNaN(scope2)) ||
    (scope3 !== undefined && Number.isNaN(scope3))
  ) {
    return "invalid";
  }
  return {
    scope1: scope1 === undefined ? null : scope1,
    scope2: scope2 === undefined ? null : scope2,
    scope3: scope3 === undefined ? null : scope3,
    quality: "missing",
    source: typeof g.source === "string" ? g.source : "manual",
    capturedAt:
      typeof g.capturedAt === "string" && g.capturedAt.trim()
        ? g.capturedAt.trim()
        : new Date().toISOString(),
  };
}
