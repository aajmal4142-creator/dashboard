import { resolveSlackCredentials, slackBotScopes, slackCallbackUrl } from "./config";
import type { SlackOAuthExchangeResult } from "./types";

export function buildSlackInstallUrl(args: {
  state: string;
  redirectUri?: string;
  req?: Request;
}): string | null {
  const credentials = resolveSlackCredentials();
  if (!credentials) return null;

  const redirectUri = args.redirectUri || slackCallbackUrl(args.req);
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    scope: slackBotScopes(),
    redirect_uri: redirectUri,
    state: args.state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

type SlackOAuthApiResponse = {
  ok?: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  team?: { id?: string; name?: string };
  authed_user?: { id?: string };
};

/**
 * Exchange OAuth code for bot token. Never log the token.
 */
export async function exchangeSlackOAuthCode(args: {
  code: string;
  redirectUri?: string;
  req?: Request;
  fetchImpl?: typeof fetch;
}): Promise<SlackOAuthExchangeResult> {
  const credentials = resolveSlackCredentials();
  if (!credentials) {
    throw new Error(
      "Slack app credentials are not configured. Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_SIGNING_SECRET.",
    );
  }

  const redirectUri = args.redirectUri || slackCallbackUrl(args.req);
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    code: args.code,
    redirect_uri: redirectUri,
  });

  const fetchFn = args.fetchImpl ?? fetch;
  const response = await fetchFn("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Slack OAuth HTTP ${response.status}`);
  }

  const data = (await response.json()) as SlackOAuthApiResponse;
  if (!data.ok || !data.access_token) {
    throw new Error(data.error || "Slack OAuth exchange failed");
  }

  const teamId = data.team?.id?.trim() || "";
  if (!teamId) {
    throw new Error("Slack OAuth response missing team id");
  }

  return {
    teamId,
    teamName: data.team?.name?.trim() || teamId,
    botToken: data.access_token,
    botUserId: data.bot_user_id?.trim() || null,
  };
}
