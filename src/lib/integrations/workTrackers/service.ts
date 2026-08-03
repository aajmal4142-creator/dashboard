import type { Payload } from "payload";

import { encryptToken, decryptToken } from "@/lib/integrations/accounting/tokens";
import { createJiraIssue, testJiraConnection } from "@/lib/integrations/jira/client";
import { mapClearEsgTaskToJiraIssue } from "@/lib/integrations/jira/map";
import {
  createLinearIssue,
  testLinearConnection,
} from "@/lib/integrations/linear/client";
import { mapClearEsgTaskToLinearIssue } from "@/lib/integrations/linear/map";

import { mapWorkTrackerConnectionDoc } from "./map";
import { sanitizeWorkTrackerError } from "./sanitize";
import {
  createWorkTrackerConnection,
  deleteWorkTrackerConnection,
  findWorkTrackerConnectionById,
  findWorkTrackerConnections,
  updateWorkTrackerConnection,
  writeWorkTrackerSyncLog,
  type CreateWorkTrackerConnectionData,
  type UpdateWorkTrackerConnectionData,
} from "./store";
import type {
  ClearEsgEntityType,
  ClearEsgTask,
  PushableSourceItem,
  WorkTrackerConnectionDoc,
  WorkTrackerConnectionSummary,
  WorkTrackerProvider,
} from "./types";
import { isClearEsgEntityType, isWorkTrackerProvider } from "./types";

const DEFAULT_LINEAR_BASE = "https://api.linear.app";

function orgIdOf(doc: WorkTrackerConnectionDoc): string | null {
  const raw = doc.organisationId;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

function normalizeBaseUrl(provider: WorkTrackerProvider, raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (provider === "linear") {
    if (!trimmed) return DEFAULT_LINEAR_BASE;
    return trimmed;
  }
  return trimmed;
}

function assertProviderBaseUrl(provider: WorkTrackerProvider, baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("baseUrl is invalid");
  }
  if (url.protocol !== "https:") {
    throw new Error("baseUrl must use HTTPS");
  }
  const host = url.hostname.toLowerCase();
  if (provider === "jira") {
    const ok =
      host === "api.atlassian.com" ||
      host.endsWith(".atlassian.net") ||
      host === "atlassian.net";
    if (!ok) {
      throw new Error("Jira baseUrl must be *.atlassian.net or api.atlassian.com");
    }
    return;
  }
  if (host !== "api.linear.app") {
    throw new Error("Linear baseUrl must be https://api.linear.app");
  }
}

export type ConnectWorkTrackerInput = {
  provider: WorkTrackerProvider;
  label: string;
  baseUrl?: string | null;
  workspaceKey?: string | null;
  accountEmail?: string | null;
  apiToken: string;
  projectOrTeamId: string;
  projectOrTeamName?: string | null;
  issueTypeName?: string | null;
  enabled?: boolean;
  testBeforeSave?: boolean;
};

export async function listWorkTrackerConnectionsForOrg(
  payload: Payload,
  organisationId: string,
): Promise<WorkTrackerConnectionSummary[]> {
  const result = await findWorkTrackerConnections(payload, {
    where: { organisationId: { equals: organisationId } },
    limit: 50,
    sort: "-updatedAt",
  });
  return result.docs
    .map((d) => mapWorkTrackerConnectionDoc(d))
    .filter((d): d is WorkTrackerConnectionSummary => Boolean(d));
}

