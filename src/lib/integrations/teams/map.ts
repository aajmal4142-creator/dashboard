import type {
  TeamsIntegrationDoc,
  TeamsIntegrationStatus,
  TeamsIntegrationSummary,
} from "./types";

function orgIdFromDoc(doc: TeamsIntegrationDoc): string | null {
  const raw = doc.organisationId;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

function normalizeStatus(value: unknown): TeamsIntegrationStatus {
  if (value === "connected" || value === "disconnected" || value === "failed") {
    return value;
  }
  return "disconnected";
}

/** Map a Payload doc to a public summary (webhook URL stripped). */
export function mapTeamsIntegrationDoc(
  doc: TeamsIntegrationDoc | null | undefined,
): TeamsIntegrationSummary | null {
  if (!doc?.id) return null;
  if (!orgIdFromDoc(doc)) return null;

  const webhook = typeof doc.webhookUrl === "string" ? doc.webhookUrl.trim() : "";

  return {
    id: doc.id,
    status: normalizeStatus(doc.status),
    enabled: doc.enabled !== false,
    hasWebhook: webhook.length > 0,
    channelLabel: typeof doc.channelLabel === "string" ? doc.channelLabel : null,
    connectedAt: doc.connectedAt ? String(doc.connectedAt) : null,
    lastTestedAt: doc.lastTestedAt ? String(doc.lastTestedAt) : null,
    lastError: typeof doc.lastError === "string" ? doc.lastError : null,
  };
}
