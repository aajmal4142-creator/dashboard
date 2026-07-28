import type { Payload } from "payload";
import type { EffectiveCapabilities, PolicyRole, UserPolicy } from "./types";
import { mergeCapabilities } from "./evaluator";

/**
 * Policy service.
 * Fetches user's role and effective capabilities from database.
 */

export class PolicyService {
  constructor(private payload: Payload) {}

  /**
   * Get user's effective capabilities for an organisation.
   */
  async getUserCapabilities(
    userId: string,
    organisationId: string,
  ): Promise<EffectiveCapabilities | null> {
    try {
      const userPolicy = await this.payload.find({
        collection: "user-policies",
        where: {
          and: [
            { user: { equals: userId } },
            { organisation: { equals: organisationId } },
          ],
        },
        limit: 1,
      });

      if (!userPolicy.docs || userPolicy.docs.length === 0) {
        return null;
      }

      const policy = userPolicy.docs[0] as unknown;
      const policyObj =
        typeof policy === "object" && policy !== null
          ? (policy as Record<string, unknown>)
          : null;
      if (!policyObj) return null;

      const role = policyObj.role as PolicyRole;
      const customCapabilities = (policyObj.customCapabilities as unknown[]) || [];

      const merged = mergeCapabilities(role.defaultCapabilities, customCapabilities);

      return {
        capabilities: merged,
        roleId: role.id || "",
        roleName: role.name,
      };
    } catch (error) {
      console.error("Error fetching user capabilities:", error);
      return null;
    }
  }

  /**
   * Get or create default user policy for new user.
   */
  async initializeUserPolicy(
    userId: string,
    organisationId: string,
    defaultRoleId: string,
  ): Promise<UserPolicy | null> {
    try {
      // Check if policy already exists
      const existing = await this.payload.find({
        collection: "user-policies",
        where: {
          and: [
            { user: { equals: userId } },
            { organisation: { equals: organisationId } },
          ],
        },
        limit: 1,
      });

      if (existing.docs && existing.docs.length > 0) {
        return existing.docs[0] as unknown as UserPolicy;
      }

      // Create new policy with default role
      const created = await this.payload.create({
        collection: "user-policies",
        data: {
          user: userId,
          organisation: organisationId,
          role: defaultRoleId,
          customCapabilities: [],
        },
      });

      return created as unknown as UserPolicy;
    } catch (error) {
      console.error("Error initializing user policy:", error);
      return null;
    }
  }

  /**
   * Update user's role.
   */
  async updateUserRole(
    userId: string,
    organisationId: string,
    newRoleId: string,
  ): Promise<UserPolicy | null> {
    try {
      const userPolicy = await this.payload.find({
        collection: "user-policies",
        where: {
          and: [
            { user: { equals: userId } },
            { organisation: { equals: organisationId } },
          ],
        },
        limit: 1,
      });

      if (!userPolicy.docs || userPolicy.docs.length === 0) {
        return null;
      }

      const policyId = userPolicy.docs[0].id;
      const updated = await this.payload.update({
        collection: "user-policies",
        id: policyId,
        data: {
          role: newRoleId,
        },
      });

      return updated as unknown as UserPolicy;
    } catch (error) {
      console.error("Error updating user role:", error);
      return null;
    }
  }

  /**
   * Add/override a custom capability for user.
   */
  async grantCapability(
    userId: string,
    organisationId: string,
    action: string,
    resource: string,
    scope: "own" | "team" | "organisation" | "all",
  ): Promise<UserPolicy | null> {
    try {
      const userPolicy = await this.payload.find({
        collection: "user-policies",
        where: {
          and: [
            { user: { equals: userId } },
            { organisation: { equals: organisationId } },
          ],
        },
        limit: 1,
      });

      if (!userPolicy.docs || userPolicy.docs.length === 0) {
        return null;
      }

      const policy = userPolicy.docs[0] as unknown;
      const policyObj =
        typeof policy === "object" && policy !== null
          ? (policy as Record<string, unknown>)
          : null;
      if (!policyObj) return null;

      const policyId = policyObj.id as string;
      const customCaps =
        (policyObj.customCapabilities as Array<Record<string, unknown>>) || [];

      // Remove existing cap with same action+resource
      const filtered = customCaps.filter(
        (c) => !(c.action === action && c.resource === resource),
      );

      // Add new cap
      filtered.push({
        action,
        resource,
        scope,
        isGrant: true,
      });

      const updated = await this.payload.update({
        collection: "user-policies",
        id: policyId,
        data: {
          customCapabilities: filtered,
        },
      });

      return updated as unknown as UserPolicy;
    } catch (error) {
      console.error("Error granting capability:", error);
      return null;
    }
  }

  /**
   * Revoke a capability for user.
   */
  async revokeCapability(
    userId: string,
    organisationId: string,
    action: string,
    resource: string,
  ): Promise<UserPolicy | null> {
    try {
      const userPolicy = await this.payload.find({
        collection: "user-policies",
        where: {
          and: [
            { user: { equals: userId } },
            { organisation: { equals: organisationId } },
          ],
        },
        limit: 1,
      });

      if (!userPolicy.docs || userPolicy.docs.length === 0) {
        return null;
      }

      const policy = userPolicy.docs[0] as unknown;
      const policyObj =
        typeof policy === "object" && policy !== null
          ? (policy as Record<string, unknown>)
          : null;
      if (!policyObj) return null;

      const policyId = policyObj.id as string;
      const customCaps =
        (policyObj.customCapabilities as Array<Record<string, unknown>>) || [];

      // Find or add revoke entry
      const key = `${action}:${resource}`;

      const updated_caps = customCaps.filter((c) => `${c.action}:${c.resource}` !== key);

      updated_caps.push({
        action,
        resource,
        scope: "all",
        isGrant: false,
      });

      const updated = await this.payload.update({
        collection: "user-policies",
        id: policyId,
        data: {
          customCapabilities: updated_caps,
        },
      });

      return updated as unknown as UserPolicy;
    } catch (error) {
      console.error("Error revoking capability:", error);
      return null;
    }
  }
}
