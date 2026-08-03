import type { Payload, Where } from "payload";

import type { TeamsIntegrationDoc, TeamsIntegrationStatus } from "./types";

type FindArgs = {
  where: Where;
  limit?: number;
  sort?: string;
  depth?: number;
};

type FindResult = {
  docs: TeamsIntegrationDoc[];
  totalDocs: number;
};

type MutateResult = TeamsIntegrationDoc & { id: string };

export type CreateTeamsIntegrationData = {
  organisationId: string;
  status: TeamsIntegrationStatus;
  enabled?: boolean;
  webhookUrl?: string | null;
  channelLabel?: string | null;
  connectedAt?: string | null;
  connectedBy?: string | null;
  lastTestedAt?: string | null;
  lastError?: string | null;
};

export type UpdateTeamsIntegrationData = Partial<CreateTeamsIntegrationData>;

/** Narrow Payload ops for teams-integrations (may precede generated types). */
export async function findTeamsIntegrations(
  payload: Payload,
  args: FindArgs,
): Promise<FindResult> {
  return (
    payload.find as (a: {
      collection: "teams-integrations";
      where: Where;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess: true;
    }) => Promise<FindResult>
  )({
    collection: "teams-integrations",
    where: args.where,
    limit: args.limit,
    sort: args.sort,
    depth: args.depth ?? 0,
    overrideAccess: true,
  });
}

export async function findTeamsIntegrationById(
  payload: Payload,
  id: string,
): Promise<MutateResult> {
  return (
    payload.findByID as (a: {
      collection: "teams-integrations";
      id: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "teams-integrations",
    id,
    depth: 0,
    overrideAccess: true,
  });
}

export async function createTeamsIntegration(
  payload: Payload,
  data: CreateTeamsIntegrationData,
): Promise<MutateResult> {
  return (
    payload.create as (a: {
      collection: "teams-integrations";
      data: CreateTeamsIntegrationData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "teams-integrations",
    data,
    overrideAccess: true,
  });
}

export async function updateTeamsIntegration(
  payload: Payload,
  id: string,
  data: UpdateTeamsIntegrationData,
): Promise<MutateResult> {
  return (
    payload.update as (a: {
      collection: "teams-integrations";
      id: string;
      data: UpdateTeamsIntegrationData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "teams-integrations",
    id,
    data,
    overrideAccess: true,
  });
}

export async function deleteTeamsIntegration(
  payload: Payload,
  id: string,
): Promise<void> {
  await (
    payload.delete as (a: {
      collection: "teams-integrations";
      id: string;
      overrideAccess: true;
    }) => Promise<unknown>
  )({
    collection: "teams-integrations",
    id,
    overrideAccess: true,
  });
}

/** Connected + enabled integration for alert / automation posts. */
export async function findActiveTeamsForOrg(
  payload: Payload,
  organisationId: string,
): Promise<TeamsIntegrationDoc | null> {
  const result = await findTeamsIntegrations(payload, {
    where: {
      and: [
        { organisationId: { equals: organisationId } },
        { status: { equals: "connected" } },
        { enabled: { equals: true } },
      ],
    },
    limit: 1,
    sort: "-updatedAt",
  });
  return result.docs[0] ?? null;
}

export async function findConnectedTeamsForOrg(
  payload: Payload,
  organisationId: string,
): Promise<TeamsIntegrationDoc | null> {
  const result = await findTeamsIntegrations(payload, {
    where: {
      and: [
        { organisationId: { equals: organisationId } },
        { status: { equals: "connected" } },
      ],
    },
    limit: 1,
    sort: "-updatedAt",
  });
  return result.docs[0] ?? null;
}
