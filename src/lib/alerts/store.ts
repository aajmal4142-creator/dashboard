import type { Payload, Where } from "payload";

import type { AlertAction, AlertCondition, AlertRuleDoc } from "./types";

type FindArgs = {
  where: Where;
  limit?: number;
  sort?: string;
  depth?: number;
};

type FindResult = {
  docs: AlertRuleDoc[];
  totalDocs: number;
};

type MutateResult = AlertRuleDoc & { id: string };

type CreateData = {
  organisation: string;
  name: string;
  enabled: boolean;
  condition: AlertCondition;
  actions: AlertAction[];
  muted: boolean;
  mutedUntil?: string | null;
  triggeredCount: number;
  createdBy?: string;
};

type UpdateData = {
  name?: string;
  enabled?: boolean;
  condition?: AlertCondition;
  actions?: AlertAction[];
  muted?: boolean;
  mutedUntil?: string | null;
  triggeredCount?: number;
  lastTriggeredAt?: string | null;
  lastTriggeredMessage?: string | null;
};

/** Narrow Payload ops for alert-rules (may precede generated types). */
export async function findAlertRules(
  payload: Payload,
  args: FindArgs,
): Promise<FindResult> {
  return (
    payload.find as (a: {
      collection: "alert-rules";
      where: Where;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess: true;
    }) => Promise<FindResult>
  )({
    collection: "alert-rules",
    where: args.where,
    limit: args.limit,
    sort: args.sort,
    depth: args.depth ?? 0,
    overrideAccess: true,
  });
}

export async function findAlertRuleById(
  payload: Payload,
  id: string,
): Promise<MutateResult> {
  return (
    payload.findByID as (a: {
      collection: "alert-rules";
      id: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "alert-rules",
    id,
    depth: 0,
    overrideAccess: true,
  });
}

export async function createAlertRule(
  payload: Payload,
  data: CreateData,
): Promise<MutateResult> {
  return (
    payload.create as (a: {
      collection: "alert-rules";
      data: CreateData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "alert-rules",
    data,
    overrideAccess: true,
  });
}

export async function updateAlertRule(
  payload: Payload,
  id: string,
  data: UpdateData,
): Promise<MutateResult> {
  return (
    payload.update as (a: {
      collection: "alert-rules";
      id: string;
      data: UpdateData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "alert-rules",
    id,
    data,
    overrideAccess: true,
  });
}

export async function deleteAlertRule(payload: Payload, id: string): Promise<void> {
  await (
    payload.delete as (a: {
      collection: "alert-rules";
      id: string;
      overrideAccess: true;
    }) => Promise<unknown>
  )({
    collection: "alert-rules",
    id,
    overrideAccess: true,
  });
}
