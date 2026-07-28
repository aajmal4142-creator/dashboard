import type { Capability, EffectiveCapabilities, PolicyEvaluationResult } from "./types";
import type { Action } from "./types";

/**
 * Policy evaluator.
 * Checks if user has capability to perform an action on a resource.
 */

export function evaluatePolicy(
  capabilities: EffectiveCapabilities,
  action: Action,
  resource: string,
  scope: "own" | "team" | "organisation" | "all" = "organisation",
): PolicyEvaluationResult {
  const key = `${action}:${resource}`;
  const capability = capabilities.capabilities.get(key);

  if (!capability) {
    return {
      decision: "denied",
      reason: `User role '${capabilities.roleName}' does not have permission for ${action} on ${resource}`,
    };
  }

  // Check if capability is revoked by custom override
  if (capability.isGrant === false) {
    return {
      decision: "denied",
      reason: `Permission for ${action} on ${resource} has been explicitly revoked`,
    };
  }

  // Check scope
  if (capability.scope === "all") {
    return {
      decision: "allowed",
      reason: `User role '${capabilities.roleName}' can ${action} any ${resource}`,
      capability,
    };
  }

  if (
    capability.scope === "organisation" &&
    (scope === "organisation" || scope === "all")
  ) {
    return {
      decision: "allowed",
      reason: `User role '${capabilities.roleName}' can ${action} ${resource} within organisation`,
      capability,
    };
  }

  if (
    capability.scope === "team" &&
    (scope === "team" || scope === "organisation" || scope === "all")
  ) {
    return {
      decision: "allowed",
      reason: `User role '${capabilities.roleName}' can ${action} ${resource} within team`,
      capability,
    };
  }

  if (capability.scope === "own" && scope === "own") {
    return {
      decision: "allowed",
      reason: `User role '${capabilities.roleName}' can ${action} own ${resource}`,
      capability,
    };
  }

  return {
    decision: "denied",
    reason: `User's permission for ${action} on ${resource} has insufficient scope (has ${capability.scope}, need ${scope})`,
  };
}

/**
 * Merge role capabilities with custom overrides.
 */
export function mergeCapabilities(
  defaultCapabilities: Capability[],
  customCapabilities: Capability[],
): Map<string, Capability> {
  const merged = new Map<string, Capability>();

  // Start with role defaults
  for (const cap of defaultCapabilities) {
    const key = `${cap.action}:${cap.resource}`;
    merged.set(key, { ...cap, isGrant: cap.isGrant !== false });
  }

  // Apply custom overrides
  for (const cap of customCapabilities) {
    const key = `${cap.action}:${cap.resource}`;
    if (cap.isGrant === false) {
      // Remove/revoke capability
      merged.delete(key);
    } else {
      // Add/override capability
      merged.set(key, cap);
    }
  }

  return merged;
}
