export const WORK_TRACKER_PROVIDERS = ["jira", "linear"] as const;
export type WorkTrackerProvider = (typeof WORK_TRACKER_PROVIDERS)[number];

export const WORK_TRACKER_STATUSES = [
  "pending",
  "connected",
  "failed",
  "disconnected",
] as const;
export type WorkTrackerStatus = (typeof WORK_TRACKER_STATUSES)[number];

export const CLEAR_ESG_ENTITY_TYPES = [
  "internal_request",
  "compliance_obligation",
] as const;
export type ClearEsgEntityType = (typeof CLEAR_ESG_ENTITY_TYPES)[number];

/** Canonical ClearESG task shape fed into pure provider mappers. */
export type ClearEsgTask = {
  entityType: ClearEsgEntityType;
  entityId: string;
  title: string;
  description: string;
  dueDate: string | null;
  status: string | null;
  organisationName: string | null;
  sourceUrl: string | null;
};

export type WorkTrackerConnectionSummary = {
  id: string;
  provider: WorkTrackerProvider;
  label: string;
  baseUrl: string;
  workspaceKey: string | null;
  accountEmail: string | null;
  projectOrTeamId: string;
  projectOrTeamName: string | null;
  issueTypeName: string | null;
  enabled: boolean;
  status: WorkTrackerStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  lastExternalId: string | null;
  lastExternalKey: string | null;
  lastExternalUrl: string | null;
  lastEntityType: ClearEsgEntityType | null;
  lastEntityId: string | null;
  hasToken: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkTrackerConnectionDoc = {
  id: string;
  organisationId?: string | { id: string } | null;
  provider?: string | null;
  label?: string | null;
  baseUrl?: string | null;
  workspaceKey?: string | null;
  accountEmail?: string | null;
  encryptedToken?: string | null;
  projectOrTeamId?: string | null;
  projectOrTeamName?: string | null;
  issueTypeName?: string | null;
  enabled?: boolean | null;
  status?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  lastExternalId?: string | null;
  lastExternalKey?: string | null;
  lastExternalUrl?: string | null;
  lastEntityType?: string | null;
  lastEntityId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PushableSourceItem = {
  entityType: ClearEsgEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
  dueDate: string | null;
  status: string | null;
};

export function isWorkTrackerProvider(value: unknown): value is WorkTrackerProvider {
  return value === "jira" || value === "linear";
}

export function isClearEsgEntityType(value: unknown): value is ClearEsgEntityType {
  return value === "internal_request" || value === "compliance_obligation";
}

export function isWorkTrackerStatus(value: unknown): value is WorkTrackerStatus {
  return (
    value === "pending" ||
    value === "connected" ||
    value === "failed" ||
    value === "disconnected"
  );
}
