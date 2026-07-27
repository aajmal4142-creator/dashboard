/**
 * lib/calc/types.ts — BUILD_PLAN §5.
 * Pure types. Zero I/O, zero framework imports. Everything explicit, nothing implicit.
 */

export type Quality = "measured" | "calculated" | "estimated" | "missing";

export interface Measured {
  value: number;
  unit: string;
  quality: Quality;
  factorId?: string;
}

/**
 * One organisation datapoint as the calc engine sees it — the Payload `Datapoint`
 * collapsed to just what a formula needs. Booleans (policy toggles) are represented
 * as 1 / 0 so the whole engine stays numeric; `value: null` means "not entered",
 * which is never coerced to 0.
 */
export interface DatapointValue {
  value: number | null;
  quality: Quality;
  unit?: string;
}

/**
 * Everything a calculation needs that is not itself a metricKey datapoint:
 * factor-resolution coordinates plus optional overrides used only when the
 * canonical metric (`employees_total`, `electricity_renewable_pct`) is absent.
 */
export interface CalcContext {
  region: string;
  year: number;
  employees?: number;
  renewablePct?: number;
}

/**
 * All datapoints for one organisation + reporting period, keyed by metricKey,
 * plus the context resolveFactor and the score formulas need.
 */
export interface CalcInput {
  metrics: Record<string, DatapointValue>;
  context: CalcContext;
}

/** A row from the versioned EmissionFactor registry, decoupled from Payload. */
export interface FactorRecord {
  id: string;
  key: string;
  value: number;
  unit: string;
  source: string;
  publicationYear: number;
  region: string;
  validFrom?: string;
  validUntil?: string;
}

export interface FactorUsage {
  factorId: string;
  key: string;
  value: number;
  source: string;
  year: number;
}

export interface BreakdownItem {
  component: string;
  contribution: number;
  explanation: string;
}

export interface CalcResult {
  scores: { overall: number; e: number; s: number; g: number };
  emissions: {
    scope1: Measured;
    scope2: Measured;
    scope3: Measured;
    total: Measured;
  };
  dataQualityPct: number;
  factorsUsed: FactorUsage[];
  breakdown: BreakdownItem[];
  band: "strong" | "moderate" | "early";
}
