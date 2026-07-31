/** Datapoint-oriented lineage (sources → transforms → result). Not assurance figure lineage. */

export type LineageNodeKind =
  "source" | "input" | "factor" | "evidence" | "transform" | "result";

export type LineageNode = {
  id: string;
  kind: LineageNodeKind;
  label: string;
  detail: string | null;
  value: number | null;
  unit: string | null;
  quality: string | null;
  timestamp: string | null;
  actorId: string | null;
  meta: Record<string, string | number | boolean | null>;
};

export type LineageEdge = {
  id: string;
  from: string;
  to: string;
  label: string | null;
};

export type LineageGraph = {
  datapointId: string;
  metricKey: string;
  metricLabel: string | null;
  generatedAt: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  /** Node ids grouped left→right for layered SVG layout. */
  layers: string[][];
};

export type LineageVersionStep = {
  versionNumber: number;
  changeType: string;
  changedAt: string;
  changedBy: string | null;
  reason: string | null;
  oldValue: number | null;
  newValue: number | null;
  oldQuality: string | null;
  newQuality: string | null;
};

export type LineageFactorRef = {
  id: string;
  key: string;
  value: number;
  unit: string;
  source: string;
  year: number;
};

export type LineageEvidenceRef = {
  id: string;
  filename: string;
};

export type LineagePeriodInput = {
  id: string;
  metricKey: string;
  label: string | null;
  value: number | null;
  unit: string | null;
  quality: string | null;
};

export type BuildLineageInput = {
  datapointId: string;
  metricKey: string;
  metricLabel?: string | null;
  value: number | null;
  unit: string | null;
  quality: string;
  source: string;
  provenance?: string | null;
  factorId?: string | null;
  factor?: LineageFactorRef | null;
  evidence?: LineageEvidenceRef[];
  versions?: LineageVersionStep[];
  periodInputs?: LineagePeriodInput[];
  enteredBy?: string | null;
  enteredAt?: string | null;
  /** Override clock for tests. */
  generatedAt?: string;
};

export type LaidOutNode = LineageNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LineageLayout = {
  nodes: LaidOutNode[];
  edges: LineageEdge[];
  width: number;
  height: number;
};
