/**
 * GHG Protocol Corporate Value Chain (Scope 3) Standard — the 15 categories.
 * Feature Y01. Pure. Zero I/O. Names/order per the published Standard —
 * never invented or reworded.
 */

export const SCOPE3_CATEGORY_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
] as const;

export type Scope3CategoryNumber = (typeof SCOPE3_CATEGORY_NUMBERS)[number];

export function isScope3CategoryNumber(value: unknown): value is Scope3CategoryNumber {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    (SCOPE3_CATEGORY_NUMBERS as readonly number[]).includes(value)
  );
}

export interface Scope3CategoryDef {
  number: Scope3CategoryNumber;
  name: string;
  direction: "upstream" | "downstream";
  description: string;
  /** In-app route that already collects or reports data for this category, when one exists. */
  surfaceHref: string | null;
  surfaceLabel: string | null;
}

export const SCOPE3_CATEGORIES: readonly Scope3CategoryDef[] = [
  {
    number: 1,
    name: "Purchased goods and services",
    direction: "upstream",
    description:
      "Extraction, production, and transport of goods and services purchased by the reporting company, up to the point of receipt.",
    surfaceHref: "/scope3/category-1",
    surfaceLabel: "Category 1 breakdown",
  },
  {
    number: 2,
    name: "Capital goods",
    direction: "upstream",
    description:
      "Extraction, production, and transport of capital goods purchased by the reporting company in the reporting year.",
    surfaceHref: null,
    surfaceLabel: null,
  },
  {
    number: 3,
    name: "Fuel- and energy-related activities",
    direction: "upstream",
    description:
      "Emissions related to producing and transporting fuels and energy purchased by the reporting company, not already accounted for in Scope 1 or 2.",
    surfaceHref: null,
    surfaceLabel: null,
  },
  {
    number: 4,
    name: "Upstream transportation and distribution",
    direction: "upstream",
    description:
      "Transport and distribution of products purchased by the reporting company between its tier-1 suppliers and its own operations, in vehicles not owned or operated by the reporting company.",
    surfaceHref: "/scope3/freight",
    surfaceLabel: "Freight & logistics (upstream)",
  },
  {
    number: 5,
    name: "Waste generated in operations",
    direction: "upstream",
    description:
      "Disposal and treatment of waste generated in the reporting company's operations, in facilities not owned or operated by the reporting company.",
    surfaceHref: "/operations/waste-water",
    surfaceLabel: "Waste & water operations",
  },
  {
    number: 6,
    name: "Business travel",
    direction: "upstream",
    description:
      "Transport of employees for business-related activities in vehicles not owned or operated by the reporting company.",
    surfaceHref: "/scope3/travel",
    surfaceLabel: "Travel & commuting",
  },
  {
    number: 7,
    name: "Employee commuting",
    direction: "upstream",
    description: "Transport of employees between their homes and worksites.",
    surfaceHref: "/scope3/travel",
    surfaceLabel: "Travel & commuting",
  },
  {
    number: 8,
    name: "Upstream leased assets",
    direction: "upstream",
    description:
      "Operation of assets leased by the reporting company (lessee) in the reporting year, not already included in Scope 1 or 2.",
    surfaceHref: null,
    surfaceLabel: null,
  },
  {
    number: 9,
    name: "Downstream transportation and distribution",
    direction: "downstream",
    description:
      "Transport and distribution of products sold by the reporting company between its own operations and the end consumer, in vehicles not owned or operated by the reporting company.",
    surfaceHref: "/scope3/freight",
    surfaceLabel: "Freight & logistics (downstream)",
  },
  {
    number: 10,
    name: "Processing of sold products",
    direction: "downstream",
    description:
      "Processing of intermediate products sold by downstream companies (e.g. manufacturers) between the reporting company's operations and the end consumer.",
    surfaceHref: null,
    surfaceLabel: null,
  },
  {
    number: 11,
    name: "Use of sold products",
    direction: "downstream",
    description:
      "Direct use-phase emissions of products sold by the reporting company in the reporting year, over the products' expected lifetime.",
    surfaceHref: null,
    surfaceLabel: null,
  },
  {
    number: 12,
    name: "End-of-life treatment of sold products",
    direction: "downstream",
    description:
      "Waste disposal and treatment of products sold by the reporting company at the end of their life.",
    surfaceHref: null,
    surfaceLabel: null,
  },
  {
    number: 13,
    name: "Downstream leased assets",
    direction: "downstream",
    description:
      "Operation of assets owned by the reporting company and leased to other entities (lessor) in the reporting year, not already included in Scope 1 or 2.",
    surfaceHref: null,
    surfaceLabel: null,
  },
  {
    number: 14,
    name: "Franchises",
    direction: "downstream",
    description:
      "Operation of franchises not already included in Scope 1 or 2, for a reporting company that is a franchisor.",
    surfaceHref: null,
    surfaceLabel: null,
  },
  {
    number: 15,
    name: "Investments",
    direction: "downstream",
    description:
      "Operation of investments (including equity and debt investments and project finance) in the reporting year, for a reporting company that is an investor.",
    surfaceHref: "/scope3/sources",
    surfaceLabel: "Investment sources",
  },
];

const BY_NUMBER = new Map(SCOPE3_CATEGORIES.map((c) => [c.number, c]));

export function getScope3CategoryDef(number: Scope3CategoryNumber): Scope3CategoryDef {
  const def = BY_NUMBER.get(number);
  if (!def) {
    throw new Error(`Unknown Scope 3 category number: ${number}`);
  }
  return def;
}

/** Category numbers that currently lack a dedicated in-app surface (Y01 thin-surface list). */
export const SCOPE3_THIN_SURFACE_CATEGORIES: readonly Scope3CategoryNumber[] =
  SCOPE3_CATEGORIES.filter((c) => c.surfaceHref === null).map((c) => c.number);
