import { getPayload } from "payload";
import { NextResponse } from "next/server";

import {
  buildAlertTriggeredEvent,
  buildDatapointApprovedEvent,
  orgIdFromDoc,
  runAutomationsForEvent,
} from "@/lib/automations";
import { findAutomationById } from "@/lib/automations/store";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/app/automations/[id]/test
 * Dry-run match + action preview against sample event context.
 */
export async function POST(req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can test automations." },
        { status: 403 },
      );
    }

    const { id } = await routeCtx.params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const payload = await getPayload({ config });
    let doc: Awaited<ReturnType<typeof findAutomationById>>;
    try {
      doc = await findAutomationById(payload, id);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (orgIdFromDoc(doc) !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let body: {
      triggerType?: string;
      fields?: Record<string, string | number | null>;
      summary?: string;
    } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // sample defaults
    }

    const triggerType =
      body.triggerType === "alert_triggered" ||
      body.triggerType === "schedule" ||
      body.triggerType === "datapoint_approved"
        ? body.triggerType
        : doc.triggerType === "alert_triggered" ||
            doc.triggerType === "schedule" ||
            doc.triggerType === "datapoint_approved"
          ? doc.triggerType
          : "datapoint_approved";

    const event =
      triggerType === "alert_triggered"
        ? buildAlertTriggeredEvent({
            organisationId: ctx.activeOrg.id,
            ruleId:
              typeof body.fields?.alertRuleId === "string"
                ? body.fields.alertRuleId
                : "test-rule",
            ruleName:
              typeof body.fields?.alertRuleName === "string"
                ? body.fields.alertRuleName
                : "Test alert",
            reason:
              typeof body.summary === "string" && body.summary.trim()
                ? body.summary.trim()
                : "Test alert triggered",
          })
        : triggerType === "schedule"
          ? {
              triggerType: "schedule" as const,
              organisationId: ctx.activeOrg.id,
              fields: { cron: "stub", ...(body.fields ?? {}) },
              summary:
                typeof body.summary === "string" && body.summary.trim()
                  ? body.summary.trim()
                  : "Schedule test (stub)",
              resourceType: "automation",
              resourceId: id,
            }
          : buildDatapointApprovedEvent({
              organisationId: ctx.activeOrg.id,
              datapointId:
                typeof body.fields?.datapointId === "string"
                  ? body.fields.datapointId
                  : "test-dp",
              metricKey:
                typeof body.fields?.metricKey === "string"
                  ? body.fields.metricKey
                  : "scope1_emissions",
              value: typeof body.fields?.value === "number" ? body.fields.value : 100,
              approvalState:
                typeof body.fields?.status === "string" ? body.fields.status : "approved",
              actorName: "Test",
            });

    if (body.fields && triggerType !== "schedule") {
      event.fields = { ...event.fields, ...body.fields };
    }

    const result = await runAutomationsForEvent(payload, event, {
      automationIds: [id],
      actorId: ctx.user.id,
      dryRun: true,
    });

    return NextResponse.json({
      ok: true,
      dryRun: true,
      event,
      ...result,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error testing automation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
