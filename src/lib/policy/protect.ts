import { getPayload } from "payload";
import type { Action } from "./types";
import { PolicyService, evaluatePolicy } from "@/lib/policy";
import { AuditLogger } from "@/lib/policy/audit";
import config from "@/payload.config";

/**
 * Middleware to protect API routes with policy checks.
 * Usage:
 *   const allowed = await requirePermission(userId, orgId, 'edit', 'datapoint', datapointId);
 *   if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });
 */

export async function requirePermission(
  userId: string,
  organisationId: string,
  action: Action,
  resource: string,
  resourceId: string,
  scope: "own" | "team" | "organisation" | "all" = "organisation",
): Promise<boolean> {
  try {
    const payload = await getPayload({ config });
    const policyService = new PolicyService(payload);
    const auditLogger = new AuditLogger(payload);

    // Get user's capabilities
    const capabilities = await policyService.getUserCapabilities(userId, organisationId);

    if (!capabilities) {
      await auditLogger.log({
        userId,
        organisationId,
        action,
        resource,
        resourceId,
        decision: "denied",
        reason: "No policy found for user",
        evaluatedAt: new Date(),
      });
      return false;
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

    return result.decision === "allowed";
  } catch (error) {
    console.error("Policy check error:", error);
    return false;
  }
}

/**
 * Get user's effective capabilities.
 */
export async function getUserCapabilities(userId: string, organisationId: string) {
  try {
    const payload = await getPayload({ config });
    const policyService = new PolicyService(payload);
    return await policyService.getUserCapabilities(userId, organisationId);
  } catch (error) {
    console.error("Error fetching capabilities:", error);
    return null;
  }
}
