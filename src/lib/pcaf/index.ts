export {
  PCAF_DATA_QUALITY_SCORE,
  PCAF_DATA_SOURCE_LABEL,
  computePcafAttribution,
  isPcafDataSource,
  summarisePcafPortfolio,
  type PcafAttributionResult,
  type PcafDataSource,
  type PcafExposureInput,
  type PcafPortfolioSummary,
  type PcafQuality,
} from "./attribution";

export {
  PCAF_ASSET_CLASSES,
  PCAF_CURRENCIES,
  buildPcafSummary,
  docToFinancedEmission,
  getOrgFinancedEmission,
  isPcafAssetClass,
  isPcafCurrency,
  listOrgFinancedEmissions,
  type FinancedEmissionDto,
  type PcafAssetClass,
  type PcafCurrency,
} from "./service";

/**
 * Disclaimer surfaced everywhere financed-emissions figures are shown.
 * Not a PCAF Association certification / assurance opinion.
 */
export const PCAF_DISCLAIMER =
  "In-house financed-emissions (Category 15 style) module implementing the " +
  "published PCAF attribution formula and 1–5 data-quality table. This is not " +
  "a PCAF Association certification, does not use PCAF's licensed emission " +
  "factor database, and is not an assurance opinion.";
