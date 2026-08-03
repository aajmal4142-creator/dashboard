/**
 * Pure CBAM types and formulas. Zero I/O. No Next/Payload imports.
 *
 * Assumptions (documented, not silent):
 * - Specific embedded emissions are tCO₂e per quantity unit (t, kg, or MWh).
 * - Total embedded for a line = quantity × (direct + indirect) when both are present.
 * - Missing direct or indirect → that component is quality "missing"; never coerced to 0.
 * - Liability (€) = total embedded (tCO₂e) × certificate price (€/tCO₂e).
 * - Certificate price must be operator-supplied; missing price → liability quality "missing".
 * - usesDefaultValues marks line quality as "estimated" when emissions are complete.
 * - kg quantities are converted to tonnes (÷ 1000) before multiplying emissions given per tonne.
 * - MWh lines treat specific emissions as tCO₂e/MWh (electricity CN codes).
 */

export type CbamQuality = "measured" | "estimated" | "missing";

export type CbamQuantityUnit = "t" | "kg" | "mwh";

export type CbamQuarter = "1" | "2" | "3" | "4";

export type CbamDeclarationStatus = "draft" | "submitted";

export type CbamGoodInput = {
  cnCode: string;
  description?: string | null;
  quantity: number | null;
  quantityUnit: CbamQuantityUnit;
  directEmissions: number | null;
  indirectEmissions: number | null;
  usesDefaultValues: boolean;
  installationCountry: string;
  reportingYear: number;
  reportingQuarter: CbamQuarter;
};

export type CbamLineResult = {
  quantityNormalised: number | null;
  quantityUnit: CbamQuantityUnit;
  directTotal: number | null;
  indirectTotal: number | null;
  embeddedTotal: number | null;
  quality: CbamQuality;
  message: string | null;
};

export type CbamLiabilityResult = {
  embeddedTotal: number | null;
  certificatePriceEur: number | null;
  liabilityEur: number | null;
  quality: CbamQuality;
  message: string | null;
  lineCount: number;
  measuredLines: number;
  estimatedLines: number;
  missingLines: number;
  defaultValueLines: number;
};

export type CbamImportRow = CbamGoodInput & {
  rowNumber: number;
};

export type CbamImportValidationError = {
  rowNumber: number;
  field: string;
  value: unknown;
  error: string;
};

export type CbamImportParseResult = {
  valid: boolean;
  rows: CbamImportRow[];
  errors: CbamImportValidationError[];
};
