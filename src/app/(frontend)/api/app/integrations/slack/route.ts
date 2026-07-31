import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import {
  findSlackIntegrations,
  isSlackAppConfigured,
  isSlackEventKey,
  mapSlackIntegrationDoc,
  updateSlackIntegration,
  type SlackChannelMapping,
  type SlackIntegrationSummary,
} from "@/lib/integrations/slack";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

async function loadOrgSummary(
  organisationId: string,
): Promise<SlackIntegrationSummary | null> {
  const payload = await getPayload({ config });
  const result = await findSlackIntegrations(payload, {
    where: { organisationId: { equals: organisationId } },
    limit: 5,
    sort: "-updatedAt",
  });
  const connected =
    result.docs.find((d) => d.status === "connected") ?? result.docs[0] ?? null;
  return mapSlackIntegrationDoc(connected);
}

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const configured = isSlackAppConfigured();
  const integration = await loadOrgSummary(ctx.activeOrg.id);

  return NextResponse.json({
    configured,
    message: configured
      ? null
      : "Configure Slack app credentials (SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET).",
    integration,
  });
}

export async function PATCH(req: Request) {
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

  const body = (await req.json()) as {
    defaultChannelId?: string | null;
    defaultChannelName?: string | null;
    enableSlashCommands?: boolean;
    enableInteractiveButtons?: boolean;
    channelMappings?: Array<{
      event?: string;
      channelId?: string;
      channelName?: string | null;
    }>;
  };

  const payload = await getPayload({ config });
  const listed = await findSlackIntegrations(payload, {
    where: {
      and: [
        { organisationId: { equals: ctx.activeOrg.id } },
        { status: { equals: "connected" } },
      ],
    },
    limit: 1,
    sort: "-updatedAt",
  });
  const current = listed.docs[0];
  if (!current) {
    return NextResponse.json(
      { error: "No connected Slack workspace. Install Slack first." },
      { status: 404 },
    );
  }

  const data: {
    defaultChannelId?: string | null;
    defaultChannelName?: string | null;
    enableSlashCommands?: boolean;
    enableInteractiveButtons?: boolean;
    channelMappings?: SlackChannelMapping[];
  } = {};

  if ("defaultChannelId" in body) {
    const id =
      typeof body.defaultChannelId === "string" ? body.defaultChannelId.trim() : "";
    data.defaultChannelId = id || null;
  }
  if ("defaultChannelName" in body) {
    const name =
      typeof body.defaultChannelName === "string" ? body.defaultChannelName.trim() : "";
    data.defaultChannelName = name || null;
  }
  if (typeof body.enableSlashCommands === "boolean") {
    data.enableSlashCommands = body.enableSlashCommands;
  }
  if (typeof body.enableInteractiveButtons === "boolean") {
    data.enableInteractiveButtons = body.enableInteractiveButtons;
  }
  if (Array.isArray(body.channelMappings)) {
    const mappings: SlackChannelMapping[] = [];
    for (const row of body.channelMappings) {
      if (!row || !isSlackEventKey(row.event)) continue;
      const channelId = typeof row.channelId === "string" ? row.channelId.trim() : "";
      if (!channelId) continue;
      mappings.push({
        event: row.event,
        channelId,
        channelName: typeof row.channelName === "string" ? row.channelName : null,
      });
    }
    data.channelMappings = mappings;
  }

  const updated = await updateSlackIntegration(payload, current.id, data);
  return NextResponse.json({
    integration: mapSlackIntegrationDoc(updated),
  });
}

export async function DELETE() {
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
  const listed = await findSlackIntegrations(payload, {
    where: { organisationId: { equals: ctx.activeOrg.id } },
    limit: 20,
    sort: "-updatedAt",
  });

  for (const doc of listed.docs) {
    if (doc.status === "disconnected") continue;
    await updateSlackIntegration(payload, doc.id, {
      status: "disconnected",
      botToken: null,
      lastError: null,
    });
  }

  return NextResponse.json({ ok: true });
}
