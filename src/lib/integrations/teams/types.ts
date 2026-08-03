export type TeamsIntegrationStatus = "connected" | "disconnected" | "failed";

export type TeamsIntegrationDoc = {
  id: string;
  organisationId: string | { id: string };
  status?: TeamsIntegrationStatus | null;
  enabled?: boolean | null;
  webhookUrl?: string | null;
  channelLabel?: string | null;
  connectedAt?: string | null;
  connectedBy?: string | { id: string } | null;
  lastTestedAt?: string | null;
  lastError?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

/** Public summary — never includes webhookUrl. */
export type TeamsIntegrationSummary = {
  id: string;
  status: TeamsIntegrationStatus;
  enabled: boolean;
  hasWebhook: boolean;
  channelLabel: string | null;
  connectedAt: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
};

export type AlertTeamsMessageInput = {
  ruleName: string;
  reason: string;
  ruleId: string;
  organisationName?: string | null;
};

/** Office 365 Connector MessageCard posted to Incoming Webhooks. */
export type TeamsMessageCard = {
  "@type": "MessageCard";
  "@context": "https://schema.org/extensions";
  summary: string;
  themeColor: string;
  title: string;
  text: string;
  sections: Array<{
    facts: Array<{ name: string; value: string }>;
  }>;
};

export type TeamsPostResult =
  { ok: true } | { ok: false; error: string; status?: number };
