/**
 * NACE Rev. 2 — official Eurostat classification (bundled reference).
 * Source: Eurostat Statistical classification of economic activities (NACE Rev. 2).
 * Includes all sections + divisions; taxonomy-relevant 4-digit classes for search.
 * Do not hardcode NACE lists in UI — import from here.
 */

import type { NaceCode, TaxonomyObjectiveId } from "./types";

const ALL: TaxonomyObjectiveId[] = [
  "climate_mitigation",
  "climate_adaptation",
  "water",
  "circular_economy",
  "pollution",
  "biodiversity",
];

const MIT_ADP: TaxonomyObjectiveId[] = ["climate_mitigation", "climate_adaptation"];

const MIT_CIRC: TaxonomyObjectiveId[] = ["climate_mitigation", "circular_economy"];

const WATER_POLL: TaxonomyObjectiveId[] = ["water", "pollution"];

const BIO: TaxonomyObjectiveId[] = ["biodiversity", "climate_adaptation"];

function section(
  code: string,
  name: string,
  eligible: TaxonomyObjectiveId[] = [],
): NaceCode {
  return { code, name, section: code, level: "section", eligibleObjectives: eligible };
}

function division(
  code: string,
  sectionLetter: string,
  name: string,
  eligible: TaxonomyObjectiveId[] = [],
): NaceCode {
  return {
    code,
    name,
    section: sectionLetter,
    level: "division",
    eligibleObjectives: eligible,
  };
}

function naceClass(
  code: string,
  sectionLetter: string,
  name: string,
  eligible: TaxonomyObjectiveId[],
): NaceCode {
  return {
    code,
    name,
    section: sectionLetter,
    level: "class",
    eligibleObjectives: eligible,
  };
}

