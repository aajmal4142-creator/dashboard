import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { decryptToken } from "@/lib/integrations/accounting/tokens";
import { findConnectedSlackForOrg, listSlackChannels } from "@/lib/integrations/slack";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/integrations/slack/channels
 * List channels the installed bot can see (for default-channel picker).
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "organisation",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const integration = await findConnectedSlackForOrg(payload, ctx.activeOrg.id);
  if (!integration?.botToken) {
    return NextResponse.json({ error: "No connected Slack workspace." }, { status: 404 });
  }

  let token: string;
  try {
    token = decryptToken(integration.botToken);
  } catch {
    return NextResponse.json(
      { error: "Slack bot token could not be decrypted." },
      { status: 500 },
    );
  }

  try {
    const channels = await listSlackChannels(token, { limit: 200 });
    return NextResponse.json({ channels });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to list channels: ${message}` },
      { status: 502 },
    );
  }
}