export async function getOrgWorkTrackerConnection(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<WorkTrackerConnectionDoc | null> {
  try {
    const doc = await findWorkTrackerConnectionById(payload, id);
    if (orgIdOf(doc) !== organisationId) return null;
    return doc;
  } catch {
    return null;
  }
}

async function runProviderTest(input: {
  provider: WorkTrackerProvider;
  baseUrl: string;
  accountEmail: string | null;
  apiToken: string;
}): Promise<{ ok: true; detail: string } | { ok: false; message: string }> {
  if (input.provider === "jira") {
    const result = await testJiraConnection({
      baseUrl: input.baseUrl,
      email: input.accountEmail || "",
      apiToken: input.apiToken,
    });
    if (!result.ok) return result;
    return {
      ok: true,
      detail: `Authenticated as ${result.myself.displayName || result.myself.accountId}`,
    };
  }

  const result = await testLinearConnection({
    baseUrl: input.baseUrl,
    apiToken: input.apiToken,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    detail: `Authenticated as ${result.viewer.name || result.viewer.id}`,
  };
}

export async function createWorkTrackerConnectionForOrg(
  payload: Payload,
  args: {
    organisationId: string;
    userId: string;
    input: ConnectWorkTrackerInput;
  },
): Promise<
  | { ok: true; connection: WorkTrackerConnectionSummary }
  | { ok: false; message: string; status: number }
> {
  const { input } = args;
  if (!isWorkTrackerProvider(input.provider)) {
    return { ok: false, message: "provider must be jira or linear", status: 400 };
  }

  const label = input.label.trim();
  const projectOrTeamId = input.projectOrTeamId.trim();
  const apiToken = input.apiToken.trim();
  if (!label || !projectOrTeamId || !apiToken) {
    return {
      ok: false,
      message: "label, projectOrTeamId, and apiToken are required",
      status: 400,
    };
  }

  const baseUrl = normalizeBaseUrl(input.provider, input.baseUrl || "");
  if (input.provider === "jira" && !baseUrl) {
    return {
      ok: false,
      message: "Jira baseUrl is required (e.g. https://your-site.atlassian.net)",
      status: 400,
    };
  }

  try {
    assertProviderBaseUrl(input.provider, baseUrl);
  } catch (err) {
    return { ok: false, message: sanitizeWorkTrackerError(err), status: 400 };
  }

  const accountEmail =
    typeof input.accountEmail === "string" ? input.accountEmail.trim() : "";
  if (input.provider === "jira" && !accountEmail) {
    return {
      ok: false,
      message: "Jira accountEmail is required for API token auth",
      status: 400,
    };
  }

  const shouldTest = input.testBeforeSave !== false;
  if (shouldTest) {
    const tested = await runProviderTest({
      provider: input.provider,
      baseUrl,
      accountEmail: accountEmail || null,
      apiToken,
    });
    if (!tested.ok) {
      return { ok: false, message: tested.message, status: 422 };
    }
  }

  let encryptedToken: string;
  try {
    encryptedToken = encryptToken(apiToken);
  } catch (err) {
    return { ok: false, message: sanitizeWorkTrackerError(err), status: 500 };
  }

  const data: CreateWorkTrackerConnectionData = {
    organisationId: args.organisationId,
    provider: input.provider,
    label,
    baseUrl,
    workspaceKey: input.workspaceKey?.trim() || null,
    accountEmail: accountEmail || null,
    encryptedToken,
    projectOrTeamId,
    projectOrTeamName: input.projectOrTeamName?.trim() || null,
    issueTypeName:
      input.provider === "jira" ? input.issueTypeName?.trim() || "Task" : null,
    enabled: input.enabled !== false,
    status: shouldTest ? "connected" : "pending",
    lastError: null,
    createdBy: args.userId,
  };

  const doc = await createWorkTrackerConnection(payload, data);
  const summary = mapWorkTrackerConnectionDoc(doc);
  if (!summary) {
    return { ok: false, message: "Failed to map created connection", status: 500 };
  }
  return { ok: true, connection: summary };
}

export async function updateWorkTrackerConnectionForOrg(
  payload: Payload,
  args: {
    organisationId: string;
    id: string;
    input: Partial<ConnectWorkTrackerInput> & {
      enabled?: boolean;
      clearError?: boolean;
    };
  },
): Promise<
  | { ok: true; connection: WorkTrackerConnectionSummary }
  | { ok: false; message: string; status: number }
> {
  const doc = await getOrgWorkTrackerConnection(payload, args.organisationId, args.id);
  if (!doc) {
    return { ok: false, message: "Connection not found", status: 404 };
  }

  const provider = isWorkTrackerProvider(doc.provider) ? doc.provider : null;
  if (!provider) {
    return { ok: false, message: "Connection has invalid provider", status: 500 };
  }

  const data: UpdateWorkTrackerConnectionData = {};
  const input = args.input;

  if (typeof input.label === "string" && input.label.trim()) {
    data.label = input.label.trim();
  }
  if (typeof input.projectOrTeamId === "string" && input.projectOrTeamId.trim()) {
    data.projectOrTeamId = input.projectOrTeamId.trim();
  }
  if ("projectOrTeamName" in input && input.projectOrTeamName !== undefined) {
    data.projectOrTeamName =
      typeof input.projectOrTeamName === "string"
        ? input.projectOrTeamName.trim() || null
        : null;
  }
  if ("workspaceKey" in input && input.workspaceKey !== undefined) {
    data.workspaceKey =
      typeof input.workspaceKey === "string" ? input.workspaceKey.trim() || null : null;
  }
  if ("accountEmail" in input && input.accountEmail !== undefined) {
    data.accountEmail =
      typeof input.accountEmail === "string" ? input.accountEmail.trim() || null : null;
  }
  if (
    "issueTypeName" in input &&
    input.issueTypeName !== undefined &&
    provider === "jira"
  ) {
    data.issueTypeName =
      typeof input.issueTypeName === "string"
        ? input.issueTypeName.trim() || "Task"
        : "Task";
  }
  if (typeof input.enabled === "boolean") {
    data.enabled = input.enabled;
  }
  if (typeof input.baseUrl === "string" && input.baseUrl.trim()) {
    const baseUrl = normalizeBaseUrl(provider, input.baseUrl);
    try {
      assertProviderBaseUrl(provider, baseUrl);
    } catch (err) {
      return { ok: false, message: sanitizeWorkTrackerError(err), status: 400 };
    }
    data.baseUrl = baseUrl;
  }
  if (typeof input.apiToken === "string" && input.apiToken.trim()) {
    try {
      data.encryptedToken = encryptToken(input.apiToken.trim());
    } catch (err) {
      return { ok: false, message: sanitizeWorkTrackerError(err), status: 500 };
    }
  }
  if (input.clearError) {
    data.lastError = null;
  }

  const updated = await updateWorkTrackerConnection(payload, doc.id, data);
  const summary = mapWorkTrackerConnectionDoc(updated);
  if (!summary) {
    return { ok: false, message: "Failed to map updated connection", status: 500 };
  }
  return { ok: true, connection: summary };
}

export async function deleteWorkTrackerConnectionForOrg(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const doc = await getOrgWorkTrackerConnection(payload, organisationId, id);
  if (!doc) {
    return { ok: false, message: "Connection not found", status: 404 };
  }
  await deleteWorkTrackerConnection(payload, id);
  return { ok: true };
}

export async function testWorkTrackerConnectionForOrg(
  payload: Payload,
  args: {
    organisationId: string;
    id: string;
    /** Optional one-shot token for testing before save (never logged). */
    apiTokenOverride?: string | null;
  },
): Promise<
  | { ok: true; detail: string; connection: WorkTrackerConnectionSummary | null }
  | { ok: false; message: string; status: number }
> {
  const doc = await getOrgWorkTrackerConnection(payload, args.organisationId, args.id);
  if (!doc) {
    return { ok: false, message: "Connection not found", status: 404 };
  }

  const provider = isWorkTrackerProvider(doc.provider) ? doc.provider : null;
  if (!provider) {
    return { ok: false, message: "Invalid provider", status: 500 };
  }

  let apiToken = "";
  try {
    if (args.apiTokenOverride?.trim()) {
      apiToken = args.apiTokenOverride.trim();
    } else if (doc.encryptedToken) {
      apiToken = decryptToken(String(doc.encryptedToken));
    }
  } catch (err) {
    const message = sanitizeWorkTrackerError(err);
    await updateWorkTrackerConnection(payload, doc.id, {
      status: "failed",
      lastError: message,
    });
    return { ok: false, message, status: 500 };
  }

  if (!apiToken) {
    return { ok: false, message: "No API token configured", status: 422 };
  }

  const baseUrl = normalizeBaseUrl(provider, String(doc.baseUrl || ""));
  const tested = await runProviderTest({
    provider,
    baseUrl,
    accountEmail: typeof doc.accountEmail === "string" ? doc.accountEmail : null,
    apiToken,
  });

  if (!tested.ok) {
    await updateWorkTrackerConnection(payload, doc.id, {
      status: "failed",
      lastError: tested.message,
    });
    return {
      ok: false,
      message: tested.message,
      status: 422,
    };
  }

  const updated = await updateWorkTrackerConnection(payload, doc.id, {
    status: "connected",
    lastError: null,
  });

  return {
    ok: true,
    detail: tested.detail,
    connection: mapWorkTrackerConnectionDoc(updated),
  };
}

function relationId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export async function listPushableSourceItems(
  payload: Payload,
  organisationId: string,
): Promise<PushableSourceItem[]> {
  const items: PushableSourceItem[] = [];

  const requests = await (
    payload.find as (a: {
      collection: "internal-data-requests";
      where: Record<string, unknown>;
      limit: number;
      sort: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<{
      docs: Array<{
        id: string;
        title?: string | null;
        requestStatus?: string | null;
        reviewStatus?: string | null;
        dueDate?: string | null;
        organisation?: unknown;
      }>;
    }>
  )({
    collection: "internal-data-requests",
    where: { organisation: { equals: organisationId } },
    limit: 40,
    sort: "-updatedAt",
    depth: 0,
    overrideAccess: true,
  });

  for (const doc of requests.docs) {
    items.push({
      entityType: "internal_request",
      entityId: doc.id,
      title: (doc.title || "Internal request").trim(),
      subtitle: `Request ${doc.requestStatus || "—"} · review ${doc.reviewStatus || "—"}`,
      dueDate: doc.dueDate ? String(doc.dueDate) : null,
      status: doc.reviewStatus || doc.requestStatus || null,
    });
  }

  const obligations = await (
    payload.find as (a: {
      collection: "compliance-obligations";
      where: Record<string, unknown>;
      limit: number;
      sort: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<{
      docs: Array<{
        id: string;
        standardVersion?: string | null;
        jurisdiction?: string | null;
        wave?: string | null;
        filingDeadline?: string | null;
        organisation?: unknown;
      }>;
    }>
  )({
    collection: "compliance-obligations",
    where: { organisation: { equals: organisationId } },
    limit: 40,
    sort: "-updatedAt",
    depth: 0,
    overrideAccess: true,
  });

  for (const doc of obligations.docs) {
    const title = [
      doc.standardVersion || "Obligation",
      doc.jurisdiction ? `(${doc.jurisdiction})` : null,
    ]
      .filter(Boolean)
      .join(" ");
    items.push({
      entityType: "compliance_obligation",
      entityId: doc.id,
      title,
      subtitle: doc.wave ? `Wave ${doc.wave}` : null,
      dueDate: doc.filingDeadline ? String(doc.filingDeadline) : null,
      status: null,
    });
  }

  return items;
}

async function loadClearEsgTask(
  payload: Payload,
  args: {
    organisationId: string;
    organisationName: string | null;
    entityType: ClearEsgEntityType;
    entityId: string;
    appOrigin: string | null;
  },
): Promise<ClearEsgTask | null> {
  if (args.entityType === "internal_request") {
    const doc = await (
      payload.findByID as (a: {
        collection: "internal-data-requests";
        id: string;
        depth: number;
        overrideAccess: true;
      }) => Promise<{
        id: string;
        title?: string | null;
        requestStatus?: string | null;
        reviewStatus?: string | null;
        dueDate?: string | null;
        organisation?: unknown;
        metricKeys?: Array<{ key?: string | null }> | null;
        reviewerNotes?: string | null;
      }>
    )({
      collection: "internal-data-requests",
      id: args.entityId,
      depth: 0,
      overrideAccess: true,
    });

    if (relationId(doc.organisation) !== args.organisationId) return null;

    const metricKeys = (doc.metricKeys || [])
      .map((m) => (typeof m?.key === "string" ? m.key : ""))
      .filter(Boolean);
    const descriptionParts = [
      "Internal data request from ClearESG.",
      metricKeys.length ? `Metrics: ${metricKeys.join(", ")}` : null,
      doc.reviewerNotes ? `Notes: ${doc.reviewerNotes}` : null,
    ].filter(Boolean);

    return {
      entityType: "internal_request",
      entityId: doc.id,
      title: (doc.title || "Internal request").trim(),
      description: descriptionParts.join("\n"),
      dueDate: doc.dueDate ? String(doc.dueDate) : null,
      status: doc.reviewStatus || doc.requestStatus || null,
      organisationName: args.organisationName,
      sourceUrl: args.appOrigin ? `${args.appOrigin.replace(/\/+$/, "")}/requests` : null,
    };
  }

  const doc = await (
    payload.findByID as (a: {
      collection: "compliance-obligations";
      id: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<{
      id: string;
      standardVersion?: string | null;
      jurisdiction?: string | null;
      wave?: string | null;
      firstReportingFY?: string | null;
      filingDeadline?: string | null;
      notes?: string | null;
      organisation?: unknown;
    }>
  )({
    collection: "compliance-obligations",
    id: args.entityId,
    depth: 0,
    overrideAccess: true,
  });

  if (relationId(doc.organisation) !== args.organisationId) return null;

  const title = [
    "Compliance obligation",
    doc.standardVersion,
    doc.jurisdiction ? `(${doc.jurisdiction})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const descriptionParts = [
    `Standard: ${doc.standardVersion || "—"}`,
    `Jurisdiction: ${doc.jurisdiction || "—"}`,
    doc.wave ? `Wave: ${doc.wave}` : null,
    doc.firstReportingFY ? `First reporting FY: ${doc.firstReportingFY}` : null,
    doc.notes ? `Notes: ${doc.notes}` : null,
  ].filter(Boolean);

  return {
    entityType: "compliance_obligation",
    entityId: doc.id,
    title,
    description: descriptionParts.join("\n"),
    dueDate: doc.filingDeadline ? String(doc.filingDeadline) : null,
    status: null,
    organisationName: args.organisationName,
    sourceUrl: args.appOrigin ? `${args.appOrigin.replace(/\/+$/, "")}/runway` : null,
  };
}

export async function pushClearEsgEntityToWorkTracker(
  payload: Payload,
  args: {
    organisationId: string;
    organisationName: string | null;
    userId: string;
    connectionId: string;
    entityType: ClearEsgEntityType;
    entityId: string;
    appOrigin: string | null;
  },
): Promise<
  | {
      ok: true;
      externalId: string;
      externalKey: string;
      externalUrl: string | null;
      connection: WorkTrackerConnectionSummary;
    }
  | { ok: false; message: string; status: number }
> {
  if (!isClearEsgEntityType(args.entityType)) {
    return { ok: false, message: "Invalid entityType", status: 400 };
  }

  const doc = await getOrgWorkTrackerConnection(
    payload,
    args.organisationId,
    args.connectionId,
  );
  if (!doc) {
    return { ok: false, message: "Connection not found", status: 404 };
  }
  if (doc.enabled === false) {
    return { ok: false, message: "Connection is disabled", status: 422 };
  }

  const provider = isWorkTrackerProvider(doc.provider) ? doc.provider : null;
  if (!provider) {
    return { ok: false, message: "Invalid provider", status: 500 };
  }

  let apiToken = "";
  try {
    apiToken = decryptToken(String(doc.encryptedToken || ""));
  } catch (err) {
    const message = sanitizeWorkTrackerError(err);
    await updateWorkTrackerConnection(payload, doc.id, {
      status: "failed",
      lastError: message,
    });
    return { ok: false, message, status: 500 };
  }
  if (!apiToken) {
    return { ok: false, message: "No API token configured", status: 422 };
  }

  let task: ClearEsgTask | null;
  try {
    task = await loadClearEsgTask(payload, {
      organisationId: args.organisationId,
      organisationName: args.organisationName,
      entityType: args.entityType,
      entityId: args.entityId,
      appOrigin: args.appOrigin,
    });
  } catch {
    return { ok: false, message: "Source entity not found", status: 404 };
  }
  if (!task) {
    return {
      ok: false,
      message: "Source entity not found in this organisation",
      status: 404,
    };
  }

  const started = Date.now();
  const baseUrl = normalizeBaseUrl(provider, String(doc.baseUrl || ""));
  const projectOrTeamId = String(doc.projectOrTeamId || "").trim();

  try {
    let externalId = "";
    let externalKey = "";
    let externalUrl: string | null = null;

    if (provider === "jira") {
      const payloadBody = mapClearEsgTaskToJiraIssue(task, {
        projectOrTeamId,
        issueTypeName: doc.issueTypeName,
      });
      const created = await createJiraIssue({
        baseUrl,
        email: typeof doc.accountEmail === "string" ? doc.accountEmail : "",
        apiToken,
        payload: payloadBody,
      });
      if (!created.ok) {
        throw new Error(created.message);
      }
      externalId = created.issue.id;
      externalKey = created.issue.key;
      externalUrl = created.browseUrl;
    } else {
      const payloadBody = mapClearEsgTaskToLinearIssue(task, {
        teamId: projectOrTeamId,
      });
      const created = await createLinearIssue({
        baseUrl,
        apiToken,
        payload: payloadBody,
      });
      if (!created.ok) {
        throw new Error(created.message);
      }
      externalId = created.issue.id;
      externalKey = created.issue.identifier;
      externalUrl = created.issue.url;
    }

    const updated = await updateWorkTrackerConnection(payload, doc.id, {
      status: "connected",
      lastError: null,
      lastSyncAt: new Date().toISOString(),
      lastExternalId: externalId,
      lastExternalKey: externalKey,
      lastExternalUrl: externalUrl,
      lastEntityType: args.entityType,
      lastEntityId: args.entityId,
    });

    await writeWorkTrackerSyncLog(payload, {
      organisationId: args.organisationId,
      integrationId: doc.id,
      provider,
      status: "success",
      recordsProcessed: 1,
      recordsFailed: 0,
      details: {
        entityType: args.entityType,
        entityId: args.entityId,
        externalId,
        externalKey,
        externalUrl,
      },
      syncDurationMs: Date.now() - started,
      triggeredBy: args.userId,
    });

    const summary = mapWorkTrackerConnectionDoc(updated);
    if (!summary) {
      return { ok: false, message: "Push succeeded but mapping failed", status: 500 };
    }

    return {
      ok: true,
      externalId,
      externalKey,
      externalUrl,
      connection: summary,
    };
  } catch (err) {
    const message = sanitizeWorkTrackerError(err);
    await updateWorkTrackerConnection(payload, doc.id, {
      status: "failed",
      lastError: message,
    });
    await writeWorkTrackerSyncLog(payload, {
      organisationId: args.organisationId,
      integrationId: doc.id,
      provider,
      status: "failed",
      recordsProcessed: 0,
      recordsFailed: 1,
      details: {
        entityType: args.entityType,
        entityId: args.entityId,
      },
      errors: [{ message, recordId: args.entityId }],
      syncDurationMs: Date.now() - started,
      triggeredBy: args.userId,
    });
    return { ok: false, message, status: 422 };
  }
}
