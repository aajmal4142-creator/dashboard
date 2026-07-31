import type { SlackAppCredentials } from "./types";

const BOT_SCOPES = ["chat:write", "channels:read", "groups:read", "commands"].join(",");

export function resolveSlackCredentials(): SlackAppCredentials | null {
  const clientId = process.env.SLACK_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.SLACK_CLIENT_SECRET?.trim() || "";
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim() || "";
  if (!clientId || !clientSecret || !signingSecret) return null;
  return { clientId, clientSecret, signingSecret };
}

export function isSlackAppConfigured(): boolean {
  return resolveSlackCredentials() !== null;
}

export function slackBotScopes(): string {
  return BOT_SCOPES;
}

export function appBaseUrl(req?: Request): string {
  if (req) {
    try {
      const origin = new URL(req.url).origin;
      if (origin && origin !== "null") return origin;
    } catch {
      /* fall through */
    }
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function slackCallbackUrl(req?: Request): string {
  return `${appBaseUrl(req)}/api/app/integrations/slack/callback`;
}
