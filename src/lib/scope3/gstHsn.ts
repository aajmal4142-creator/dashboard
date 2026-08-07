/**
 * India GST HSN/SAC → Scope 3 spend mapper. Feature Y04.
 * Pure. Zero I/O.
 *
 * HSN (Harmonized System of Nomenclature, goods) and SAC (Services Accounting
 * Code, services — always prefixed "99") are the codes required on every
 * Indian GST invoice/e-invoice line. This module maps a curated, documented
 * set of chapter/heading prefixes to a suggested GHG Protocol Scope 3
 * category and a spend-ledger bucket (see lib/calc/spendBasedEmissions.ts),
 * for feeding the existing spend-based estimation path.
 *
 * These are heuristics, not a certified classification: many HSN chapters
 * span goods with genuinely different Scope 3 treatment (e.g. is a chapter-84
 * machine a capital purchase or a purchased good for resale?). Where the
 * spend-ledger enum has no dedicated bucket for the correct nuance (there is
 * no "capital_goods" ledger category), we say so in `note` rather than
 * silently mis-bucketing. Every chapter/decade carries an explicit
 * `confidence` — chapter-specific overrides are "medium"/"high", broad
 * decade-level fallbacks are always "low" so callers never mistake a guess
 * for a documented match. Malformed codes (not 2–8 digits) return `null` —
 * we never invent a mapping for input we can't even parse.
 *
 * Source: CBIC HSN chapter structure (customs tariff) and GST SAC chapter 99
 * heading structure, both public.
 */

import type { Scope3CategoryNumber } from "./categories";
import type { SpendLedgerCategory } from "@/lib/calc/spendBasedEmissions";

export interface GstHsnMappingEntry {
  /** HSN/SAC prefix to match (digits only). Longest matching prefix wins. */
  prefix: string;
  description: string;
  scope3Category: Scope3CategoryNumber;
  spendLedgerCategory: SpendLedgerCategory;
  confidence: "high" | "medium" | "low";
  /** Notes a known limitation of the heuristic (e.g. ledger bucket mismatch). */
  note?: string;
}

/**
 * Curated HSN (goods, chapters 01–98) and SAC (services, chapter 99) table.
 * Ordered by prefix length is not required — lookup always picks the
 * longest matching prefix regardless of table order.
 */
