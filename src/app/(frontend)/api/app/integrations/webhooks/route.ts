import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { WebhookManager } from "@/lib/integrations/webhooks";
import type { WebhookConfig, WebhookEvent } from "@/lib/integrations/types";
import config from "@/payload.config";

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
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

    const organisationId = ctx.activeOrg.id;
    const {
      action,
      webhookId,
      config: webhookBody,
      event,
      data,
      webhookConfig,
    } = (await request.json()) as {
      action: string;
      webhookId?: string;
      config?: WebhookConfig;
      event?: WebhookEvent;
      data?: Record<string, unknown>;
      webhookConfig?: Partial<WebhookConfig>;
    };

    const payload = await getPayload({ config });
    const webhookManager = new WebhookManager(payload);

    if (action === "register") {
      if (!webhookBody) {
        return NextResponse.json({ error: "Config required" }, { status: 400 });
      }
      const id = await webhookManager.registerWebhook(organisationId, webhookBody);
      return NextResponse.json({ webhookId: id });
    }

    if (action === "test") {
      if (!webhookId) {
        return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });
      }
      const success = await webhookManager.testWebhook(webhookId);
      return NextResponse.json({ success });
    }

    if (action === "send-event") {
      if (!event || !data) {
        return NextResponse.json({ error: "Event and data required" }, { status: 400 });
      }
      const result = await webhookManager.sendWebhookEvent(event, data, organisationId);
      return NextResponse.json(result);
    }

    if (action === "update") {
      if (!webhookId || !webhookConfig) {
        return NextResponse.json(
          { error: "Webhook ID and config required" },
          { status: 400 },
        );
      }
      await webhookManager.updateWebhookConfig(webhookId, webhookConfig);
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      if (!webhookId) {
        return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });
      }
      await webhookManager.deleteWebhook(webhookId);
      return NextResponse.json({ success: true });
    }

    if (action === "list") {
      const webhooks = await webhookManager.listWebhooks(organisationId);
      return NextResponse.json({ webhooks });
    }

    if (action === "get-templates") {
      const templates = webhookManager.getWebhookTemplates();
      return NextResponse.json({ templates });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Webhook integration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Integration failed" },
      { status: 500 },
    );
  }
}
