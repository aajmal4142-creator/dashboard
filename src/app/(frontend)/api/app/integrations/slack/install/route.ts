import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import {
  buildSlackInstallUrl,
  createSlackIntegration,
  findSlackIntegrations,
  isSlackAppConfigured,
  updateSlackIntegration,
} from "@/lib/integrations/slack";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * POST /api/app/integrations/slack/install
 * Start Slack OAuth install for the active organisation.
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

  if (!isSlackAppConfigured()) {
    return NextResponse.json(
      {
        error:
          "Configure Slack app credentials (SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET).",
        configured: false,
      },
      { status: 503 },
    );
  }

  const payload = await getPayload({ config });

  const existing = await findSlackIntegrations(payload, {
    where: { organisationId: { equals: ctx.activeOrg.id } },
    limit: 1,
    sort: "-updatedAt",
  });

  let integrationId: string;
  if (existing.docs[0]) {
    const updated = await updateSlackIntegration(payload, existing.docs[0].id, {
      status: "pending",
      lastError: null,
      installedBy: ctx.user.id,
    });
    integrationId = updated.id;
  } else {
    const created = await createSlackIntegration(payload, {
      organisationId: ctx.activeOrg.id,
      status: "pending",
      installedBy: ctx.user.id,
      enableSlashCommands: true,
      enableInteractiveButtons: true,
    });
    integrationId = created.id;
  }

  const authUrl = buildSlackInstallUrl({ state: integrationId, req });
  if (!authUrl) {
    return NextResponse.json(
      {
        error:
          "Configure Slack app credentials (SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET).",
        configured: false,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    authUrl,
    integrationId,
    configured: true,
  });
}
