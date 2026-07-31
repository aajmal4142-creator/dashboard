export const SLACK_EVENT_KEYS = [
  "alert_triggered",
  "datapoint_approved",
  "report_ready",
  "audit_complete",
] as const;

export type SlackEventKey = (typeof SLACK_EVENT_KEYS)[number];

export type SlackIntegrationStatus = "pending" | "connected" | "disconnected" | "failed";

export type SlackChannelMapping = {
  event: SlackEventKey;
  channelId: string;
  channelName?: string | null;
};

export type SlackIntegrationDoc = {
  id: string;
  organisationId: string | { id: string };
  status?: SlackIntegrationStatus | null;
  teamId?: string | null;
  teamName?: string | null;
  botToken?: string | null;
  botUserId?: string | null;
  defaultChannelId?: string | null;
  defaultChannelName?: string | null;
  channelMappings?: Array<{
    event?: string | null;
    channelId?: string | null;
    channelName?: string | null;
    id?: string | null;
  }> | null;
  enableSlashCommands?: boolean | null;
  enableInteractiveButtons?: boolean | null;
  installedAt?: string | null;
  installedBy?: string | { id: string } | null;
  lastError?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

/** Public summary — never includes botToken. */
export type SlackIntegrationSummary = {
  id: string;
  status: SlackIntegrationStatus;
  teamId: string | null;
  teamName: string | null;
  defaultChannelId: string | null;
  defaultChannelName: string | null;
  channelMappings: SlackChannelMapping[];
  enableSlashCommands: boolean;
  enableInteractiveButtons: boolean;
  installedAt: string | null;
  lastError: string | null;
};

export type SlackAppCredentials = {
  clientId: string;
  clientSecret: string;
  signingSecret: string;
};

export type SlackChannelOption = {
  id: string;
  name: string;
  isPrivate: boolean;
};

export type SlackPostMessageInput = {
  channel: string;
  text: string;
  blocks?: unknown[];
};

export type SlackPostMessageResult =
  { ok: true; channel: string; ts: string } | { ok: false; error: string };

export type SlackOAuthExchangeResult = {
  teamId: string;
  teamName: string;
  botToken: string;
  botUserId: string | null;
};

export type SlackBlock = {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: string }>;
};
