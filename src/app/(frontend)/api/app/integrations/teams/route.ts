import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { encryptToken } from "@/lib/integrations/accounting/tokens";
import {
  createTeamsIntegration,
  findTeamsIntegrations,
  mapTeamsIntegrationDoc,
  parseTeamsWebhookUrl,
  updateTeamsIntegration,
  type TeamsIntegrationSummary,
} from "@/lib/integrations/teams";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

async function loadOrgSummary(
  organisationId: string,
): Promise<TeamsIntegrationSummary | null> {
  const payload = await getPayload({ config });
  const result = await findTeamsIntegrations(payload, {
    where: { organisationId: { equals: organisationId } },
    limit: 5,
    sort: "-updatedAt",
  });
  const preferred =
    result.docs.find((d) => d.status === "connected") ?? result.docs[0] ?? null;
  return mapTeamsIntegrationDoc(preferred);
}

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const integration = await loadOrgSummary(ctx.activeOrg.id);
  return NextResponse.json({ integration });
}

/**
 * Connect or replace the org Teams Incoming Webhook.
 * Body: { webhookUrl, channelLabel?, enabled? }
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

  const body = (await req.json()) as {
    webhookUrl?: string;
    channelLabel?: string | null;
    enabled?: boolean;
  };

  const parsed = parseTeamsWebhookUrl(body.webhookUrl);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const channelLabel =
    typeof body.channelLabel === "string" ? body.channelLabel.trim() || null : null;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
  const encrypted = encryptToken(parsed.url);
  const now = new Date().toISOString();

  const payload = await getPayload({ config });
  const listed = await findTeamsIntegrations(payload, {
    where: { organisationId: { equals: ctx.activeOrg.id } },
    limit: 5,
    sort: "-updatedAt",
  });

  const existing =
    listed.docs.find((d) => d.status === "connected") ?? listed.docs[0] ?? null;

  const data = {
    organisationId: ctx.activeOrg.id,
    status: "connected" as const,
    enabled,
    webhookUrl: encrypted,
    channelLabel,
    connectedAt: now,
    connectedBy: ctx.user.id,
    lastError: null,
  };

  const saved = existing
    ? await updateTeamsIntegration(payload, existing.id, data)
    : await createTeamsIntegration(payload, data);

  return NextResponse.json({
    integration: mapTeamsIntegrationDoc(saved),
  });
}

/**
 * Update channel label / enabled without replacing the webhook.
 */
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
    channelLabel?: string | null;
    enabled?: boolean;
  };

  const payload = await getPayload({ config });
  const listed = await findTeamsIntegrations(payload, {
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
      {
        error: "No connected Teams webhook. Connect with an Incoming Webhook URL first.",
      },
      { status: 404 },
    );
  }

  const data: {
    channelLabel?: string | null;
    enabled?: boolean;
  } = {};

  if ("channelLabel" in body) {
    const label = typeof body.channelLabel === "string" ? body.channelLabel.trim() : "";
    data.channelLabel = label || null;
  }
  if (typeof body.enabled === "boolean") {
    data.enabled = body.enabled;
  }

  const updated = await updateTeamsIntegration(payload, current.id, data);
  return NextResponse.json({
    integration: mapTeamsIntegrationDoc(updated),
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
  const listed = await findTeamsIntegrations(payload, {
    where: { organisationId: { equals: ctx.activeOrg.id } },
    limit: 20,
    sort: "-updatedAt",
  });

  for (const doc of listed.docs) {
    if (doc.status === "disconnected") continue;
    await updateTeamsIntegration(payload, doc.id, {
      status: "disconnected",
      enabled: false,
      webhookUrl: null,
      lastError: null,
    });
  }

  return NextResponse.json({ ok: true });
}
