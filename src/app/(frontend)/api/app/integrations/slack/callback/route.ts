import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { encryptToken } from "@/lib/integrations/accounting/tokens";
import {
  appBaseUrl,
  exchangeSlackOAuthCode,
  findSlackIntegrationById,
  updateSlackIntegration,
} from "@/lib/integrations/slack";
import config from "@/payload.config";

/**
 * GET /api/app/integrations/slack/callback
 * Slack OAuth redirect — exchanges code, stores encrypted bot token.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const base = appBaseUrl(req);
  const settingsPath = `${base}/integrations/slack`;

  if (error) {
    return NextResponse.redirect(`${settingsPath}?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${settingsPath}?error=${encodeURIComponent("Missing authorization code or state")}`,
    );
  }

  const payload = await getPayload({ config });

  let integration;
  try {
    integration = await findSlackIntegrationById(payload, state);
  } catch {
    return NextResponse.redirect(
      `${settingsPath}?error=${encodeURIComponent("Integration not found")}`,
    );
  }

  try {
    const tokens = await exchangeSlackOAuthCode({ code, req });
    const encryptedBotToken = encryptToken(tokens.botToken);

    await updateSlackIntegration(payload, state, {
      status: "connected",
      teamId: tokens.teamId,
      teamName: tokens.teamName,
      botToken: encryptedBotToken,
      botUserId: tokens.botUserId,
      installedAt: new Date().toISOString(),
      lastError: null,
      // Preserve existing default channel if reconnecting same workspace.
      defaultChannelId: integration.defaultChannelId ?? null,
      defaultChannelName: integration.defaultChannelName ?? null,
    });

    return NextResponse.redirect(
      `${settingsPath}?connected=true&team=${encodeURIComponent(tokens.teamName)}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Do not include token material in persisted errors.
    const safe = message.replace(/xox[baprs]-[^\s]+/gi, "[redacted]");

    await updateSlackIntegration(payload, state, {
      status: "failed",
      lastError: safe.slice(0, 500),
    });

    return NextResponse.redirect(
      `${settingsPath}?error=${encodeURIComponent(safe.slice(0, 200))}`,
    );
  }
}
