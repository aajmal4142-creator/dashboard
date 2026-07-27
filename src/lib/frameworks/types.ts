/**
 * Framework coverage types — Phase 3.
 *
 * Payload field name remains `datapointRef` (no migration rename).
 * In application TypeScript and UI copy, that value is the **disclosure code**.
 * `disclosureCode` is exported as an alias so it is never mistaken for a missing field.
 */

export type FrameworkId =
  | "CSRD_SET1"
  | "CSRD_SIMPLIFIED"
  | "BRSR"
  | "VSME"
  | "GRI"
  | "ISSB_S1"
  | "ISSB_S2"
  | "EU_TAXONOMY";

/** Alias of Payload `datapointRef` — the disclosure / datapoint identifier. */
export type DisclosureCode = string;

export type DatapointProvenance = "supplier_primary" | "spend_estimate" | "manual";

export type CoverageState = "satisfied" | "partial" | "contributes" | "gap";

/**
 * Reviewable mapping row. `datapointRef` ≡ disclosureCode.
 * contributionOnly default true in schema — “contributes to” ≠ “satisfies”.
 */
export type FrameworkMappingRow = {
  framework: FrameworkId;
  /** Payload field name; product alias: disclosureCode. */
  datapointRef: DisclosureCode;
  /** Human disclosure name (placeholder pending counsel). */
  label: string;
  required: boolean;
  /**
   * When true, data can at best “contribute” — never green “satisfied”.
   * Default true for placeholders; set false only when the mapping can satisfy.
   */
  contributionOnly: boolean;
  /**
   * Metric keys (raw or derived.*) whose grades feed this disclosure.
   * Any present key is considered; worst grade across present keys wins.
   */
  metricKeys: string[];
  /** Optional counsel / source citation. */
  note?: string;
};

/** Product-facing alias — same string as datapointRef. */
export function disclosureCodeOf(
  row: Pick<FrameworkMappingRow, "datapointRef">,
): DisclosureCode {
  return row.datapointRef;
}

export type DatapointGradeInput = {
  metricKey: string;
  quality: "measured" | "calculated" | "estimated" | "missing";
  provenance?: DatapointProvenance | null;
};

export type DisclosureCoverage = {
  framework: FrameworkId;
  disclosureCode: DisclosureCode;
  label: string;
  state: CoverageState;
  required: boolean;
  contributionOnly: boolean;
};

export type FrameworkCoverageSummary = {
  framework: FrameworkId;
  total: number;
  satisfied: number;
  partial: number;
  contributes: number;
  gap: number;
  /** 0–100 integers; denominator = total disclosures in this framework slice. */
  pctSatisfied: number;
  pctPartial: number;
  pctGap: number;
};
