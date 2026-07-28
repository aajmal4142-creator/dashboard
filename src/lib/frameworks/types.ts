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

// ─────────────────────────────────────────────────────────────────────
// Days 16-25: ESG Frameworks & Compliance Types
// ─────────────────────────────────────────────────────────────────────

export type ESGFramework = "csrd" | "brsr" | "gri" | "sasb";

export interface FrameworkMetric {
  id: string;
  framework: ESGFramework;
  metricKey: string; // e.g., "csrd_scope1_intensity"
  label: string;
  unit: string; // "tCO2e", "tCO2e/€M revenue", "kg CO2e/unit"
  description?: string;
  dataType: "emissions" | "intensity" | "percentage" | "custom";
  required: boolean;
}

export interface FrameworkMetricValue {
  metricKey: string;
  value: number;
  unit: string;
  confidence: "high" | "medium" | "low";
  calculatedAt: Date;
}

export interface ComplianceTarget {
  id: string;
  framework: ESGFramework;
  metricKey: string;
  targetValue: number;
  baselineYear: number;
  targetYear: number;
  status: "on-track" | "at-risk" | "off-track";
}

export interface FrameworkMapping {
  id: string;
  framework: ESGFramework;
  periodId: string;
  organisationId: string;
  emissionsData: {
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
  };
  metadata?: {
    revenue?: number;
    employees?: number;
    units?: number;
  };
  metrics: FrameworkMetricValue[];
  complianceStatus?: string;
  calculatedAt: Date;
}

export interface ComplianceScore {
  framework: ESGFramework;
  score: number; // 0-100
  metricsProvided: number;
  metricsRequired: number;
  status: "compliant" | "partial" | "non-compliant";
}

export interface AuditResult {
  framework: ESGFramework;
  missingMetrics: string[];
  dataGaps: DataGap[];
  anomalies: Anomaly[];
  confidenceLevel: number; // 0-100
}

export interface DataGap {
  metricKey: string;
  label: string;
  impact: "high" | "medium" | "low";
  estimatedImpactOnScore: number; // 0-100
}

export interface Anomaly {
  metricKey: string;
  value: number;
  expected: number;
  deviation: number;
  severity: "low" | "medium" | "high";
}

export interface TrajectoryAnalysis {
  framework: ESGFramework;
  currentValue: number;
  targetValue: number;
  targetYear: number;
  projectedValue: number;
  onTrack: boolean;
  yearsUntilTarget?: number;
  trendPercentChange: number; // year-over-year %
}

export interface ChecklistItem {
  id: string;
  category: string;
  task: string;
  required: boolean;
  completed: boolean;
  priority: "high" | "medium" | "low";
  estimatedEffort?: string; // e.g., "2 hours", "1 day"
}

export interface FrameworkReport {
  framework: ESGFramework;
  periodId: string;
  generatedAt: Date;
  metrics: FrameworkMetricValue[];
  complianceScore: ComplianceScore;
  targets: ComplianceTarget[];
  trajectory: TrajectoryAnalysis;
  dataGaps: DataGap[];
  checklist: ChecklistItem[];
}

export interface ComplianceStatement {
  framework: ESGFramework;
  periodId: string;
  statement: string;
  score: number;
  status: string;
  nextSteps: string[];
}

export interface SummaryReport {
  periodId: string;
  generatedAt: Date;
  overallCompliance: number; // average across frameworks
  frameworks: Record<ESGFramework, ComplianceScore>;
  highlights: string[];
  recommendations: string[];
}
