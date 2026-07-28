import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { PolicyService, evaluatePolicy } from "@/lib/policy";
import { AuditLogger } from "@/lib/policy/audit";
import type { Action } from "@/lib/policy/types";
import config from "@/payload.config";

/**
 * POST /api/app/policies/evaluate
 * Check if a user has permission to perform an action (dry-run, admin only).
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "manage-policies",
      "policies",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      userId?: string;
      action?: Action;
      resource?: string;
      scope?: "own" | "team" | "organisation" | "all";
    };

    const userId = body.userId || "";
    const action = body.action || "view";
    const resource = body.resource || "";
    const scope = body.scope || "organisation";
    const resourceId = `test-${Date.now()}`;

    if (!userId || !action || !resource) {
      return NextResponse.json(
        { error: "Missing required fields: userId, action, resource" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const policyService = new PolicyService(payload);
    const auditLogger = new AuditLogger(payload);

    // Get target user's capabilities
    const capabilities = await policyService.getUserCapabilities(
      userId,
      ctx.activeOrg.id,
    );

    if (!capabilities) {
      await auditLogger.log({
        userId,
        organisationId: ctx.activeOrg.id,
        action,
        resource,
        resourceId,
        decision: "denied",
        reason: "No policy found for user in this organisation",
        evaluatedAt: new Date(),
      });

      return NextResponse.json({
        decision: "denied",
        reason: "No policy found for user",
        capabilities: {},
      });
    }

    // Evaluate policy
    const result = evaluatePolicy(capabilities, action, resource, scope);

    // Log the evaluation
    await auditLogger.log({
      userId,
      organisationId: ctx.activeOrg.id,
      action,
      resource,
      resourceId,
      decision: result.decision,
      reason: result.reason,
      userRole: capabilities.roleName,
      evaluatedAt: new Date(),
    });

    // Convert capabilities map to object for JSON response
    const capabilitiesObj: Record<string, unknown> = {};
    capabilities.capabilities.forEach((cap, key) => {
      capabilitiesObj[key] = cap;
    });

    return NextResponse.json({
      decision: result.decision,
      reason: result.reason,
      userRole: capabilities.roleName,
      capabilities: capabilitiesObj,
    });
  } catch (error) {
    console.error("Policy evaluation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
