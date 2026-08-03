import type { Payload } from "payload";

import { writeAuditLog } from "@/lib/audit/write";
import type { MembershipRole } from "@/lib/access/membership";

import {
  hydrateFromLegacy,
  isApprovalStep,
  isChainStatus,
  legacyApprovalState,
  transition,
  type ApprovalAction,
  type ApprovalHistoryEntry,
  type ApprovalStep,
  type ChainState,
  type ChainStatus,
} from "./index";

export type ApprovalEntityKind = "datapoint" | "report";

export type ChainDocSlice = {
  approvalStep?: unknown;
  approvalChainStatus?: unknown;
  approvalState?: unknown;
  approvalHistory?: unknown;
  approvalAssigneeRole?: unknown;
  approvalAssigneeUser?: unknown;
  status?: unknown;
  lockedAt?: unknown;
  approvedBy?: unknown;
};

function relId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function asHistory(raw: unknown): Array<{
  fromStep: ApprovalStep;
  toStep: ApprovalStep;
  action: ApprovalAction;
  at: string;
  actor?: string | null;
  note?: string | null;
  assigneeRole?: string | null;
  assigneeUser?: string | null;
}> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    fromStep: ApprovalStep;
    toStep: ApprovalStep;
    action: ApprovalAction;
    at: string;
    actor?: string | null;
    note?: string | null;
    assigneeRole?: string | null;
    assigneeUser?: string | null;
  }> = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (!isApprovalStep(r.fromStep) || !isApprovalStep(r.toStep)) continue;
    if (r.action !== "advance" && r.action !== "reject" && r.action !== "return") {
      continue;
    }
    out.push({
      fromStep: r.fromStep,
      toStep: r.toStep,
      action: r.action,
      at: typeof r.at === "string" ? r.at : String(r.at ?? ""),
      actor: relId(r.actor),
      note: typeof r.note === "string" ? r.note : null,
      assigneeRole: typeof r.assigneeRole === "string" ? r.assigneeRole : null,
      assigneeUser: relId(r.assigneeUser),
    });
  }
  return out;
}

/** Resolve chain state from document fields, falling back to legacy approvalState / publish. */
export function readChainState(doc: ChainDocSlice): ChainState {
  if (doc.status === "published" || doc.lockedAt) {
    return { step: "lock", status: "locked" };
  }
  if (isApprovalStep(doc.approvalStep) && isChainStatus(doc.approvalChainStatus)) {
    return { step: doc.approvalStep, status: doc.approvalChainStatus };
  }
  if (isApprovalStep(doc.approvalStep)) {
    return {
      step: doc.approvalStep,
      status: doc.approvalStep === "lock" ? "locked" : "in_progress",
    };
  }
  // Legacy report approve: approvedBy set on draft without chain fields.
  if (doc.approvedBy) {
    return { step: "approve", status: "in_progress" };
  }
  return hydrateFromLegacy(doc.approvalState);
}

export function serializeHistory(doc: ChainDocSlice): ApprovalHistoryEntry[] {
  return asHistory(doc.approvalHistory).map((h) => ({
    fromStep: h.fromStep,
    toStep: h.toStep,
    action: h.action,
    at: h.at,
    actorId: h.actor ?? null,
    note: h.note ?? null,
    assigneeRole: h.assigneeRole ?? null,
    assigneeUserId: h.assigneeUser ?? null,
  }));
}

export type TransitionInput = {
  action: ApprovalAction;
  note?: string | null;
  assigneeRole?: string | null;
  assigneeUserId?: string | null;
  actorId: string;
  organisationId: string;
  /** Membership role — lock requires admin/owner for datapoints. */
  membershipRole: MembershipRole;
  skipValidation?: boolean;
};

export type PermissionGate = {
  allowed: boolean;
  error?: string;
};

/**
 * Step-aware permission gate (server-side). UI must not be the only gate.
 * - prepare advance: edit or approve
 * - review / approve advance, reject, return: approve
 * - lock (advance into lock): approve + admin|owner
 */
export function gateTransitionPermission(
  kind: ApprovalEntityKind,
  state: ChainState,
  action: ApprovalAction,
  opts: {
    canEdit: boolean;
    canApprove: boolean;
    membershipRole: MembershipRole;
  },
): PermissionGate {
  if (kind === "report") {
    // Report lock = publish; approval API stops at approve.
    if (action === "advance" && state.step === "approve") {
      return {
        allowed: false,
        error: "Use report publish to lock. Approval chain is ready at approve.",
      };
    }
    if (action === "advance" && state.step === "prepare") {
      return { allowed: opts.canEdit || opts.canApprove };
    }
    return { allowed: opts.canEdit || opts.canApprove };
  }

  // datapoint
  if (action === "advance" && state.step === "prepare") {
    if (!opts.canEdit && !opts.canApprove) {
      return { allowed: false, error: "Forbidden" };
    }
    return { allowed: true };
  }

  if (action === "advance" && state.step === "approve") {
    if (!opts.canApprove) return { allowed: false, error: "Forbidden" };
    if (opts.membershipRole !== "owner" && opts.membershipRole !== "admin") {
      return {
        allowed: false,
        error: "Locking a datapoint requires admin or owner membership.",
      };
    }
    return { allowed: true };
  }

  if (!opts.canApprove) return { allowed: false, error: "Forbidden" };
  return { allowed: true };
}

