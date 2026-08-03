import type {
  ClearEsgEntityType,
  WorkTrackerConnectionDoc,
  WorkTrackerConnectionSummary,
  WorkTrackerProvider,
  WorkTrackerStatus,
} from "./types";
import {
  isClearEsgEntityType,
  isWorkTrackerProvider,
  isWorkTrackerStatus,
} from "./types";

function orgIdFromDoc(doc: WorkTrackerConnectionDoc): string | null {
  const raw = doc.organisationId;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

function normalizeProvider(value: unknown): WorkTrackerProvider | null {
  return isWorkTrackerProvider(value) ? value : null;
}

function normalizeStatus(value: unknown): WorkTrackerStatus {
  return isWorkTrackerStatus(value) ? value : "pending";
}

function normalizeEntityType(value: unknown): ClearEsgEntityType | null {
  return isClearEsgEntityType(value) ? value : null;
}

/** Map a Payload doc to a public summary (token stripped). */
export function mapWorkTrackerConnectionDoc(
  doc: WorkTrackerConnectionDoc | null | undefined,
): WorkTrackerConnectionSummary | null {
  if (!doc?.id) return null;
  if (!orgIdFromDoc(doc)) return null;
  const provider = normalizeProvider(doc.provider);
  if (!provider) return null;
  const label = typeof doc.label === "string" ? doc.label.trim() : "";
  const baseUrl = typeof doc.baseUrl === "string" ? doc.baseUrl.trim() : "";
  const projectOrTeamId =
    typeof doc.projectOrTeamId === "string" ? doc.projectOrTeamId.trim() : "";
  if (!label || !baseUrl || !projectOrTeamId) return null;

  return {
    id: doc.id,
    provider,
    label,
    baseUrl,
    workspaceKey: typeof doc.workspaceKey === "string" ? doc.workspaceKey : null,
    accountEmail: typeof doc.accountEmail === "string" ? doc.accountEmail : null,
    projectOrTeamId,
    projectOrTeamName:
      typeof doc.projectOrTeamName === "string" ? doc.projectOrTeamName : null,
    issueTypeName: typeof doc.issueTypeName === "string" ? doc.issueTypeName : null,
    enabled: doc.enabled !== false,
    status: normalizeStatus(doc.status),
    lastSyncAt: doc.lastSyncAt ? String(doc.lastSyncAt) : null,
    lastError: typeof doc.lastError === "string" ? doc.lastError : null,
    lastExternalId: typeof doc.lastExternalId === "string" ? doc.lastExternalId : null,
    lastExternalKey: typeof doc.lastExternalKey === "string" ? doc.lastExternalKey : null,
    lastExternalUrl: typeof doc.lastExternalUrl === "string" ? doc.lastExternalUrl : null,
    lastEntityType: normalizeEntityType(doc.lastEntityType),
    lastEntityId: typeof doc.lastEntityId === "string" ? doc.lastEntityId : null,
    hasToken: Boolean(doc.encryptedToken && String(doc.encryptedToken).length > 0),
    createdAt: doc.createdAt ? String(doc.createdAt) : null,
    updatedAt: doc.updatedAt ? String(doc.updatedAt) : null,
  };
}