export const GST_HSN_MAPPING_TABLE: readonly GstHsnMappingEntry[] = [
  // --- Goods (HSN, chapters 01–98) ---
  //
  // Decade fallbacks: HSN chapters group into "decades" by leading digit
  // (leading "1" = chapters 10–19, etc). Goods within a decade are similar
  // enough to bucket at *low* confidence when no more specific chapter
  // override matches below (longer prefixes always win — see
  // `mapHsnToScope3`). This keeps every valid-format code mapped to
  // *something* honest rather than silently unmapped, while never claiming
  // more confidence than a decade-level guess deserves.
  {
    prefix: "0",
    description: "Chapters 01–09: live animals, meat, fish, dairy, other animal products",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
  },
  {
    prefix: "1",
    description: "Chapters 10–19: cereals, milling products, oil seeds, fats/oils, sugar",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
  },
  {
    prefix: "2",
    description:
      "Chapters 20–29: beverages, tobacco, mineral products, chemicals (fallback)",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
  },
  {
    prefix: "3",
    description: "Chapters 30–39: pharma, chemicals, plastics/rubber (fallback)",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
  },
  {
    prefix: "4",
    description: "Chapters 40–49: rubber, leather, wood, cork, pulp, paper (fallback)",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
  },
  {
    prefix: "5",
    description: "Chapters 50–59: textiles, textile yarns and fabrics",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
  },
  {
    prefix: "6",
    description: "Chapters 60–69: textile articles, footwear, headgear, stone/ceramic",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
  },
  {
    prefix: "7",
    description: "Chapters 70–79: glass, precious stones/metals, base metals (fallback)",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
  },
  {
    prefix: "8",
    description: "Chapters 80–83: base metal articles, tools, cutlery (fallback)",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
  },
  {
    prefix: "9",
    description:
      "Chapters 90–98: instruments, arms, toys, art, misc manufactured (fallback)",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
  },

  // Chapter-level overrides — a clearer signal than the decade fallback,
  // so listed with a longer (more specific) prefix that wins the match.
  {
    prefix: "27",
    description: "Mineral fuels, mineral oils, and products of their distillation",
    scope3Category: 3,
    spendLedgerCategory: "fuel_energy",
    confidence: "high",
  },
  {
    prefix: "2716",
    description: "Electrical energy",
    scope3Category: 3,
    spendLedgerCategory: "fuel_energy",
    confidence: "high",
  },
  {
    prefix: "3923",
    description: "Plastic packing/conveying articles (boxes, cases, bottles, closures)",
    scope3Category: 1,
    spendLedgerCategory: "packaging",
    confidence: "high",
  },
  {
    prefix: "48",
    description: "Paper and paperboard (commonly used as packaging)",
    scope3Category: 1,
    spendLedgerCategory: "packaging",
    confidence: "medium",
  },
  {
    prefix: "71",
    description: "Precious/semi-precious stones, metals, jewellery",
    scope3Category: 1,
    spendLedgerCategory: "raw_materials",
    confidence: "medium",
  },
  // Chapters 84–89: machinery, electrical/electronic equipment, and vehicles
  // are capital goods (Cat 2) in most B2B contexts, but the spend ledger has
  // no dedicated capital-goods bucket — filed under the closest available
  // one and documented via `note`.
  {
    prefix: "8471",
    description: "Computers and automatic data-processing machines",
    scope3Category: 2,
    spendLedgerCategory: "it",
    confidence: "high",
  },
  {
    prefix: "8517",
    description: "Telephone sets, network/communication apparatus",
    scope3Category: 2,
    spendLedgerCategory: "it",
    confidence: "high",
  },
  {
    prefix: "84",
    description: "Nuclear reactors, boilers, machinery and mechanical appliances",
    scope3Category: 2,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
    note: "Treated as capital goods (Cat 2); no dedicated capital-goods spend-ledger bucket exists yet, so filed under raw_materials pending one.",
  },
  {
    prefix: "85",
    description:
      "Electrical machinery and equipment (excl. computers/telecom, listed above)",
    scope3Category: 2,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
    note: "Treated as capital goods (Cat 2); no dedicated capital-goods spend-ledger bucket exists yet, so filed under raw_materials pending one.",
  },
  {
    prefix: "86",
    description: "Railway or tramway locomotives and rolling stock",
    scope3Category: 2,
    spendLedgerCategory: "transportation",
    confidence: "low",
    note: "Assumes vehicle purchase (capital goods, Cat 2); filed under the transportation ledger bucket as the closest available match.",
  },
  {
    prefix: "87",
    description: "Vehicles other than railway/tramway rolling stock",
    scope3Category: 2,
    spendLedgerCategory: "transportation",
    confidence: "low",
    note: "Assumes vehicle purchase (capital goods, Cat 2); filed under the transportation ledger bucket as the closest available match.",
  },
  {
    prefix: "88",
    description: "Aircraft, spacecraft, and parts thereof",
    scope3Category: 2,
    spendLedgerCategory: "transportation",
    confidence: "low",
    note: "Assumes vehicle purchase (capital goods, Cat 2); filed under the transportation ledger bucket as the closest available match.",
  },
  {
    prefix: "89",
    description: "Ships, boats, and floating structures",
    scope3Category: 2,
    spendLedgerCategory: "transportation",
    confidence: "low",
    note: "Assumes vehicle purchase (capital goods, Cat 2); filed under the transportation ledger bucket as the closest available match.",
  },
  // Chapter 94: furniture — commonly capital goods (office fit-out).
  {
    prefix: "94",
    description: "Furniture, lighting fittings, prefabricated buildings",
    scope3Category: 2,
    spendLedgerCategory: "raw_materials",
    confidence: "low",
    note: "Treated as capital goods (Cat 2); no dedicated capital-goods spend-ledger bucket exists yet.",
  },

  // --- Services (SAC — all codes begin "99"; HSN chapters never reach 99) ---
  {
    prefix: "99",
    description: "Unclassified services heading (SAC fallback)",
    scope3Category: 1,
    spendLedgerCategory: "services",
    confidence: "low",
  },
  {
    prefix: "9954",
    description: "Construction services",
    scope3Category: 2,
    spendLedgerCategory: "facilities",
    confidence: "low",
  },
  {
    prefix: "9963",
    description: "Accommodation, food and beverage services",
    scope3Category: 6,
    spendLedgerCategory: "services",
    confidence: "high",
  },
  {
    prefix: "9964",
    description: "Passenger transport services",
    scope3Category: 6,
    spendLedgerCategory: "services",
    confidence: "high",
  },
  {
    prefix: "9965",
    description: "Goods transport services",
    scope3Category: 4,
    spendLedgerCategory: "transportation",
    confidence: "high",
  },
  {
    prefix: "9966",
    description: "Rental services of transport vehicles (with operator)",
    scope3Category: 4,
    spendLedgerCategory: "transportation",
    confidence: "medium",
  },
  {
    prefix: "9967",
    description: "Supporting transport services (cargo handling, storage, agency)",
    scope3Category: 4,
    spendLedgerCategory: "transportation",
    confidence: "medium",
  },
  {
    prefix: "9971",
    description: "Financial and related services",
    scope3Category: 15,
    spendLedgerCategory: "services",
    confidence: "low",
  },
  {
    prefix: "9972",
    description: "Real estate services",
    scope3Category: 8,
    spendLedgerCategory: "facilities",
    confidence: "medium",
  },
  {
    prefix: "9973",
    description: "Leasing / rental services without operator (equipment, property)",
    scope3Category: 8,
    spendLedgerCategory: "facilities",
    confidence: "high",
  },
  {
    prefix: "9982",
    description: "Legal, accounting, and other professional services",
    scope3Category: 1,
    spendLedgerCategory: "services",
    confidence: "medium",
  },
  {
    prefix: "9983",
    description: "Other professional, technical, and business services",
    scope3Category: 1,
    spendLedgerCategory: "services",
    confidence: "medium",
  },
  {
    prefix: "9985",
    description: "Support services (employment, travel agency, security, cleaning)",
    scope3Category: 1,
    spendLedgerCategory: "services",
    confidence: "low",
  },
  {
    prefix: "9987",
    description: "Maintenance, repair, and installation services",
    scope3Category: 1,
    spendLedgerCategory: "services",
    confidence: "medium",
  },
  {
    prefix: "9994",
    description: "Sewage, waste collection, treatment, and disposal services",
    scope3Category: 5,
    spendLedgerCategory: "waste",
    confidence: "high",
  },
];

