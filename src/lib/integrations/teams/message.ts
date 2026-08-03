import type { AlertTeamsMessageInput, TeamsMessageCard } from "./types";

/** Oxblood chrome for MessageCard themeColor (external webhook payload, not UI CSS). */
const THEME_COLOR = "722F37";

/**
 * Build an Office 365 Connector MessageCard for Incoming Webhook POST.
 * Pure — no I/O.
 */
export function formatAlertTeamsMessageCard(
  input: AlertTeamsMessageInput,
): TeamsMessageCard {
  const ruleName = input.ruleName.trim() || "Untitled rule";
  const reason = input.reason.trim() || "Alert condition met.";
  const org = input.organisationName?.trim();

  const summary = org
    ? `[ClearESG] Alert: ${ruleName} — ${reason} (${org})`
    : `[ClearESG] Alert: ${ruleName} — ${reason}`;

  const facts: Array<{ name: string; value: string }> = [
    { name: "Rule", value: truncate(ruleName, 200) },
    { name: "Rule id", value: truncate(input.ruleId, 120) },
  ];
  if (org) {
    facts.push({ name: "Organisation", value: truncate(org, 200) });
  }

  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: truncate(summary, 200),
    themeColor: THEME_COLOR,
    title: truncate(`Alert: ${ruleName}`, 150),
    text: truncate(reason, 1000),
    sections: [{ facts }],
  };
}

/** Adaptive Card wrapper alternative for Workflows-style webhooks. */
export function formatAlertTeamsAdaptiveCard(input: AlertTeamsMessageInput): {
  type: "message";
  attachments: Array<{
    contentType: "application/vnd.microsoft.card.adaptive";
    contentUrl: null;
    content: {
      $schema: string;
      type: "AdaptiveCard";
      version: string;
      body: Array<Record<string, unknown>>;
    };
  }>;
} {
  const ruleName = input.ruleName.trim() || "Untitled rule";
  const reason = input.reason.trim() || "Alert condition met.";
  const org = input.organisationName?.trim();

  const facts: Array<{ title: string; value: string }> = [
    { title: "Rule", value: truncate(ruleName, 200) },
    { title: "Rule id", value: truncate(input.ruleId, 120) },
  ];
  if (org) {
    facts.push({ title: "Organisation", value: truncate(org, 200) });
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Medium",
              weight: "Bolder",
              text: truncate(`Alert: ${ruleName}`, 150),
              wrap: true,
            },
            {
              type: "TextBlock",
              text: truncate(reason, 1000),
              wrap: true,
            },
            {
              type: "FactSet",
              facts,
            },
            {
              type: "TextBlock",
              text: "ClearESG alert threshold",
              size: "Small",
              isSubtle: true,
              wrap: true,
            },
          ],
        },
      },
    ],
  };
}

/**
 * Validate a user-supplied Incoming Webhook URL.
 * Requires https; prefers known Microsoft Teams / Power Automate hosts.
 */
export function parseTeamsWebhookUrl(
  raw: unknown,
): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw.trim()) {
    return {
      ok: false,
      error: "Incoming Webhook URL is required.",
    };
  }

  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Webhook URL is not a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Webhook URL must use https." };
  }

  const host = parsed.hostname.toLowerCase();
  const allowed =
    host.endsWith("webhook.office.com") ||
    host.endsWith("outlook.office.com") ||
    host.endsWith("office.com") ||
    host.endsWith("logic.azure.com") ||
    host.endsWith("api.powerplatform.com") ||
    host.endsWith("environment.api.powerplatform.com");

  if (!allowed) {
    return {
      ok: false,
      error:
        "URL host is not a recognised Teams Incoming Webhook or Power Automate host.",
    };
  }

  return { ok: true, url: trimmed };
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  if (max <= 1) return value.slice(0, max);
  return `${value.slice(0, max - 1)}…`;
}
