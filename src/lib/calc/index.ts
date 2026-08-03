export * from "./types";
export * from "./resolveFactor";
export * from "./emissions";
export * from "./wasteWater";
export * from "./scores";
export * from "./calculate";

// Spend / SKU — pure math only (I/O lives in lib/emissions/*Service)
export {
  calculateSpendBasedEmissions,
  calculateSpendBatchEmissions,
  aggregateSpendEmissions,
  applyRegionalAdjustment,
  validateSpendData,
  parseSpendImportCsv,
  mapToSpendLedgerCategory,
  mapGlCodeToCategory,
  factorLookupKeysForLedger,
  defaultGlPrefixMap,
  isSpendLedgerCategory,
  SPEND_LEDGER_CATEGORIES,
  type SpendEmissionsInput,
  type SpendEmissionsResult,
  type SpendFactor,
  type SpendAggregateRecord,
  type SpendAggregateResult,
  type SpendImportRow,
  type SpendImportParseResult,
  type SpendImportValidationError,
  type SpendLedgerCategory,
} from "./spendBasedEmissions";

export {
  calculateSKUFootprint,
  calculateBOMRollup,
  kgCo2eToTco2e,
  skuInputHasActivity,
  type SkuCalcInput,
  type SkuFootprintResult,
  type SkuStageBreakdown,
  type SkuMaterialLine,
  type SkuEmissionsSourceLine,
  type BomRollupLine,
} from "./skuFootprint";
