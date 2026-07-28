/**
 * ABAC policy types and interfaces.
 */

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "export"
  | "manage-users"
  | "manage-policies";
export type Scope = "own" | "team" | "organisation" | "all";

export interface Capability {
  action: Action;
  resource: string;
  scope: Scope;
  isGrant?: boolean; // true = grant, false = deny/revoke (used in custom overrides)
}

export interface PolicyRole {
  id: string;
  name: string;
  description: string;
  defaultCapabilities: Capability[];
  isSystem: boolean;
}

export interface UserPolicy {
  id: string;
  userId: string;
  organisationId: string;
  role: PolicyRole;
  customCapabilities: Capability[];
}

/**
 * Effective capabilities for a user (after merging role defaults + custom overrides).
 */
export interface EffectiveCapabilities {
  capabilities: Map<string, Capability>; // Key: "action:resource"
  roleId: string;
  roleName: string;
}

/**
 * Policy evaluation result.
 */
export interface PolicyEvaluationResult {
  decision: "allowed" | "denied";
  reason: string;
  capability?: Capability;
}

/**
 * Audit log entry.
 */
export interface AuditLogEntry {
  userId: string;
  organisationId: string;
  action: Action;
  resource: string;
  resourceId: string;
  decision: "allowed" | "denied";
  reason: string;
  userRole?: string;
  ip?: string;
  evaluatedAt: Date;
}
