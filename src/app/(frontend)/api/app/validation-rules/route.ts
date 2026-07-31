import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildCreateData,
  buildRuleConfig,
  toApiRule,
  validateApiRuleInput,
} from "@/lib/data/validation";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/validation-rules
 * List validation rules for the active organisation.
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });
    const rules = await payload.find({
      collection: "data-quality-rules",
      where: { organisation: { equals: ctx.activeOrg.id } },
      sort: "-updatedAt",
      limit: 200,
      depth: 0,
      overrideAccess: true,
    });

    return NextResponse.json({
      total: rules.totalDocs,
      rules: rules.docs.map(toApiRule),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing validation rules:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/validation-rules
 * Create a custom validation rule for the active organisation.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can manage validation rules" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const parsed = validateApiRuleInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const ruleConfig = buildRuleConfig(parsed.data.ruleType, parsed.data.condition);
    const payload = await getPayload({ config });
    const created = await payload.create({
      collection: "data-quality-rules",
      data: buildCreateData({
        organisationId: ctx.activeOrg.id,
        userId: ctx.user.id,
        name: parsed.data.name,
        description: parsed.data.description,
        ruleType: parsed.data.ruleType,
        condition: parsed.data.condition,
        errorMessage: parsed.data.errorMessage,
        severity: parsed.data.severity,
        enabled: parsed.data.enabled,
        ruleConfig,
      }) as never,
      overrideAccess: true,
    });

    return NextResponse.json({ rule: toApiRule(created) }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating validation rule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
