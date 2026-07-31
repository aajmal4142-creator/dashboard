import type { Payload, Where } from "payload";

import type {
  AutomationAction,
  AutomationCondition,
  AutomationDoc,
  AutomationRunDoc,
  AutomationRunStatus,
  AutomationTriggerType,
} from "./types";

type FindArgs = {
  where: Where;
  limit?: number;
  sort?: string;
  depth?: number;
};

type FindResult = {
  docs: AutomationDoc[];
  totalDocs: number;
};

type FindRunsResult = {
  docs: AutomationRunDoc[];
  totalDocs: number;
};

type MutateResult = AutomationDoc & { id: string };
type RunMutateResult = AutomationRunDoc & { id: string };

type CreateData = {
  organisation: string;
  name: string;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  cronExpression?: string | null;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  runCount: number;
  createdBy?: string;
};

type UpdateData = {
  name?: string;
  enabled?: boolean;
  triggerType?: AutomationTriggerType;
  cronExpression?: string | null;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
  runCount?: number;
  lastRunAt?: string | null;
  lastRunStatus?: AutomationRunStatus | null;
};

type CreateRunData = {
  organisation: string;
  automation: string;
  triggerType: AutomationTriggerType;
  status: AutomationRunStatus;
  matched: boolean;
  actionsRun: unknown;
  actionsSkipped: unknown;
  error?: string | null;
  context?: unknown;
};

/** Narrow Payload ops for automations (may precede generated types). */
export async function findAutomations(
  payload: Payload,
  args: FindArgs,
): Promise<FindResult> {
  return (
    payload.find as (a: {
      collection: "automations";
      where: Where;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess: true;
    }) => Promise<FindResult>
  )({
    collection: "automations",
    where: args.where,
    limit: args.limit,
    sort: args.sort,
    depth: args.depth ?? 0,
    overrideAccess: true,
  });
}

export async function findAutomationById(
  payload: Payload,
  id: string,
): Promise<MutateResult> {
  return (
    payload.findByID as (a: {
      collection: "automations";
      id: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "automations",
    id,
    depth: 0,
    overrideAccess: true,
  });
}

export async function createAutomation(
  payload: Payload,
  data: CreateData,
): Promise<MutateResult> {
  return (
    payload.create as (a: {
      collection: "automations";
      data: CreateData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "automations",
    data,
    overrideAccess: true,
  });
}

export async function updateAutomation(
  payload: Payload,
  id: string,
  data: UpdateData,
): Promise<MutateResult> {
  return (
    payload.update as (a: {
      collection: "automations";
      id: string;
      data: UpdateData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "automations",
    id,
    data,
    overrideAccess: true,
  });
}

export async function deleteAutomation(payload: Payload, id: string): Promise<void> {
  await (
    payload.delete as (a: {
      collection: "automations";
      id: string;
      overrideAccess: true;
    }) => Promise<unknown>
  )({
    collection: "automations",
    id,
    overrideAccess: true,
  });
}

export async function findAutomationRuns(
  payload: Payload,
  args: FindArgs,
): Promise<FindRunsResult> {
  return (
    payload.find as (a: {
      collection: "automation-runs";
      where: Where;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess: true;
    }) => Promise<FindRunsResult>
  )({
    collection: "automation-runs",
    where: args.where,
    limit: args.limit,
    sort: args.sort,
    depth: args.depth ?? 0,
    overrideAccess: true,
  });
}

export async function createAutomationRun(
  payload: Payload,
  data: CreateRunData,
): Promise<RunMutateResult> {
  return (
    payload.create as (a: {
      collection: "automation-runs";
      data: CreateRunData;
      overrideAccess: true;
    }) => Promise<RunMutateResult>
  )({
    collection: "automation-runs",
    data,
    overrideAccess: true,
  });
}
