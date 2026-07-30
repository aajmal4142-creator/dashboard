export * from "./types";
export * from "./resolveFactor";
export * from "./emissions";
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
  type SkuCalcInput,
  type SkuFootprintResult,
  type BomRollupLine,
} from "./skuFootprint";
