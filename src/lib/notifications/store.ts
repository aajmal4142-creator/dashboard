import type { Payload, Where } from "payload";

import type { NotificationListDoc } from "./types";

type FindArgs = {
  where: Where;
  limit?: number;
  sort?: string;
  depth?: number;
};

type FindResult = {
  docs: NotificationListDoc[];
  totalDocs: number;
};

type CountResult = { totalDocs: number };

type MutateResult = NotificationListDoc & { id: string };

/** Narrow Payload ops for the notifications collection (not yet in generated types). */
export async function findNotifications(
  payload: Payload,
  args: FindArgs,
): Promise<FindResult> {
  return (
    payload.find as (a: {
      collection: "notifications";
      where: Where;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess: true;
    }) => Promise<FindResult>
  )({
    collection: "notifications",
    where: args.where,
    limit: args.limit,
    sort: args.sort,
    depth: args.depth ?? 0,
    overrideAccess: true,
  });
}

export async function countNotifications(
  payload: Payload,
  where: Where,
): Promise<CountResult> {
  return (
    payload.count as (a: {
      collection: "notifications";
      where: Where;
      overrideAccess: true;
    }) => Promise<CountResult>
  )({
    collection: "notifications",
    where,
    overrideAccess: true,
  });
}

export async function findNotificationById(
  payload: Payload,
  id: string,
): Promise<MutateResult> {
  return (
    payload.findByID as (a: {
      collection: "notifications";
      id: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "notifications",
    id,
    depth: 0,
    overrideAccess: true,
  });
}

export async function updateNotification(
  payload: Payload,
  id: string,
  data: Record<string, unknown>,
): Promise<MutateResult> {
  return (
    payload.update as (a: {
      collection: "notifications";
      id: string;
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "notifications",
    id,
    data,
    overrideAccess: true,
  });
}

export async function deleteNotification(payload: Payload, id: string): Promise<void> {
  await (
    payload.delete as (a: {
      collection: "notifications";
      id: string;
      overrideAccess: true;
    }) => Promise<unknown>
  )({
    collection: "notifications",
    id,
    overrideAccess: true,
  });
}