function normaliseCode(code: string): string {
  return code.trim().replace(/\s+/g, "");
}

/**
 * Suggests a Scope 3 category + spend-ledger bucket for an HSN/SAC code by
 * longest-prefix match against the curated table. Returns `null` for codes
 * we have not documented — never invents a guess.
 */
export function mapHsnToScope3(code: string): GstHsnMappingEntry | null {
  const normalised = normaliseCode(code);
  if (!/^\d{2,8}$/.test(normalised)) return null;

  let best: GstHsnMappingEntry | null = null;
  for (const entry of GST_HSN_MAPPING_TABLE) {
    if (normalised.startsWith(entry.prefix)) {
      if (!best || entry.prefix.length > best.prefix.length) {
        best = entry;
      }
    }
  }
  return best;
}

/** Datapoint metricKey convention already used by the spend-based ingest path. */
export function spendMetricKeyForLedger(ledger: SpendLedgerCategory): string {
  return `emissions.spend.${ledger}`;
}

export interface GstInvoiceLine {
  hsnCode: string;
  amount: number;
  description?: string;
}

export interface GstInvoiceLineMapping {
  hsnCode: string;
  amount: number;
  description: string | null;
  mapped: boolean;
  scope3Category: Scope3CategoryNumber | null;
  spendLedgerCategory: SpendLedgerCategory | null;
  metricKey: string | null;
  confidence: "high" | "medium" | "low" | null;
  note: string | null;
  /** Present so callers can label the ingest row honestly (never a fabricated figure). */
  quality: "estimated" | "unmapped";
}