/** Full NACE Rev. 2 catalog used by the assessment wizard. */
export const NACE_REV2_CODES: NaceCode[] = [
  // —— Sections ——
  section("A", "Agriculture, forestry and fishing", [
    "climate_mitigation",
    "biodiversity",
    "water",
  ]),
  section("B", "Mining and quarrying", ["pollution", "water", "circular_economy"]),
  section("C", "Manufacturing", ALL),
  section("D", "Electricity, gas, steam and air conditioning supply", MIT_ADP),
  section("E", "Water supply; sewerage, waste management and remediation activities", [
    "water",
    "circular_economy",
    "pollution",
    "climate_mitigation",
  ]),
  section("F", "Construction", ALL),
  section("G", "Wholesale and retail trade; repair of motor vehicles and motorcycles", [
    "circular_economy",
    "climate_mitigation",
  ]),
  section("H", "Transportation and storage", MIT_ADP),
  section("I", "Accommodation and food service activities", [
    "climate_mitigation",
    "circular_economy",
    "water",
  ]),
  section("J", "Information and communication", MIT_ADP),
  section("K", "Financial and insurance activities", MIT_ADP),
  section("L", "Real estate activities", [
    "climate_mitigation",
    "climate_adaptation",
    "circular_economy",
  ]),
  section("M", "Professional, scientific and technical activities", MIT_ADP),
  section("N", "Administrative and support service activities", []),
  section("O", "Public administration and defence; compulsory social security", []),
  section("P", "Education", []),
  section("Q", "Human health and social work activities", []),
  section("R", "Arts, entertainment and recreation", ["biodiversity"]),
  section("S", "Other service activities", ["circular_economy"]),
  section(
    "T",
    "Activities of households as employers; undifferentiated goods- and services-producing activities of households for own use",
    [],
  ),
  section("U", "Activities of extraterritorial organisations and bodies", []),

  // —— Divisions (A) ——
  division(
    "01",
    "A",
    "Crop and animal production, hunting and related service activities",
    ["climate_mitigation", "biodiversity", "water"],
  ),
  division("02", "A", "Forestry and logging", ["climate_mitigation", "biodiversity"]),
  division("03", "A", "Fishing and aquaculture", ["biodiversity", "water", "pollution"]),

  // —— Divisions (B) ——
  division("05", "B", "Mining of coal and lignite", ["pollution", "climate_mitigation"]),
  division("06", "B", "Extraction of crude petroleum and natural gas", [
    "pollution",
    "climate_mitigation",
  ]),
  division("07", "B", "Mining of metal ores", ["pollution", "circular_economy", "water"]),
  division("08", "B", "Other mining and quarrying", ["pollution", "circular_economy"]),
  division("09", "B", "Mining support service activities", ["pollution"]),

  // —— Divisions (C) ——
  division("10", "C", "Manufacture of food products", [
    "climate_mitigation",
    "water",
    "circular_economy",
  ]),
  division("11", "C", "Manufacture of beverages", ["water", "climate_mitigation"]),
  division("12", "C", "Manufacture of tobacco products", []),
  division("13", "C", "Manufacture of textiles", [
    "circular_economy",
    "pollution",
    "water",
  ]),
  division("14", "C", "Manufacture of wearing apparel", [
    "circular_economy",
    "pollution",
  ]),
  division("15", "C", "Manufacture of leather and related products", [
    "circular_economy",
    "pollution",
  ]),
  division("16", "C", "Manufacture of wood and of products of wood and cork", [
    "climate_mitigation",
    "circular_economy",
    "biodiversity",
  ]),
  division("17", "C", "Manufacture of paper and paper products", [
    "circular_economy",
    "water",
    "pollution",
  ]),
  division("18", "C", "Printing and reproduction of recorded media", ["pollution"]),
  division("19", "C", "Manufacture of coke and refined petroleum products", [
    "pollution",
    "climate_mitigation",
  ]),
  division("20", "C", "Manufacture of chemicals and chemical products", [
    "pollution",
    "circular_economy",
    "climate_mitigation",
  ]),
  division(
    "21",
    "C",
    "Manufacture of basic pharmaceutical products and pharmaceutical preparations",
    ["pollution", "water"],
  ),
  division("22", "C", "Manufacture of rubber and plastic products", [
    "circular_economy",
    "pollution",
  ]),
  division("23", "C", "Manufacture of other non-metallic mineral products", [
    "climate_mitigation",
    "circular_economy",
    "pollution",
  ]),
  division("24", "C", "Manufacture of basic metals", [
    "climate_mitigation",
    "circular_economy",
    "pollution",
  ]),
  division(
    "25",
    "C",
    "Manufacture of fabricated metal products, except machinery and equipment",
    ["circular_economy", "climate_mitigation"],
  ),
  division("26", "C", "Manufacture of computer, electronic and optical products", [
    "circular_economy",
    "climate_mitigation",
  ]),
  division("27", "C", "Manufacture of electrical equipment", MIT_CIRC),
  division("28", "C", "Manufacture of machinery and equipment n.e.c.", MIT_CIRC),
  division(
    "29",
    "C",
    "Manufacture of motor vehicles, trailers and semi-trailers",
    MIT_CIRC,
  ),
  division("30", "C", "Manufacture of other transport equipment", MIT_CIRC),
  division("31", "C", "Manufacture of furniture", ["circular_economy"]),
  division("32", "C", "Other manufacturing", ["circular_economy"]),
  division("33", "C", "Repair and installation of machinery and equipment", [
    "circular_economy",
    "climate_mitigation",
  ]),

  // —— Divisions (D–F) ——
  division("35", "D", "Electricity, gas, steam and air conditioning supply", MIT_ADP),
  division("36", "E", "Water collection, treatment and supply", WATER_POLL),
  division("37", "E", "Sewerage", WATER_POLL),
  division(
    "38",
    "E",
    "Waste collection, treatment and disposal activities; materials recovery",
    ["circular_economy", "pollution", "climate_mitigation"],
  ),
  division("39", "E", "Remediation activities and other waste management services", [
    "pollution",
    "circular_economy",
  ]),
  division("41", "F", "Construction of buildings", ALL),
  division("42", "F", "Civil engineering", ALL),
  division("43", "F", "Specialised construction activities", ALL),

  // —— Divisions (G–I) ——
  division(
    "45",
    "G",
    "Wholesale and retail trade and repair of motor vehicles and motorcycles",
    ["circular_economy", "climate_mitigation"],
  ),
  division("46", "G", "Wholesale trade, except of motor vehicles and motorcycles", [
    "circular_economy",
  ]),
  division("47", "G", "Retail trade, except of motor vehicles and motorcycles", [
    "circular_economy",
    "climate_mitigation",
  ]),
  division("49", "H", "Land transport and transport via pipelines", MIT_ADP),
  division("50", "H", "Water transport", MIT_ADP),
  division("51", "H", "Air transport", MIT_ADP),
  division("52", "H", "Warehousing and support activities for transportation", MIT_ADP),
  division("53", "H", "Postal and courier activities", ["climate_mitigation"]),
  division("55", "I", "Accommodation", [
    "climate_mitigation",
    "water",
    "circular_economy",
  ]),
  division("56", "I", "Food and beverage service activities", [
    "climate_mitigation",
    "circular_economy",
    "water",
  ]),

  // —— Divisions (J–N) ——
  division("58", "J", "Publishing activities", ["climate_mitigation"]),
  division(
    "59",
    "J",
    "Motion picture, video and television programme production, sound recording and music publishing activities",
    [],
  ),
  division("60", "J", "Programming and broadcasting activities", []),
  division("61", "J", "Telecommunications", MIT_ADP),
  division(
    "62",
    "J",
    "Computer programming, consultancy and related activities",
    MIT_ADP,
  ),
  division("63", "J", "Information service activities", MIT_ADP),
  division(
    "64",
    "K",
    "Financial service activities, except insurance and pension funding",
    MIT_ADP,
  ),
  division(
    "65",
    "K",
    "Insurance, reinsurance and pension funding, except compulsory social security",
    MIT_ADP,
  ),
  division(
    "66",
    "K",
    "Activities auxiliary to financial services and insurance activities",
    MIT_ADP,
  ),
  division("68", "L", "Real estate activities", [
    "climate_mitigation",
    "climate_adaptation",
    "circular_economy",
  ]),
  division("69", "M", "Legal and accounting activities", []),
  division(
    "70",
    "M",
    "Activities of head offices; management consultancy activities",
    [],
  ),
  division(
    "71",
    "M",
    "Architectural and engineering activities; technical testing and analysis",
    MIT_ADP,
  ),
  division("72", "M", "Scientific research and development", ALL),
  division("73", "M", "Advertising and market research", []),
  division("74", "M", "Other professional, scientific and technical activities", []),
  division("75", "M", "Veterinary activities", ["biodiversity"]),
  division("77", "N", "Rental and leasing activities", [
    "circular_economy",
    "climate_mitigation",
  ]),
  division("78", "N", "Employment activities", []),
  division(
    "79",
    "N",
    "Travel agency, tour operator and other reservation service and related activities",
    ["climate_mitigation"],
  ),
  division("80", "N", "Security and investigation activities", []),
  division("81", "N", "Services to buildings and landscape activities", BIO),
  division(
    "82",
    "N",
    "Office administrative, office support and other business support activities",
    [],
  ),

  // —— Divisions (O–U) ——
  division(
    "84",
    "O",
    "Public administration and defence; compulsory social security",
    [],
  ),
  division("85", "P", "Education", []),
  division("86", "Q", "Human health activities", []),
  division("87", "Q", "Residential care activities", []),
  division("88", "Q", "Social work activities without accommodation", []),
  division("90", "R", "Creative, arts and entertainment activities", []),
  division("91", "R", "Libraries, archives, museums and other cultural activities", [
    "biodiversity",
  ]),
  division("92", "R", "Gambling and betting activities", []),
  division("93", "R", "Sports activities and amusement and recreation activities", [
    "biodiversity",
  ]),
  division("94", "S", "Activities of membership organisations", []),
  division("95", "S", "Repair of computers and personal and household goods", [
    "circular_economy",
  ]),
  division("96", "S", "Other personal service activities", []),
  division("97", "T", "Activities of households as employers of domestic personnel", []),
  division(
    "98",
    "T",
    "Undifferentiated goods- and services-producing activities of private households for own use",
    [],
  ),
  division("99", "U", "Activities of extraterritorial organisations and bodies", []),

  // —— Taxonomy-relevant 4-digit classes (Delegated Acts coverage) ——
  naceClass(
    "0111",
    "A",
    "Growing of cereals (except rice), leguminous crops and oil seeds",
    ["climate_mitigation", "biodiversity", "water"],
  ),
  naceClass("0210", "A", "Silviculture and other forestry activities", [
    "climate_mitigation",
    "biodiversity",
  ]),
  naceClass("3511", "D", "Production of electricity", MIT_ADP),
  naceClass("3512", "D", "Transmission of electricity", MIT_ADP),
  naceClass("3513", "D", "Distribution of electricity", MIT_ADP),
  naceClass("3514", "D", "Trade of electricity", MIT_ADP),
  naceClass("3530", "D", "Steam and air conditioning supply", MIT_ADP),
  naceClass("3600", "E", "Water collection, treatment and supply", WATER_POLL),
  naceClass("3700", "E", "Sewerage", WATER_POLL),
  naceClass("3811", "E", "Collection of non-hazardous waste", [
    "circular_economy",
    "pollution",
  ]),
  naceClass("3821", "E", "Treatment and disposal of non-hazardous waste", [
    "circular_economy",
    "pollution",
    "climate_mitigation",
  ]),
  naceClass("3832", "E", "Recovery of sorted materials", ["circular_economy"]),
  naceClass("4110", "F", "Development of building projects", ALL),
  naceClass(
    "4120",
    "F",
    "Construction of residential and non-residential buildings",
    ALL,
  ),
  naceClass("4211", "F", "Construction of roads and motorways", ALL),
  naceClass(
    "4222",
    "F",
    "Construction of utility projects for electricity and telecommunications",
    ALL,
  ),
  naceClass("4291", "F", "Construction of water projects", [
    "water",
    "climate_adaptation",
  ]),
  naceClass("4321", "F", "Electrical installation", [
    "climate_mitigation",
    "climate_adaptation",
  ]),
  naceClass("4322", "F", "Plumbing, heat and air-conditioning installation", MIT_ADP),
  naceClass("4910", "H", "Passenger rail transport, interurban", MIT_ADP),
  naceClass("4931", "H", "Urban and suburban passenger land transport", MIT_ADP),
  naceClass("4941", "H", "Freight transport by road", MIT_ADP),
  naceClass("5010", "H", "Sea and coastal passenger water transport", MIT_ADP),
  naceClass("5020", "H", "Sea and coastal freight water transport", MIT_ADP),
  naceClass("5110", "H", "Passenger air transport", MIT_ADP),
  naceClass("5210", "H", "Warehousing and storage", ["climate_mitigation"]),
  naceClass("6110", "J", "Wired telecommunications activities", MIT_ADP),
  naceClass("6120", "J", "Wireless telecommunications activities", MIT_ADP),
  naceClass("6201", "J", "Computer programming activities", MIT_ADP),
  naceClass("6311", "J", "Data processing, hosting and related activities", MIT_ADP),
  naceClass("6810", "L", "Buying and selling of own real estate", [
    "climate_mitigation",
    "climate_adaptation",
  ]),
  naceClass("6820", "L", "Renting and operating of own or leased real estate", [
    "climate_mitigation",
    "climate_adaptation",
    "circular_economy",
  ]),
  naceClass("7111", "M", "Architectural activities", MIT_ADP),
  naceClass(
    "7112",
    "M",
    "Engineering activities and related technical consultancy",
    MIT_ADP,
  ),
  naceClass("7211", "M", "Research and experimental development on biotechnology", ALL),
  naceClass(
    "7219",
    "M",
    "Other research and experimental development on natural sciences and engineering",
    ALL,
  ),
  naceClass(
    "2711",
    "C",
    "Manufacture of electric motors, generators and transformers",
    MIT_CIRC,
  ),
  naceClass(
    "2712",
    "C",
    "Manufacture of electricity distribution and control apparatus",
    MIT_CIRC,
  ),
  naceClass("2720", "C", "Manufacture of batteries and accumulators", MIT_CIRC),
  naceClass("2790", "C", "Manufacture of other electrical equipment", MIT_CIRC),
  naceClass("2910", "C", "Manufacture of motor vehicles", MIT_CIRC),
  naceClass(
    "2931",
    "C",
    "Manufacture of electrical and electronic equipment for motor vehicles",
    MIT_CIRC,
  ),
  naceClass("3011", "C", "Building of ships and floating structures", MIT_CIRC),
  naceClass(
    "3030",
    "C",
    "Manufacture of air and spacecraft and related machinery",
    MIT_CIRC,
  ),
  naceClass("2011", "C", "Manufacture of industrial gases", [
    "climate_mitigation",
    "pollution",
  ]),
  naceClass("2013", "C", "Manufacture of other inorganic basic chemicals", [
    "pollution",
    "circular_economy",
  ]),
  naceClass("2351", "C", "Manufacture of cement", ["climate_mitigation", "pollution"]),
  naceClass("2410", "C", "Manufacture of basic iron and steel and of ferro-alloys", [
    "climate_mitigation",
    "circular_economy",
  ]),
  naceClass("2442", "C", "Aluminium production", [
    "climate_mitigation",
    "circular_economy",
  ]),
];

