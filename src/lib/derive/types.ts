export type Quality = "measured" | "calculated" | "estimated" | "missing";

export type RawInputs = {
  electricity_kwh: number | null;
  electricity_renewable_pct: number | null;
  diesel_litres: number | null;
  natural_gas_m3: number | null;
  petrol_litres: number | null;
  district_heat_kwh: number | null;
};

export type DerivedQuality = Quality;

export type DerivedValue = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  quality: DerivedQuality;
  /** Raw metric keys that fed this derivation. */
  inputs: string[];
  formula: string;
  missingInputs: string[];
};

export type FrameworkMapping = {
  framework:
    | "CSRD_SET1"
    | "CSRD_SIMPLIFIED"
    | "BRSR"
    | "VSME"
    | "GRI"
    | "ISSB_S1"
    | "ISSB_S2"
    | "EU_TAXONOMY";
  /** Disclosure code (product alias: disclosureCode). */
  datapointRef: string;
  /** Human disclosure name. */
  label: string;
  required: boolean;
  /** When true, contributes only — never alone satisfies. */
  contributionOnly: boolean;
  validFrom: string | null;
  validUntil: string | null;
  sourceDoc: string;
  sourceSheet: string;
  sourceRow: number;
  extractedAt: string;
  approved: true;
};

export type DerivedMetricDefinition = {
  key: string;
  label: string;
  unit: string;
  description: string;
  frameworkMappings: FrameworkMapping[];
};
