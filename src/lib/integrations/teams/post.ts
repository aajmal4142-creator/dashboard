import type { Payload } from "payload";

import { decryptToken } from "@/lib/integrations/accounting/tokens";

import { postTeamsWebhook } from "./client";
import { formatAlertTeamsMessageCard } from "./message";
import { findActiveTeamsForOrg } from "./store";

export type PostAlertToTeamsResult =
  { posted: true; channelLabel: string | null } | { posted: false; reason: string };

/**
 * Post an alert MessageCard to the org's Teams Incoming Webhook when connected + enabled.
 * Never logs the webhook URL.
 */
export async function postAlertToTeams(
  payload: Payload,
  args: {
    organisationId: string;
    ruleName: string;
    reason: string;
    ruleId: string;
    organisationName?: string | null;
  },
): Promise<PostAlertToTeamsResult> {
  const integration = await findActiveTeamsForOrg(payload, args.organisationId);
  if (!integration) {
    return {
      posted: false,
      reason: "Teams integration not connected or disabled for this organisation.",
    };
  }

  const encrypted = integration.webhookUrl?.trim() || "";
  if (!encrypted) {
    return {
      posted: false,
      reason: "Teams webhook URL missing on integration.",
    };
  }

  let webhookUrl: string;
  try {
    webhookUrl = decryptToken(encrypted);
  } catch {
    return {
      posted: false,
      reason: "Teams webhook URL could not be decrypted.",
    };
  }

  const card = formatAlertTeamsMessageCard({
    ruleName: args.ruleName,
    reason: args.reason,
    ruleId: args.ruleId,
    organisationName: args.organisationName,
  });

  const result = await postTeamsWebhook(webhookUrl, card);

  if (!result.ok) {
    console.info(
      `[teams] post_alert failed org=${args.organisationId} rule=${args.ruleId} error=${result.error}`,
    );
    return { posted: false, reason: `Teams webhook error: ${result.error}` };
  }

  return {
    posted: true,
    channelLabel:
      typeof integration.channelLabel === "string" ? integration.channelLabel : null,
  };
}
