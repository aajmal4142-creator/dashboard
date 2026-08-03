/**
 * Reference CN / CBAM sector hints for UI autocomplete.
 * Not emission factors — operators still enter embedded emissions.
 */
export type CbamCnHint = {
  cnCode: string;
  label: string;
  sector: string;
  typicalUnit: "t" | "kg" | "mwh";
};

export const CBAM_CN_HINTS: CbamCnHint[] = [
  {
    cnCode: "2523",
    label: "Cement / Portland cement",
    sector: "Cement",
    typicalUnit: "t",
  },
  {
    cnCode: "2507",
    label: "Kaolin / calcined clays",
    sector: "Cement",
    typicalUnit: "t",
  },
  {
    cnCode: "7206",
    label: "Iron and non-alloy steel, ingots",
    sector: "Iron & steel",
    typicalUnit: "t",
  },
  {
    cnCode: "7207",
    label: "Semi-finished iron / steel",
    sector: "Iron & steel",
    typicalUnit: "t",
  },
  {
    cnCode: "7208",
    label: "Flat-rolled iron / steel, hot-rolled",
    sector: "Iron & steel",
    typicalUnit: "t",
  },
  {
    cnCode: "7213",
    label: "Bars and rods, hot-rolled",
    sector: "Iron & steel",
    typicalUnit: "t",
  },
  {
    cnCode: "7304",
    label: "Tubes, pipes of iron / steel",
    sector: "Iron & steel",
    typicalUnit: "t",
  },
  { cnCode: "7601", label: "Unwrought aluminium", sector: "Aluminium", typicalUnit: "t" },
  {
    cnCode: "7604",
    label: "Aluminium bars, rods, profiles",
    sector: "Aluminium",
    typicalUnit: "t",
  },
  {
    cnCode: "7606",
    label: "Aluminium plates, sheets, strip",
    sector: "Aluminium",
    typicalUnit: "t",
  },
  { cnCode: "2804", label: "Hydrogen", sector: "Hydrogen", typicalUnit: "t" },
  {
    cnCode: "3102",
    label: "Mineral or chemical fertilisers, nitrogenous",
    sector: "Fertilisers",
    typicalUnit: "t",
  },
  {
    cnCode: "3105",
    label: "Mineral or chemical fertilisers, mixed",
    sector: "Fertilisers",
    typicalUnit: "t",
  },
  {
    cnCode: "2716",
    label: "Electrical energy",
    sector: "Electricity",
    typicalUnit: "mwh",
  },
];

export function searchCnHints(query: string, limit = 20): CbamCnHint[] {
  const q = query.trim().toLowerCase();
  if (!q) return CBAM_CN_HINTS.slice(0, limit);
  return CBAM_CN_HINTS.filter(
    (h) =>
      h.cnCode.startsWith(q) ||
      h.label.toLowerCase().includes(q) ||
      h.sector.toLowerCase().includes(q),
  ).slice(0, limit);
}
