import { getPayload } from "payload";

import type { MembershipRole } from "@/lib/access/membership";
import type { Action } from "./types";
import { PolicyService, evaluatePolicy } from "@/lib/policy";
import { AuditLogger } from "@/lib/policy/audit";
import config from "@/payload.config";

/**
 * When no user-policies row exists, Membership role is the authorisation floor.
 * Login ≠ access still holds — Membership is re-checked server-side.
 */
function membershipAllows(
  role: MembershipRole,
  action: Action,
  scope: "own" | "team" | "organisation" | "all",
): boolean {
  if (scope === "all" && role !== "owner" && role !== "admin") return false;

  if (role === "owner" || role === "admin") return true;

  if (role === "viewer") {
    return action === "view" || action === "export";
  }

  // contributor
  return (
    action === "view" ||
    action === "create" ||
    action === "edit" ||
    action === "export" ||
    action === "approve"
  );
}

async function membershipRoleFor(
  userId: string,
  organisationId: string,
): Promise<MembershipRole | null> {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "memberships",
    where: {
      and: [
        { user: { equals: userId } },
        { organisation: { equals: organisationId } },
        { status: { equals: "active" } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  const role = result.docs[0]?.role;
  if (
    role === "owner" ||
    role === "admin" ||
    role === "contributor" ||
    role === "viewer"
  ) {
    return role;
  }
  return null;
}

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

    const capabilities = await policyService.getUserCapabilities(userId, organisationId);

    if (!capabilities) {
      const membershipRole = await membershipRoleFor(userId, organisationId);
      const allowed =
        membershipRole !== null && membershipAllows(membershipRole, action, scope);

      await auditLogger.log({
        userId,
        organisationId,
        action,
        resource,
        resourceId,
        decision: allowed ? "allowed" : "denied",
        reason: membershipRole
          ? `Membership fallback (${membershipRole})`
          : "No policy or membership found for user",
        userRole: membershipRole ?? undefined,
        evaluatedAt: new Date(),
      });

      return allowed;
    }

    const result = evaluatePolicy(capabilities, action, resource, scope);

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
