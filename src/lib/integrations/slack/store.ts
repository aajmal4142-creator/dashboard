import type { Payload, Where } from "payload";

import type {
  SlackChannelMapping,
  SlackEventKey,
  SlackIntegrationDoc,
  SlackIntegrationStatus,
} from "./types";
import { SLACK_EVENT_KEYS } from "./types";

type FindArgs = {
  where: Where;
  limit?: number;
  sort?: string;
  depth?: number;
};

type FindResult = {
  docs: SlackIntegrationDoc[];
  totalDocs: number;
};

type MutateResult = SlackIntegrationDoc & { id: string };

export type CreateSlackIntegrationData = {
  organisationId: string;
  status: SlackIntegrationStatus;
  teamId?: string | null;
  teamName?: string | null;
  botToken?: string | null;
  botUserId?: string | null;
  defaultChannelId?: string | null;
  defaultChannelName?: string | null;
  channelMappings?: SlackChannelMapping[];
  enableSlashCommands?: boolean;
  enableInteractiveButtons?: boolean;
  installedAt?: string | null;
  installedBy?: string | null;
  lastError?: string | null;
};

export type UpdateSlackIntegrationData = Partial<CreateSlackIntegrationData>;

/** Narrow Payload ops for slack-integrations (may precede generated types). */
export async function findSlackIntegrations(
  payload: Payload,
  args: FindArgs,
): Promise<FindResult> {
  return (
    payload.find as (a: {
      collection: "slack-integrations";
      where: Where;
      limit?: number;
      sort?: string;
      depth?: number;
      overrideAccess: true;
    }) => Promise<FindResult>
  )({
    collection: "slack-integrations",
    where: args.where,
    limit: args.limit,
    sort: args.sort,
    depth: args.depth ?? 0,
    overrideAccess: true,
  });
}

export async function findSlackIntegrationById(
  payload: Payload,
  id: string,
): Promise<MutateResult> {
  return (
    payload.findByID as (a: {
      collection: "slack-integrations";
      id: string;
      depth: number;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "slack-integrations",
    id,
    depth: 0,
    overrideAccess: true,
  });
}

export async function createSlackIntegration(
  payload: Payload,
  data: CreateSlackIntegrationData,
): Promise<MutateResult> {
  return (
    payload.create as (a: {
      collection: "slack-integrations";
      data: CreateSlackIntegrationData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "slack-integrations",
    data,
    overrideAccess: true,
  });
}

export async function updateSlackIntegration(
  payload: Payload,
  id: string,
  data: UpdateSlackIntegrationData,
): Promise<MutateResult> {
  return (
    payload.update as (a: {
      collection: "slack-integrations";
      id: string;
      data: UpdateSlackIntegrationData;
      overrideAccess: true;
    }) => Promise<MutateResult>
  )({
    collection: "slack-integrations",
    id,
    data,
    overrideAccess: true,
  });
}

export async function deleteSlackIntegration(
  payload: Payload,
  id: string,
): Promise<void> {
  await (
    payload.delete as (a: {
      collection: "slack-integrations";
      id: string;
      overrideAccess: true;
    }) => Promise<unknown>
  )({
    collection: "slack-integrations",
    id,
    overrideAccess: true,
  });
}

export function isSlackEventKey(value: unknown): value is SlackEventKey {
  return (
    typeof value === "string" && (SLACK_EVENT_KEYS as readonly string[]).includes(value)
  );
}

export async function findConnectedSlackForOrg(
  payload: Payload,
  organisationId: string,
): Promise<SlackIntegrationDoc | null> {
  const result = await findSlackIntegrations(payload, {
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
