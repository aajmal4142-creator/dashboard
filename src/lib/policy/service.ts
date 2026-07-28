import type { Payload } from "payload";
import type { Capability, EffectiveCapabilities, PolicyRole, UserPolicy } from "./types";
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
      const customCapabilities = ((policyObj.customCapabilities as unknown[]) ||
        []) as unknown as Capability[];

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

  /**
   * List all policy roles (system + custom).
   */
  async listRoles(_organisationId?: string): Promise<PolicyRole[]> {
    try {
      const result = await this.payload.find({
        collection: "policy-roles",
        depth: 0,
        limit: 100,
      });

      if (!result.docs) {
        return [];
      }

      const roles = result.docs.map((doc) => {
        const docObj = doc as unknown as Record<string, unknown>;
        return {
          id: docObj.id as string,
          name: docObj.name as string,
          description: docObj.description as string,
          defaultCapabilities: (docObj.defaultCapabilities as Capability[]) || [],
          isSystem: (docObj.isSystem as boolean) || false,
        };
      });

      return roles;
    } catch (error) {
      console.error("Error listing roles:", error);
      return [];
    }
  }

  /**
   * Create a new custom role.
   */
  async createRole(data: {
    organisationId: string;
    name: string;
    description: string;
    capabilities: Capability[];
  }): Promise<PolicyRole | null> {
    try {
      // Check name uniqueness
      const existing = await this.payload.find({
        collection: "policy-roles",
        where: {
          name: { equals: data.name },
        },
        limit: 1,
      });

      if (existing.docs && existing.docs.length > 0) {
        throw new Error(`Role name "${data.name}" already exists`);
      }

      const created = await this.payload.create({
        collection: "policy-roles",
        data: {
          name: data.name,
          description: data.description,
          defaultCapabilities: data.capabilities,
          isSystem: false,
        },
      });

      const createdObj = created as unknown as Record<string, unknown>;
      return {
        id: createdObj.id as string,
        name: createdObj.name as string,
        description: createdObj.description as string,
        defaultCapabilities: (createdObj.defaultCapabilities as Capability[]) || [],
        isSystem: false,
      };
    } catch (error) {
      console.error("Error creating role:", error);
      return null;
    }
  }

  /**
   * Delete a custom role.
   */
  async deleteRole(roleId: string): Promise<boolean> {
    try {
      // Check if role is system role
      const role = await this.payload.findByID({
        collection: "policy-roles",
        id: roleId,
        depth: 0,
      });

      const roleObj = role as unknown as Record<string, unknown>;
      if (roleObj.isSystem === true) {
        throw new Error("Cannot delete system roles");
      }

      // Check if any users are assigned to this role
      const usersAssigned = await this.payload.find({
        collection: "user-policies",
        where: {
          role: { equals: roleId },
        },
        limit: 1,
      });

      if (usersAssigned.docs && usersAssigned.docs.length > 0) {
        throw new Error("Cannot delete role that has users assigned");
      }

      // Delete the role
      await this.payload.delete({
        collection: "policy-roles",
        id: roleId,
      });

      return true;
    } catch (error) {
      console.error("Error deleting role:", error);
      return false;
    }
  }

  /**
   * List all user policies for an organisation.
   */
  async listUserPolicies(organisationId: string): Promise<UserPolicy[]> {
    try {
      const result = await this.payload.find({
        collection: "user-policies",
        where: {
          organisation: { equals: organisationId },
        },
        depth: 2,
        limit: 100,
      });

      if (!result.docs) {
        return [];
      }

      const policies = result.docs.map((doc) => {
        const docObj = doc as unknown as Record<string, unknown>;
        const roleData = docObj.role as unknown as Record<string, unknown>;

        return {
          id: docObj.id as string,
          userId: (docObj.user as unknown as Record<string, string>).id || "",
          organisationId: docObj.organisation as string,
          role: {
            id: roleData.id as string,
            name: roleData.name as string,
            description: roleData.description as string,
            defaultCapabilities: (roleData.defaultCapabilities as Capability[]) || [],
            isSystem: (roleData.isSystem as boolean) || false,
          },
          customCapabilities: (docObj.customCapabilities as Capability[]) || [],
        };
      });

      return policies;
    } catch (error) {
      console.error("Error listing user policies:", error);
      return [];
    }
  }

  /**
   * Set/update user policies with base role and capability overrides.
   */
  async setUserPolicies(
    userId: string,
    organisationId: string,
    data: {
      baseRole: string;
      capabilityOverrides?: {
        grantExtra?: Capability[];
        revokeCapability?: Capability[];
      };
    },
  ): Promise<UserPolicy | null> {
    try {
      // Find or create user policy
      const existing = await this.payload.find({
        collection: "user-policies",
        where: {
          and: [
            { user: { equals: userId } },
            { organisation: { equals: organisationId } },
          ],
        },
        limit: 1,
        depth: 2,
      });

      let policyId: string;
      if (existing.docs && existing.docs.length > 0) {
        policyId = existing.docs[0].id as string;
      } else {
        // Create new policy
        const created = await this.payload.create({
          collection: "user-policies",
          data: {
            user: userId,
            organisation: organisationId,
            role: data.baseRole,
            customCapabilities: [],
          },
        });
        policyId = (created as unknown as Record<string, string>).id;
      }

      // Build custom capabilities array
      const customCaps: Capability[] = [];

      // Add grants
      if (data.capabilityOverrides?.grantExtra) {
        for (const cap of data.capabilityOverrides.grantExtra) {
          customCaps.push({
            ...cap,
            isGrant: true,
          });
        }
      }

      // Add revokes
      if (data.capabilityOverrides?.revokeCapability) {
        for (const cap of data.capabilityOverrides.revokeCapability) {
          customCaps.push({
            ...cap,
            isGrant: false,
          });
        }
      }

      // Update policy
      const updated = await this.payload.update({
        collection: "user-policies",
        id: policyId,
        data: {
          role: data.baseRole,
          customCapabilities: customCaps,
        },
        depth: 2,
      });

      const updatedObj = updated as unknown as Record<string, unknown>;
      const roleData = updatedObj.role as unknown as Record<string, unknown>;

      return {
        id: updatedObj.id as string,
        userId,
        organisationId,
        role: {
          id: roleData.id as string,
          name: roleData.name as string,
          description: roleData.description as string,
          defaultCapabilities: (roleData.defaultCapabilities as Capability[]) || [],
          isSystem: (roleData.isSystem as boolean) || false,
        },
        customCapabilities: (updatedObj.customCapabilities as Capability[]) || [],
      };
    } catch (error) {
      console.error("Error setting user policies:", error);
      return null;
    }
  }
}
