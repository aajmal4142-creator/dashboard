/** Multi-step approval chain — prepare → review → approve → lock. */

export const APPROVAL_STEPS = ["prepare", "review", "approve", "lock"] as const;

export type ApprovalStep = (typeof APPROVAL_STEPS)[number];

export const APPROVAL_ACTIONS = ["advance", "reject", "return"] as const;

export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const CHAIN_STATUSES = ["in_progress", "rejected", "locked"] as const;

export type ChainStatus = (typeof CHAIN_STATUSES)[number];

export type ChainState = {
  step: ApprovalStep;
  status: ChainStatus;
};

export type ApprovalHistoryEntry = {
  fromStep: ApprovalStep;
  toStep: ApprovalStep;
  action: ApprovalAction;
  at: string;
  actorId: string | null;
  note: string | null;
  assigneeRole: string | null;
  assigneeUserId: string | null;
};

export type TransitionOk = {
  ok: true;
  next: ChainState;
  historyEntry: Omit<ApprovalHistoryEntry, "actorId" | "at"> & {
    actorId?: string | null;
  };
};

export type TransitionErr = {
  ok: false;
  error: string;
};

export type TransitionResult = TransitionOk | TransitionErr;

export type ApprovalEntityType = "datapoint" | "report";

export type LegacyApprovalState = "pending" | "approved" | "rejected";
