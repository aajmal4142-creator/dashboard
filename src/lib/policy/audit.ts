import type { Payload } from "payload";
import type { AuditLogEntry } from "./types";

/**
 * Audit logger for policy evaluations.
 * Records every access decision to database.
 */

export class AuditLogger {
  constructor(private payload: Payload) {}

  /**
   * Log a policy evaluation decision.
   * Non-blocking - errors are logged but don't throw.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.payload.create({
        collection: "policy-evaluations",
        data: {
          userId: entry.userId,
          organisationId: entry.organisationId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          decision: entry.decision,
          reason: entry.reason,
          userRole: entry.userRole,
          ip: entry.ip,
          evaluatedAt: entry.evaluatedAt.toISOString(),
        },
      });
    } catch (error) {
      console.error("Failed to write audit log:", error);
      // Don't throw - audit logging should not block the actual operation
    }
  }

  /**
   * Get audit logs for a user.
   */
  async getUserLogs(
    userId: string,
    organisationId: string,
    limit = 100,
    offset = 0,
  ): Promise<AuditLogEntry[]> {
    try {
      const result = await this.payload.find({
        collection: "policy-evaluations",
        where: {
          and: [
            { userId: { equals: userId } },
            { organisationId: { equals: organisationId } },
          ],
        },
        limit,
        page: Math.floor(offset / limit) + 1,
        sort: "-evaluatedAt",
      });

      return result.docs as unknown as AuditLogEntry[];
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      return [];
    }
  }

  /**
   * Get audit logs for a resource.
   */
  async getResourceLogs(
    resourceId: string,
    organisationId: string,
    limit = 100,
    offset = 0,
  ): Promise<AuditLogEntry[]> {
    try {
      const result = await this.payload.find({
        collection: "policy-evaluations",
        where: {
          and: [
            { resourceId: { equals: resourceId } },
            { organisationId: { equals: organisationId } },
          ],
        },
        limit,
        page: Math.floor(offset / limit) + 1,
        sort: "-evaluatedAt",
      });

      return result.docs as unknown as AuditLogEntry[];
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      return [];
    }
  }

  /**
   * Get denied access attempts for an organisation.
   */
  async getDeniedAttempts(
    organisationId: string,
    limit = 100,
    offset = 0,
  ): Promise<AuditLogEntry[]> {
    try {
      const result = await this.payload.find({
        collection: "policy-evaluations",
        where: {
          and: [
            { organisationId: { equals: organisationId } },
            { decision: { equals: "denied" } },
          ],
        },
        limit,
        page: Math.floor(offset / limit) + 1,
        sort: "-evaluatedAt",
      });

      return result.docs as unknown as AuditLogEntry[];
    } catch (error) {
      console.error("Failed to fetch denied attempts:", error);
      return [];
    }
  }
}
