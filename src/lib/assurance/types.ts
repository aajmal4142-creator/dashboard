export type FindingSeverity = "critical" | "major" | "minor" | "info";
export type FindingCategory =
  "data-quality" | "methodology" | "scope" | "calculation" | "completeness" | "other";
export type FindingStatus = "open" | "acknowledged" | "resolved" | "closed";
export type AssuranceLevel = "limited" | "reasonable";
export type EngagementStatus =
  "draft" | "submitted" | "reviewing" | "findings_submitted" | "approved" | "signed_off";

export interface DataGap {
  metric: string;
  severity: "high" | "medium" | "low";
  description: string;
  framework?: string;
  affectedScope?: "scope1" | "scope2" | "scope3";
}

export interface VerificationFinding {
  id?: string;
  engagement: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  affectedMetric?: string;
  evidence?: Array<{ url: string; description?: string }>;
  impact?: "high" | "medium" | "low";
  recommendation?: string;
  status: FindingStatus;
  submittedBy: string;
  submittedAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface PathwayCheckpointProgress {
  checkpointId: string;
  completedAt?: Date | string | null;
  notes?: string | null;
}

export interface AssuranceEngagement {
  id?: string;
  organisation: string;
  reportingPeriod: string;
  provider: {
    name: string;
    email: string;
    contactPerson?: string;
    providerOrg?: string;
  };
  scope: "scope1" | "scope2" | "scope3" | "all";
  framework?: string;
  /** Selected verification pathway (limited vs reasonable). */
  assuranceLevel?: AssuranceLevel;
  /** Checkpoint completion for the selected pathway. */
  pathwayCheckpoints?: PathwayCheckpointProgress[];
  status: EngagementStatus;
  requestedAt: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  signedOffAt?: Date;
  dataGaps: DataGap[];
  notes?: string;
  createdBy: string;
  assignedTo?: string;
}

export interface FindingsSummary {
  total: number;
  critical: number;
  major: number;
  minor: number;
  info: number;
}

export interface AssuranceReport {
  id?: string;
  engagement: string;
  organisation: string;
  reportingPeriod: string;
  status: "draft" | "approved" | "published";
  assuranceLevel: AssuranceLevel;
  assuranceStatement: string;
  executiveSummary?: string;
  findingsSummary: FindingsSummary;
  provider: {
    name: string;
    credentials?: string;
    signatureDate: Date;
    signatureName: string;
  };
  generatedAt: Date;
  publishedAt?: Date;
  publishedBy?: string;
  dataGapsSummary?: Array<{
    metric: string;
    severity: "high" | "medium" | "low";
    resolution?: string;
  }>;
  assuranceScore?: number;
}

export interface SeverityLevel {
  overallSeverity: FindingSeverity;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  infoCount: number;
  score: number;
}

export interface ConfidenceReport {
  assuranceScore: number;
  assuranceLevel: AssuranceLevel;
  dataGapImpact: "high" | "medium" | "low";
  findingsRisk: "high" | "medium" | "low";
  coveragePercentage: number;
  recommendations: string[];
}

export interface ScoringContext {
  framework?: string;
  scope: "scope1" | "scope2" | "scope3" | "all";
  totalDataPoints?: number;
  coveredDataPoints?: number;
  coveragePercentage?: number;
}