/** Illustrative EU peer alignment averages by NACE section (bundled reference, not live). */
export const EU_SECTION_AVERAGE_PERCENT: Record<string, number> = {
  A: 18,
  B: 8,
  C: 22,
  D: 41,
  E: 35,
  F: 28,
  G: 12,
  H: 24,
  I: 14,
  J: 19,
  K: 16,
  L: 26,
  M: 15,
  N: 10,
  O: 11,
  P: 9,
  Q: 8,
  R: 7,
  S: 11,
  T: 0,
  U: 0,
};

const byCode = new Map(NACE_REV2_CODES.map((row) => [row.code.toUpperCase(), row]));

export function findNaceCode(code: string): NaceCode | null {
  const key = code.trim().toUpperCase();
  return byCode.get(key) ?? null;
}

export function searchNaceCodes(query: string, limit = 40): NaceCode[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return NACE_REV2_CODES.filter((r) => r.level === "division").slice(0, limit);
  }
  const scored: Array<{ row: NaceCode; score: number }> = [];
  for (const row of NACE_REV2_CODES) {
    const code = row.code.toLowerCase();
    const name = row.name.toLowerCase();
    let score = 0;
    if (code === q) score = 100;
    else if (code.startsWith(q)) score = 80;
    else if (code.includes(q)) score = 60;
    else if (name.startsWith(q)) score = 50;
    else if (name.includes(q)) score = 30;
    if (score > 0) {
      // Prefer more specific codes when tied
      if (row.level === "class") score += 2;
      else if (row.level === "division") score += 1;
      scored.push({ row, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.row.code.localeCompare(b.row.code));
  return scored.slice(0, limit).map((s) => s.row);
}

export function getEligibleObjectivesForNace(code: string): TaxonomyObjectiveId[] {
  const row = findNaceCode(code);
  if (!row) return [];
  if (row.eligibleObjectives.length > 0) return [...row.eligibleObjectives];
  // Fall back to section eligibility
  const sectionRow = byCode.get(row.section);
  return sectionRow ? [...sectionRow.eligibleObjectives] : [];
}

export function getEuAverageForNace(code: string): {
  percent: number | null;
  note: string | null;
} {
  const row = findNaceCode(code);
  if (!row) return { percent: null, note: null };
  const percent = EU_SECTION_AVERAGE_PERCENT[row.section] ?? null;
  if (percent === null) return { percent: null, note: null };
  return {
    percent,
    note: `Illustrative EU peer average for NACE section ${row.section} (bundled reference; not a live Eurostat feed).`,
  };
}
