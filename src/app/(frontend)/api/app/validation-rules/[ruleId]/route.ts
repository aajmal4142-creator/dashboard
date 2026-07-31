import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildRuleConfig,
  buildUpdateData,
  isAppRuleType,
  isRuleSeverity,
  orgIdFromDoc,
  parseRuleConfig,
  toApiRule,
} from "@/lib/data/validation";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteParams = { params: Promise<{ ruleId: string }> };

async function loadOwnedRule(ruleId: string, orgId: string) {
  const payload = await getPayload({ config });
  const rule = await payload.findByID({
    collection: "data-quality-rules",
    id: ruleId,
    depth: 0,
    overrideAccess: true,
  });
  const ruleOrg = orgIdFromDoc(rule);
  if (ruleOrg !== orgId) return null;
  return { payload, rule };
}

/**
 * GET /api/app/validation-rules/[ruleId]
 */
export async function GET(_request: Request, { params }: RouteParams) {
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

    const { ruleId } = await params;
    const owned = await loadOwnedRule(ruleId, ctx.activeOrg.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ rule: toApiRule(owned.rule) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching validation rule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/app/validation-rules/[ruleId]
 */
export async function PATCH(request: Request, { params }: RouteParams) {
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

    const { ruleId } = await params;
    const owned = await loadOwnedRule(ruleId, ctx.activeOrg.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
    }
    const obj = body as Record<string, unknown>;

    const name =
      typeof obj.name === "string"
        ? obj.name
        : typeof obj.ruleName === "string"
          ? obj.ruleName
          : undefined;
    const description =
      obj.description === null
        ? null
        : typeof obj.description === "string"
          ? obj.description
          : undefined;
    const errorMessage =
      obj.errorMessage === null
        ? null
        : typeof obj.errorMessage === "string"
          ? obj.errorMessage
          : undefined;

    let ruleType =
      typeof obj.ruleType === "string" && isAppRuleType(obj.ruleType)
        ? obj.ruleType
        : undefined;
    const severity =
      typeof obj.severity === "string" && isRuleSeverity(obj.severity)
        ? obj.severity
        : undefined;

    let enabled: boolean | undefined;
    if (typeof obj.enabled === "boolean") enabled = obj.enabled;
    else if (obj.status === "active") enabled = true;
    else if (obj.status === "inactive") enabled = false;

    const conditionRaw = obj.condition ?? obj.ruleConfig;
    const condition =
      conditionRaw && typeof conditionRaw === "object" && !Array.isArray(conditionRaw)
        ? parseRuleConfig(conditionRaw)
        : undefined;

    const effectiveType =
      ruleType ??
      (isAppRuleType(owned.rule.ruleType)
        ? owned.rule.ruleType
        : toSafeAppType(owned.rule.ruleType));
    const ruleConfig =
      condition !== undefined ? buildRuleConfig(effectiveType, condition) : undefined;

    if (ruleType === undefined && condition !== undefined) {
      // keep stored type if only condition changes
      ruleType = effectiveType;
    }

    const updated = await owned.payload.update({
      collection: "data-quality-rules",
      id: owned.rule.id,
      data: buildUpdateData({
        userId: ctx.user.id,
        name,
        description,
        ruleType,
        condition,
        errorMessage,
        severity,
        enabled,
        ruleConfig,
        currentVersion: owned.rule.version,
      }) as never,
      overrideAccess: true,
    });

    return NextResponse.json({ rule: toApiRule(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating validation rule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/app/validation-rules/[ruleId]
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
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

    const { ruleId } = await params;
    const owned = await loadOwnedRule(ruleId, ctx.activeOrg.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await owned.payload.delete({
      collection: "data-quality-rules",
      id: owned.rule.id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting validation rule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function toSafeAppType(
  ruleType: string,
): "range" | "required" | "pattern" | "cross_field" {
  if (ruleType === "regex") return "pattern";
  if (
    ruleType === "range" ||
    ruleType === "required" ||
    ruleType === "pattern" ||
    ruleType === "cross_field"
  ) {
    return ruleType;
  }
  return "cross_field";
}