export function mapGstInvoiceLine(line: GstInvoiceLine): GstInvoiceLineMapping {
  const mapping = mapHsnToScope3(line.hsnCode);
  if (!mapping) {
    return {
      hsnCode: line.hsnCode,
      amount: line.amount,
      description: line.description ?? null,
      mapped: false,
      scope3Category: null,
      spendLedgerCategory: null,
      metricKey: null,
      confidence: null,
      note: "No documented mapping for this HSN/SAC code.",
      quality: "unmapped",
    };
  }
  return {
    hsnCode: line.hsnCode,
    amount: line.amount,
    description: line.description ?? null,
    mapped: true,
    scope3Category: mapping.scope3Category,
    spendLedgerCategory: mapping.spendLedgerCategory,
    metricKey: spendMetricKeyForLedger(mapping.spendLedgerCategory),
    confidence: mapping.confidence,
    note: mapping.note ?? null,
    quality: "estimated",
  };
}

export function mapGstInvoiceLines(
  lines: readonly GstInvoiceLine[],
): GstInvoiceLineMapping[] {
  return lines.map(mapGstInvoiceLine);
}

export interface GstCsvParseError {
  rowNumber: number;
  field: string;
  value: unknown;
  error: string;
}

export interface GstCsvParseResult {
  valid: boolean;
  lines: GstInvoiceLine[];
  errors: GstCsvParseError[];
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function headerIndex(headers: string[], aliases: string[]): number {
  const normalised = headers.map((h) => h.toLowerCase().replace(/[\s-]+/g, "_"));
  for (const alias of aliases) {
    const idx = normalised.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parses a pasted GST invoice-line CSV: hsn_code (or hsn/sac), amount
 * (taxable value), and an optional description column.
 */
export function parseGstInvoiceCsv(csvContent: string): GstCsvParseResult {
  const lines = csvContent
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      valid: false,
      lines: [],
      errors: [
        {
          rowNumber: 1,
          field: "csv",
          value: "",
          error: "CSV must include a header row and at least one data row",
        },
      ],
    };
  }

  const headers = splitCsvLine(lines[0]!);
  const col = {
    hsnCode: headerIndex(headers, ["hsn_code", "hsn", "sac", "hsn_sac"]),
    amount: headerIndex(headers, ["amount", "taxable_value", "value", "invoice_amount"]),
    description: headerIndex(headers, ["description", "item", "particulars"]),
  };

  if (col.hsnCode < 0) {
    return {
      valid: false,
      lines: [],
      errors: [
        {
          rowNumber: 1,
          field: "hsn_code",
          value: null,
          error: "Missing required column: hsn_code (or hsn/sac)",
        },
      ],
    };
  }
  if (col.amount < 0) {
    return {
      valid: false,
      lines: [],
      errors: [
        {
          rowNumber: 1,
          field: "amount",
          value: null,
          error: "Missing required column: amount (or taxable_value)",
        },
      ],
    };
  }

  const result: GstInvoiceLine[] = [];
  const errors: GstCsvParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cells = splitCsvLine(lines[i]!);
    const cell = (idx: number): string => (idx >= 0 ? (cells[idx] ?? "").trim() : "");

    const hsnCode = cell(col.hsnCode);
    const amountRaw = cell(col.amount);
    const amount = Number(amountRaw);
    const description = cell(col.description) || undefined;

    if (!hsnCode) {
      errors.push({
        rowNumber,
        field: "hsn_code",
        value: hsnCode,
        error: "hsn_code is required",
      });
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({
        rowNumber,
        field: "amount",
        value: amountRaw,
        error: "amount must be a positive number",
      });
      continue;
    }

    result.push({ hsnCode, amount, description });
  }

  return { valid: errors.length === 0, lines: result, errors };
}
