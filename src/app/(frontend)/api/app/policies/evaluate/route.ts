import { getPayload } from "payload";
import { PolicyService, evaluatePolicy } from "@/lib/policy";
import { AuditLogger } from "@/lib/policy/audit";
import type { Action } from "@/lib/policy/types";
import config from "@/payload.config";

/**
 * POST /api/app/policies/evaluate
 * Check if user has permission to perform an action.
 */

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config });
    const body = await request.json();

    const {
      userId,
      organisationId,
      action,
      resource,
      resourceId,
      scope = "organisation",
    } = body as {
      userId: string;
      organisationId: string;
      action: Action;
      resource: string;
      resourceId: string;
      scope?: "own" | "team" | "organisation" | "all";
    };

    if (!userId || !organisationId || !action || !resource || !resourceId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const policyService = new PolicyService(payload);
    const auditLogger = new AuditLogger(payload);

    // Get user's capabilities
    const capabilities = await policyService.getUserCapabilities(userId, organisationId);

    if (!capabilities) {
      // No policy found - deny by default
      await auditLogger.log({
        userId,
        organisationId,
        action,
        resource,
        resourceId,
        decision: "denied",
        reason: "No policy found for user in this organisation",
        evaluatedAt: new Date(),
      });

      return Response.json(
        {
          decision: "denied",
          reason: "No policy found",
        },
        { status: 403 },
      );
    }

    // Evaluate policy
    const result = evaluatePolicy(capabilities, action, resource, scope);

    // Log the evaluation
    await auditLogger.log({
      userId,
      organisationId,
      action,
      resource,
      resourceId,
      decision: result.decision,
      reason: result.reason,
      userRole: capabilities.roleName,
      evaluatedAt: new Date(),
    });

    if (result.decision === "denied") {
      return Response.json(
        { decision: "denied", reason: result.reason },
        { status: 403 },
      );
    }

    return Response.json({
      decision: "allowed",
      reason: result.reason,
    });
  } catch (error) {
    console.error("Policy evaluation error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
