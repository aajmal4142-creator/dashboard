import type { Payload, Where } from "payload";

import type { DashboardLayoutDoc, DashboardWidget } from "./types";

type FindArgs = {
  where: Where;
  limit?: number;
  sort?: string;
  depth?: number;
};

type FindResult = {
  docs: DashboardLayoutDoc[];
  totalDocs: number;
};

type MutateResult = DashboardLayoutDoc & { id: string };

type CreateData = {
  userId: string;
  organisationId: string;
  name: string;
  isDefault: boolean;
  widgets: DashboardWidget[];
};

type UpdateData = {
  name?: string;
  isDefault?: boolean;
  widgets?: DashboardWidget[];
};

/** Narrow Payload ops for dashboard-layouts (not yet in generated types). */
export async function findDashboardLayouts(
  payload: Payload,
  args: FindArgs,
): Promise<FindResult> {
  return (
    payload.find as (a: {
      collection: "dashboard-layouts";
      where: Where;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess: true;
    }) => Promise<FindResult>
  )({
    collection: "dashboard-layouts",
    where: args.where,
    limit: args.limit,
    sort: args.sort,
    depth: args.depth ?? 0,
    overrideAccess: true,
  });
}

export async function findDashboardLayoutById(
  payload: Payload,
  id: string,
): Promise<MutateResult> {
  return (
    payload.findByID as (a: {
      collection: "dashboard-layouts";
      id: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "dashboard-layouts",
    id,
    depth: 0,
    overrideAccess: true,
  });
}

export async function createDashboardLayout(
  payload: Payload,
  data: CreateData,
): Promise<MutateResult> {
  return (
    payload.create as (a: {
      collection: "dashboard-layouts";
      data: CreateData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "dashboard-layouts",
    data,
    overrideAccess: true,
  });
}

export async function updateDashboardLayout(
  payload: Payload,
  id: string,
  data: UpdateData,
): Promise<MutateResult> {
  return (
    payload.update as (a: {
      collection: "dashboard-layouts";
      id: string;
      data: UpdateData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "dashboard-layouts",
    id,
    data,
    overrideAccess: true,
  });
}

export async function deleteDashboardLayout(payload: Payload, id: string): Promise<void> {
  await (
    payload.delete as (a: {
      collection: "dashboard-layouts";
      id: string;
      overrideAccess: true;
    }) => Promise<unknown>
  )({
    collection: "dashboard-layouts",
    id,
    overrideAccess: true,
  });
}

/** Clear isDefault on sibling layouts for the same user + org. */
export async function clearOtherDefaults(
  payload: Payload,
  userId: string,
  organisationId: string,
  exceptId: string,
): Promise<void> {
  const siblings = await findDashboardLayouts(payload, {
    where: {
      and: [
        { userId: { equals: userId } },
        { organisationId: { equals: organisationId } },
        { isDefault: { equals: true } },
        { id: { not_equals: exceptId } },
      ],
    },
    limit: 50,
  });

  for (const doc of siblings.docs) {
    await updateDashboardLayout(payload, doc.id, { isDefault: false });
  }
}
