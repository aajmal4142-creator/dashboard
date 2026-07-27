import type { CalmLevel } from "@/lib/governance/calmStatus";

export type RunwayAction = {
  label: string;
  need: string;
  href: string;
  meta: string;
  metricKey: string;
};

export type RunwaySecondaryObligation = {
  id: string;
  standardVersion: string;
  filingDeadline: string | null;
};

export type RunwayAnomaly = {
  metricKey: string;
  reason: string;
};

export type RunwayViewProps = {
  periodLabel: string | null;
  calm: { level: CalmLevel; label: string; hint: string };
  primaryAction: RunwayAction;
  days: number | null;
  filingOverdue: boolean;
  deadlineIso: string | null;
  standardVersion: string | null;
  wave: string | null;
  readiness: { pct: number; label: string; detail: string };
  coveragePct: number | null;
  pendingApproval: number;
  assignedCount: number;
  overdueCount: number;
  collected: number;
  required: number;
  projectedMiss: number;
  calcOk: boolean;
  overall: number;
  scope1: number;
  scope2: number;
  scope3: number;
  s1Pct: number;
  s2Pct: number;
  s3Pct: number;
  totalEmissions: number;
  primarySharePct: number;
  hasScope3Composition: boolean;
  nextActions: RunwayAction[];
  approvalByMetric: Record<string, string>;
  anomalies: RunwayAnomaly[];
  secondary: RunwaySecondaryObligation[];
  derivationReason: string | null;
  hasObligation: boolean;
  obligationId: string | null;
  canManage: boolean;
  needsConfirmation: boolean;
  baselineDrift: boolean;
  obligationSource: "engine" | "manual" | null;
  baselineIncomplete: boolean;
  missingCountry: boolean;
  missingHeadcount: boolean;
  missingRevenue: boolean;
};
