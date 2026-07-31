import type { Payload } from "payload";

import { decryptToken } from "@/lib/integrations/accounting/tokens";

import { postSlackMessage } from "./client";
import { formatAlertSlackMessage, resolveChannelForEvent } from "./message";
import { findConnectedSlackForOrg } from "./store";

export type PostAlertToSlackResult =
  { posted: true; channel: string } | { posted: false; reason: string };

/**
 * Post an alert to the org's default (or mapped) Slack channel when connected.
 * Never logs the bot token.
 */
export async function postAlertToSlack(
  payload: Payload,
  args: {
    organisationId: string;
    ruleName: string;
    reason: string;
    ruleId: string;
    organisationName?: string | null;
  },
): Promise<PostAlertToSlackResult> {
  const integration = await findConnectedSlackForOrg(payload, args.organisationId);
  if (!integration) {
    return {
      posted: false,
      reason: "Slack integration not connected for this organisation.",
    };
  }

  const channel = resolveChannelForEvent({
    event: "alert_triggered",
    defaultChannelId: integration.defaultChannelId,
    mappings: integration.channelMappings,
  });
  if (!channel) {
    return {
      posted: false,
      reason: "No default Slack channel configured.",
    };
  }

  const encrypted = integration.botToken?.trim() || "";
  if (!encrypted) {
    return {
      posted: false,
      reason: "Slack bot token missing on integration.",
    };
  }

  let token: string;
  try {
    token = decryptToken(encrypted);
  } catch {
    return {
      posted: false,
      reason: "Slack bot token could not be decrypted.",
    };
  }

  const message = formatAlertSlackMessage({
    ruleName: args.ruleName,
    reason: args.reason,
    ruleId: args.ruleId,
    organisationName: args.organisationName,
  });

  const result = await postSlackMessage(token, {
    channel,
    text: message.text,
    blocks: message.blocks,
  });

  if (!result.ok) {
    console.info(
      `[slack] post_alert failed org=${args.organisationId} rule=${args.ruleId} error=${result.error}`,
    );
    return { posted: false, reason: `Slack API error: ${result.error}` };
  }

  return { posted: true, channel: result.channel };
}
