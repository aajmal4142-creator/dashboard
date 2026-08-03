import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { decryptToken } from "@/lib/integrations/accounting/tokens";
import {
  findConnectedTeamsForOrg,
  formatAlertTeamsMessageCard,
  parseTeamsWebhookUrl,
  postTeamsWebhook,
  updateTeamsIntegration,
} from "@/lib/integrations/teams";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * POST a test MessageCard.
 * Body may include webhookUrl to test before save; otherwise uses stored URL.
 */
export async function POST(req: Request) {
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

  const body = (await req.json().catch(() => ({}))) as {
    webhookUrl?: string;
  };

  const payload = await getPayload({ config });
  let webhookUrl: string | null = null;
  let integrationId: string | null = null;

  if (typeof body.webhookUrl === "string" && body.webhookUrl.trim()) {
    const parsed = parseTeamsWebhookUrl(body.webhookUrl);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    webhookUrl = parsed.url;
  } else {
    const integration = await findConnectedTeamsForOrg(payload, ctx.activeOrg.id);
    if (!integration?.webhookUrl?.trim()) {
      return NextResponse.json(
        {
          error:
            "No Teams webhook configured. Provide webhookUrl or connect an Incoming Webhook first.",
        },
        { status: 404 },
      );
    }
    integrationId = integration.id;
    try {
      webhookUrl = decryptToken(integration.webhookUrl.trim());
    } catch {
      return NextResponse.json(
        { error: "Stored webhook URL could not be decrypted." },
        { status: 500 },
      );
    }
  }

  const card = formatAlertTeamsMessageCard({
    ruleName: "Teams connection test",
    reason: "ClearESG test message from Incoming Webhook settings.",
    ruleId: "test",
    organisationName: ctx.activeOrg.name,
  });

  const result = await postTeamsWebhook(webhookUrl, card);
  const now = new Date().toISOString();

  if (integrationId) {
    if (result.ok) {
      await updateTeamsIntegration(payload, integrationId, {
        lastTestedAt: now,
        lastError: null,
        status: "connected",
      });
    } else {
      await updateTeamsIntegration(payload, integrationId, {
        lastTestedAt: now,
        lastError: result.error.slice(0, 400),
        status: "failed",
      });
    }
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: `Teams webhook rejected the test: ${result.error}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, testedAt: now });
}
