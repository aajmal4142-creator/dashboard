import type { SlackBlock } from "./types";

export type AlertSlackMessageInput = {
  ruleName: string;
  reason: string;
  ruleId: string;
  organisationName?: string | null;
};

export type FormattedSlackMessage = {
  text: string;
  blocks: SlackBlock[];
};

/** Plain-text + Block Kit payload for alert_triggered posts. */
export function formatAlertSlackMessage(
  input: AlertSlackMessageInput,
): FormattedSlackMessage {
  const ruleName = input.ruleName.trim() || "Untitled rule";
  const reason = input.reason.trim() || "Alert condition met.";
  const org = input.organisationName?.trim();

  const text = org
    ? `[ClearESG] Alert: ${ruleName} — ${reason} (${org})`
    : `[ClearESG] Alert: ${ruleName} — ${reason}`;

  const fields: Array<{ type: string; text: string }> = [
    { type: "mrkdwn", text: `*Rule*\n${escapeMrkdwn(ruleName)}` },
    { type: "mrkdwn", text: `*Rule id*\n\`${escapeMrkdwn(input.ruleId)}\`` },
  ];
  if (org) {
    fields.push({
      type: "mrkdwn",
      text: `*Organisation*\n${escapeMrkdwn(org)}`,
    });
  }

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: truncate(`Alert: ${ruleName}`, 150),
        emoji: false,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: escapeMrkdwn(reason),
      },
    },
    {
      type: "section",
      fields,
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "ClearESG alert threshold",
        },
      ],
    },
  ];

  return { text, blocks };
}

/** Escape characters that break Slack mrkdwn. */
export function escapeMrkdwn(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  if (max <= 1) return value.slice(0, max);
  return `${value.slice(0, max - 1)}…`;
}

export function resolveChannelForEvent(args: {
  event: string;
  defaultChannelId: string | null | undefined;
  mappings:
    | Array<{
        event?: string | null;
        channelId?: string | null;
      }>
    | null
    | undefined;
}): string | null {
  const mappings = args.mappings ?? [];
  for (const row of mappings) {
    if (row.event === args.event && typeof row.channelId === "string") {
      const id = row.channelId.trim();
      if (id) return id;
    }
  }
  const fallback = args.defaultChannelId?.trim();
  return fallback || null;
}
