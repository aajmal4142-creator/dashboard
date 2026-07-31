/**
 * Bundled NACE Rev. 2 section-level emission intensities for Tier 2/3 spend estimates.
 * Unit: tCO₂e per $1M USD spend (EEIO-style proxy — not a licensed factor).
 * Zero I/O. Callers must supply a NACE code — never invent one.
 */

export type IndustryIntensityRow = {
  /** NACE section letter (A–U) or 2–4 digit class prefix */
  naceCode: string;
  label: string;
  /** tCO₂e per million USD of spend */
  tco2ePerMillionUsd: number;
};

/**
 * Section-level baselines (illustrative EEIO-style proxies).
 * Prefer more specific class prefixes when present in the table.
 */
export const INDUSTRY_INTENSITY_BY_NACE: readonly IndustryIntensityRow[] = [
  { naceCode: "A", label: "Agriculture, forestry and fishing", tco2ePerMillionUsd: 420 },
  { naceCode: "B", label: "Mining and quarrying", tco2ePerMillionUsd: 680 },
  { naceCode: "C", label: "Manufacturing", tco2ePerMillionUsd: 250 },
  {
    naceCode: "D",
    label: "Electricity, gas, steam and air conditioning",
    tco2ePerMillionUsd: 890,
  },
  {
    naceCode: "E",
    label: "Water supply; sewerage, waste management",
    tco2ePerMillionUsd: 310,
  },
  { naceCode: "F", label: "Construction", tco2ePerMillionUsd: 180 },
  { naceCode: "G", label: "Wholesale and retail trade", tco2ePerMillionUsd: 45 },
  { naceCode: "H", label: "Transportation and storage", tco2ePerMillionUsd: 380 },
  { naceCode: "I", label: "Accommodation and food service", tco2ePerMillionUsd: 95 },
  { naceCode: "J", label: "Information and communication", tco2ePerMillionUsd: 35 },
  { naceCode: "K", label: "Financial and insurance activities", tco2ePerMillionUsd: 18 },
  { naceCode: "L", label: "Real estate activities", tco2ePerMillionUsd: 55 },
  {
    naceCode: "M",
    label: "Professional, scientific and technical",
    tco2ePerMillionUsd: 28,
  },
  { naceCode: "N", label: "Administrative and support service", tco2ePerMillionUsd: 40 },
  { naceCode: "O", label: "Public administration and defence", tco2ePerMillionUsd: 60 },
  { naceCode: "P", label: "Education", tco2ePerMillionUsd: 25 },
  { naceCode: "Q", label: "Human health and social work", tco2ePerMillionUsd: 50 },
  { naceCode: "R", label: "Arts, entertainment and recreation", tco2ePerMillionUsd: 70 },
  { naceCode: "S", label: "Other service activities", tco2ePerMillionUsd: 40 },
  { naceCode: "T", label: "Households as employers", tco2ePerMillionUsd: 30 },
  { naceCode: "U", label: "Extraterritorial organisations", tco2ePerMillionUsd: 20 },
  // Class-level refinements (manufacturing / energy heavy)
  {
    naceCode: "19",
    label: "Manufacture of coke and refined petroleum",
    tco2ePerMillionUsd: 720,
  },
  { naceCode: "20", label: "Manufacture of chemicals", tco2ePerMillionUsd: 410 },
  {
    naceCode: "23",
    label: "Manufacture of other non-metallic mineral products",
    tco2ePerMillionUsd: 550,
  },
  { naceCode: "24", label: "Manufacture of basic metals", tco2ePerMillionUsd: 610 },
  {
    naceCode: "35",
    label: "Electricity, gas, steam and air conditioning supply",
    tco2ePerMillionUsd: 890,
  },
  {
    naceCode: "49",
    label: "Land transport and transport via pipelines",
    tco2ePerMillionUsd: 360,
  },
  { naceCode: "51", label: "Air transport", tco2ePerMillionUsd: 980 },
] as const;

const BY_CODE = new Map(
  INDUSTRY_INTENSITY_BY_NACE.map((row) => [row.naceCode.toUpperCase(), row]),
);

/**
 * Normalise user input to a lookup key. Digits → class prefix; letter → section.
 * Does not invent a code when empty — returns null.
 */
export function normaliseNaceCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().toUpperCase();
  if (!trimmed) return null;
  // Accept "C24.1" / "24.10" / "C" / "2410"
  const letterOnly = trimmed.match(/^([A-U])$/);
  if (letterOnly) return letterOnly[1];
  const sectionPrefixed = trimmed.match(/^([A-U])[\s.\-]?(\d{2,4})/);
  if (sectionPrefixed) return sectionPrefixed[2].slice(0, 2);
  const digits = trimmed.match(/^(\d{2,4})/);
  if (digits) return digits[1].slice(0, 2);
  const section = trimmed.match(/^([A-U])/);
  if (section) return section[1];
  return null;
}

/**
 * Resolve intensity for a NACE code. Prefers 2-digit class, then section letter.
 * Returns null when code missing or unknown — caller must not invent.
 */
export function resolveIndustryIntensity(
  naceCode: string | null | undefined,
): IndustryIntensityRow | null {
  const key = normaliseNaceCode(naceCode);
  if (!key) return null;

  const exact = BY_CODE.get(key);
  if (exact) return exact;

  // If we have a 2-digit class without a row, map to section via first digit band is unreliable;
  // try section letter if caller passed e.g. "C24"
  if (/^\d{2}$/.test(key)) {
    // Common EU mapping of division → section (subset used in seed)
    const division = Number(key);
    const section = sectionForDivision(division);
    if (section) {
      const row = BY_CODE.get(section);
      if (row) return row;
    }
  }

  return null;
}

function sectionForDivision(division: number): string | null {
  if (division >= 1 && division <= 3) return "A";
  if (division >= 5 && division <= 9) return "B";
  if (division >= 10 && division <= 33) return "C";
  if (division === 35) return "D";
  if (division >= 36 && division <= 39) return "E";
  if (division >= 41 && division <= 43) return "F";
  if (division >= 45 && division <= 47) return "G";
  if (division >= 49 && division <= 53) return "H";
  if (division >= 55 && division <= 56) return "I";
  if (division >= 58 && division <= 63) return "J";
  if (division >= 64 && division <= 66) return "K";
  if (division === 68) return "L";
  if (division >= 69 && division <= 75) return "M";
  if (division >= 77 && division <= 82) return "N";
  if (division === 84) return "O";
  if (division === 85) return "P";
  if (division >= 86 && division <= 88) return "Q";
  if (division >= 90 && division <= 93) return "R";
  if (division >= 94 && division <= 96) return "S";
  if (division >= 97 && division <= 98) return "T";
  if (division === 99) return "U";
  return null;
}

/** Convert tCO₂e / $M → tCO₂e for a USD spend amount. */
export function emissionsFromSpendAndIntensity(
  spendUsd: number,
  tco2ePerMillionUsd: number,
): number {
  if (!(spendUsd > 0) || !(tco2ePerMillionUsd >= 0)) return 0;
  return (spendUsd / 1_000_000) * tco2ePerMillionUsd;
}
