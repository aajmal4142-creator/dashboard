import { getPayload } from "payload";
import { NextResponse } from "next/server";

import {
  buildOrgAutomationWhere,
  listMappedAutomations,
  parseCreateBody,
} from "@/lib/automations";
import { createAutomation, findAutomations } from "@/lib/automations/store";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

/** GET /api/app/automations — list org automations. */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload({ config });
    const result = await findAutomations(payload, {
      where: buildOrgAutomationWhere(ctx.activeOrg.id),
      sort: "-updatedAt",
      limit: 200,
    });

    const automations = listMappedAutomations(result.docs);
    const enabled = automations.filter((a) => a.enabled).length;
    const disabled = automations.length - enabled;

    return NextResponse.json({
      automations,
      total: result.totalDocs,
      summary: { enabled, disabled, total: automations.length },
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing automations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/app/automations — create an automation. */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can manage automations." },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = parseCreateBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const created = await createAutomation(payload, {
      organisation: ctx.activeOrg.id,
      name: parsed.data.name,
      enabled: parsed.data.enabled !== false,
      triggerType: parsed.data.triggerType,
      cronExpression: parsed.data.cronExpression ?? null,
      conditions: parsed.data.conditions,
      actions: parsed.data.actions,
      runCount: 0,
      createdBy: ctx.user.id,
    });

    const mapped = listMappedAutomations([created])[0];
    if (!mapped) {
      return NextResponse.json(
        { error: "Created automation could not be mapped." },
        { status: 500 },
      );
    }

    return NextResponse.json({ automation: mapped }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating automation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
