import { isSlackEventKey } from "./store";
import type {
  SlackChannelMapping,
  SlackIntegrationDoc,
  SlackIntegrationStatus,
  SlackIntegrationSummary,
} from "./types";

function orgIdFromDoc(doc: SlackIntegrationDoc): string | null {
  const raw = doc.organisationId;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

function normalizeStatus(value: unknown): SlackIntegrationStatus {
  if (
    value === "pending" ||
    value === "connected" ||
    value === "disconnected" ||
    value === "failed"
  ) {
    return value;
  }
  return "pending";
}

function normalizeMappings(
  raw: SlackIntegrationDoc["channelMappings"],
): SlackChannelMapping[] {
  if (!Array.isArray(raw)) return [];
  const out: SlackChannelMapping[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    if (!isSlackEventKey(row.event)) continue;
    const channelId = typeof row.channelId === "string" ? row.channelId.trim() : "";
    if (!channelId) continue;
    out.push({
      event: row.event,
      channelId,
      channelName: typeof row.channelName === "string" ? row.channelName : null,
    });
  }
  return out;
}

/** Map a Payload doc to a public summary (token stripped). */
export function mapSlackIntegrationDoc(
  doc: SlackIntegrationDoc | null | undefined,
): SlackIntegrationSummary | null {
  if (!doc?.id) return null;
  if (!orgIdFromDoc(doc)) return null;

  return {
    id: doc.id,
    status: normalizeStatus(doc.status),
    teamId: typeof doc.teamId === "string" ? doc.teamId : null,
    teamName: typeof doc.teamName === "string" ? doc.teamName : null,
    defaultChannelId:
      typeof doc.defaultChannelId === "string" ? doc.defaultChannelId : null,
    defaultChannelName:
      typeof doc.defaultChannelName === "string" ? doc.defaultChannelName : null,
    channelMappings: normalizeMappings(doc.channelMappings),
    enableSlashCommands: doc.enableSlashCommands !== false,
    enableInteractiveButtons: doc.enableInteractiveButtons !== false,
    installedAt: doc.installedAt ? String(doc.installedAt) : null,
    lastError: typeof doc.lastError === "string" ? doc.lastError : null,
  };
}