export function buildChainUpdateData(
  doc: ChainDocSlice,
  input: TransitionInput,
):
  | { ok: true; data: Record<string, unknown>; before: ChainState; after: ChainState }
  | { ok: false; error: string } {
  const before = readChainState(doc);
  const result = transition(before, input.action, {
    note: input.note,
    assigneeRole: input.assigneeRole,
    assigneeUserId: input.assigneeUserId,
  });
  if (!result.ok) return result;

  const at = new Date().toISOString();
  const history = asHistory(doc.approvalHistory);
  history.push({
    fromStep: result.historyEntry.fromStep,
    toStep: result.historyEntry.toStep,
    action: result.historyEntry.action,
    at,
    actor: input.actorId,
    note: result.historyEntry.note,
    assigneeRole: result.historyEntry.assigneeRole,
    assigneeUser: result.historyEntry.assigneeUserId,
  });

  const legacy = legacyApprovalState(result.next);
  const data: Record<string, unknown> = {
    approvalStep: result.next.step,
    approvalChainStatus: result.next.status,
    approvalState: legacy,
    approvalReason: input.action === "reject" ? (input.note?.trim() ?? null) : null,
    approvalHistory: history,
    approvalAssigneeRole: input.assigneeRole?.trim() || null,
    approvalAssigneeUser: input.assigneeUserId?.trim() || null,
  };

  return { ok: true, data, before, after: result.next };
}

export async function applyDatapointTransition(
  payload: Payload,
  datapointId: string,
  input: TransitionInput,
  extra?: { taskStatus?: string },
): Promise<
  | {
      ok: true;
      id: string;
      step: ApprovalStep;
      status: ChainStatus;
      approvalState: string;
      history: ApprovalHistoryEntry[];
    }
  | { ok: false; error: string; status?: number }
> {
  let dp;
  try {
    dp = await payload.findByID({
      collection: "datapoints",
      id: datapointId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return { ok: false, error: "Not found", status: 404 };
  }

  const orgId = relId(dp.organisation);
  if (orgId !== input.organisationId) {
    return { ok: false, error: "Not found", status: 404 };
  }

  const built = buildChainUpdateData(dp, input);
  if (!built.ok) return { ok: false, error: built.error, status: 409 };

  if (extra?.taskStatus) {
    built.data.taskStatus = extra.taskStatus;
  } else if (built.after.status === "locked") {
    built.data.taskStatus = "approved";
  } else if (input.action === "advance" && built.before.step === "prepare") {
    built.data.taskStatus = "submitted";
  }

  const updated = await payload.update({
    collection: "datapoints",
    id: datapointId,
    data: built.data,
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: input.organisationId,
    actorId: input.actorId,
    action: `datapoint.approval.${input.action}`,
    entityType: "datapoints",
    entityId: datapointId,
    before: {
      approvalStep: built.before.step,
      approvalChainStatus: built.before.status,
      approvalState: legacyApprovalState(built.before),
    },
    after: {
      approvalStep: built.after.step,
      approvalChainStatus: built.after.status,
      approvalState: legacyApprovalState(built.after),
      note: input.note ?? null,
    },
  });

  return {
    ok: true,
    id: String(updated.id),
    step: built.after.step,
    status: built.after.status,
    approvalState: legacyApprovalState(built.after),
    history: serializeHistory(updated),
  };
}

export async function applyReportTransition(
  payload: Payload,
  reportId: string,
  input: TransitionInput,
): Promise<
  | {
      ok: true;
      id: string;
      step: ApprovalStep;
      status: ChainStatus;
      reportStatus: string;
    }
  | { ok: false; error: string; status?: number }
> {
  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id: reportId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return { ok: false, error: "Not found", status: 404 };
  }

  const orgId = relId(report.organisation);
  if (orgId !== input.organisationId) {
    return { ok: false, error: "Not found", status: 404 };
  }

  if (report.status === "published") {
    return {
      ok: false,
      error: "Published reports are immutable.",
      status: 409,
    };
  }

  const built = buildChainUpdateData(report, input);
  if (!built.ok) return { ok: false, error: built.error, status: 409 };

  if (built.after.status === "locked") {
    return {
      ok: false,
      error: "Use report publish to lock. Advance the chain to approve, then publish.",
      status: 409,
    };
  }

  const now = new Date().toISOString();
  if (built.after.step === "approve" && built.after.status === "in_progress") {
    built.data.approvedBy = input.actorId;
    built.data.approvedAt = now;
  } else if (input.action === "return" || input.action === "reject") {
    built.data.approvedBy = null;
    built.data.approvedAt = null;
  }

  const updated = await payload.update({
    collection: "reports",
    id: reportId,
    data: built.data,
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: input.organisationId,
    actorId: input.actorId,
    action: `report.approval.${input.action}`,
    entityType: "reports",
    entityId: reportId,
    before: {
      approvalStep: built.before.step,
      approvalChainStatus: built.before.status,
    },
    after: {
      approvalStep: built.after.step,
      approvalChainStatus: built.after.status,
      reportStatus: updated.status,
      note: input.note ?? null,
    },
  });

  return {
    ok: true,
    id: String(updated.id),
    step: built.after.step,
    status: built.after.status,
    reportStatus: String(updated.status),
  };
}
