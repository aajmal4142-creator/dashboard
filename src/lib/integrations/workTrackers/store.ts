import type { Payload, Where } from "payload";

import type {
  ClearEsgEntityType,
  WorkTrackerConnectionDoc,
  WorkTrackerProvider,
  WorkTrackerStatus,
} from "./types";

type FindArgs = {
  where: Where;
  limit?: number;
  sort?: string;
  depth?: number;
};

type FindResult = {
  docs: WorkTrackerConnectionDoc[];
  totalDocs: number;
};

type MutateResult = WorkTrackerConnectionDoc & { id: string };

export type CreateWorkTrackerConnectionData = {
  organisationId: string;
  provider: WorkTrackerProvider;
  label: string;
  baseUrl: string;
  workspaceKey?: string | null;
  accountEmail?: string | null;
  encryptedToken: string;
  projectOrTeamId: string;
  projectOrTeamName?: string | null;
  issueTypeName?: string | null;
  enabled?: boolean;
  status: WorkTrackerStatus;
  lastSyncAt?: string | null;
  lastError?: string | null;
  lastExternalId?: string | null;
  lastExternalKey?: string | null;
  lastExternalUrl?: string | null;
  lastEntityType?: ClearEsgEntityType | null;
  lastEntityId?: string | null;
  createdBy?: string | null;
};

export type UpdateWorkTrackerConnectionData = Partial<CreateWorkTrackerConnectionData>;

/** Narrow Payload ops for work-tracker-connections (may precede generated types). */
export async function findWorkTrackerConnections(
  payload: Payload,
  args: FindArgs,
): Promise<FindResult> {
  return (
    payload.find as (a: {
      collection: "work-tracker-connections";
      where: Where;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess: true;
    }) => Promise<FindResult>
  )({
    collection: "work-tracker-connections",
    where: args.where,
    limit: args.limit,
    sort: args.sort,
    depth: args.depth ?? 0,
    overrideAccess: true,
  });
}

export async function findWorkTrackerConnectionById(
  payload: Payload,
  id: string,
): Promise<MutateResult> {
  return (
    payload.findByID as (a: {
      collection: "work-tracker-connections";
      id: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "work-tracker-connections",
    id,
    depth: 0,
    overrideAccess: true,
  });
}

export async function createWorkTrackerConnection(
  payload: Payload,
  data: CreateWorkTrackerConnectionData,
): Promise<MutateResult> {
  return (
    payload.create as (a: {
      collection: "work-tracker-connections";
      data: CreateWorkTrackerConnectionData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "work-tracker-connections",
    data,
    overrideAccess: true,
  });
}

export async function updateWorkTrackerConnection(
  payload: Payload,
  id: string,
  data: UpdateWorkTrackerConnectionData,
): Promise<MutateResult> {
  return (
    payload.update as (a: {
      collection: "work-tracker-connections";
      id: string;
      data: UpdateWorkTrackerConnectionData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "work-tracker-connections",
    id,
    data,
    overrideAccess: true,
  });
}

export async function deleteWorkTrackerConnection(
  payload: Payload,
  id: string,
): Promise<void> {
  await (
    payload.delete as (a: {
      collection: "work-tracker-connections";
      id: string;
      overrideAccess: true;
    }) => Promise<unknown>
  )({
    collection: "work-tracker-connections",
    id,
    overrideAccess: true,
  });
}

export async function writeWorkTrackerSyncLog(
  payload: Payload,
  data: {
    organisationId: string;
    integrationId: string;
    provider: "jira" | "linear";
    status: "success" | "partial" | "failed";
    recordsProcessed: number;
    recordsFailed: number;
    details: Record<string, unknown>;
    errors?: Array<{ message: string; recordId?: string }>;
    syncDurationMs: number;
    triggeredBy: string;
  },
): Promise<void> {
  await (
    payload.create as (a: {
      collection: "integration-sync-logs";
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<unknown>
  )({
    collection: "integration-sync-logs",
    data: {
      organisationId: data.organisationId,
      integrationId: data.integrationId,
      provider: data.provider,
      status: data.status,
      recordsProcessed: data.recordsProcessed,
      recordsFailed: data.recordsFailed,
      details: data.details,
      errors: data.errors,
      syncDurationMs: data.syncDurationMs,
      triggeredBy: data.triggeredBy,
    },
    overrideAccess: true,
  });
}
