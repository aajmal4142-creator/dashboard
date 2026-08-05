/**
 * CBAM transitional default-value hints (operator must opt in via usesDefaultValues).
 * These are NOT silent fallbacks in the calc engine — applying them is an explicit UI/API action.
 *
 * Values are indicative sector averages for draft packing only; replace with competent-authority
 * published defaults before official filing.
 */

export type CbamDefaultRow = {
  cnPrefix: string;
  sector: string;
  label: string;
  /** Indicative direct specific emissions tCO₂e / t (or / MWh for electricity) */
  defaultDirect: number;
  /** Indicative indirect specific emissions */
  defaultIndirect: number;
  quantityUnit: "t" | "mwh";
  sourceNote: string;
};

export const CBAM_DEFAULT_VALUE_TABLE: CbamDefaultRow[] = [
  {
    cnPrefix: "2523",
    sector: "Cement",
    label: "Portland cement (indicative)",
    defaultDirect: 0.766,
    defaultIndirect: 0.045,
    quantityUnit: "t",
    sourceNote: "Operator must confirm against EU CBAM default tables before filing.",
  },
  {
    cnPrefix: "7206",
    sector: "Iron & steel",
    label: "Iron / steel ingots (indicative)",
    defaultDirect: 1.85,
    defaultIndirect: 0.12,
    quantityUnit: "t",
    sourceNote: "Operator must confirm against EU CBAM default tables before filing.",
  },
  {
    cnPrefix: "7208",
    sector: "Iron & steel",
    label: "Flat-rolled hot-rolled (indicative)",
    defaultDirect: 1.92,
    defaultIndirect: 0.14,
    quantityUnit: "t",
    sourceNote: "Operator must confirm against EU CBAM default tables before filing.",
  },
  {
    cnPrefix: "7601",
    sector: "Aluminium",
    label: "Unwrought aluminium (indicative)",
    defaultDirect: 1.64,
    defaultIndirect: 6.5,
    quantityUnit: "t",
    sourceNote: "Indirect often dominates for aluminium — verify source mix.",
  },
  {
    cnPrefix: "3102",
    sector: "Fertilisers",
    label: "Mineral/chemical fertilisers (indicative)",
    defaultDirect: 2.1,
    defaultIndirect: 0.35,
    quantityUnit: "t",
    sourceNote: "Operator must confirm against EU CBAM default tables before filing.",
  },
  {
    cnPrefix: "2804",
    sector: "Hydrogen",
    label: "Hydrogen (indicative)",
    defaultDirect: 9.0,
    defaultIndirect: 0.5,
    quantityUnit: "t",
    sourceNote: "Pathway-dependent; do not file without pathway evidence.",
  },
  {
    cnPrefix: "2716",
    sector: "Electricity",
    label: "Electricity (indicative grid)",
    defaultDirect: 0,
    defaultIndirect: 0.4,
    quantityUnit: "mwh",
    sourceNote: "Use residual mix / location factors for the import country.",
  },
];

/** Find the longest matching CN prefix default, or null. */
export function findCbamDefaultForCn(cnCode: string): CbamDefaultRow | null {
  const code = cnCode.replace(/\D/g, "");
  if (!code) return null;
  let best: CbamDefaultRow | null = null;
  for (const row of CBAM_DEFAULT_VALUE_TABLE) {
    if (code.startsWith(row.cnPrefix)) {
      if (!best || row.cnPrefix.length > best.cnPrefix.length) best = row;
    }
  }
  return best;
}
