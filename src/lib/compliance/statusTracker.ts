import { getPayload } from "payload";

import config from "@/payload.config";
import { toStoredStatus, type StoredDeadlineStatus } from "./deadlineApplicability";

export type DeadlineStatus = StoredDeadlineStatus;

export type StatusUpdateEvent = {
  deadlineId: string;
  previousStatus: string;
  newStatus: DeadlineStatus;
  timestamp: Date;
  changedBy?: string;
};

/**
 * Track deadline status transitions and auto-link reports.
 */
export class DeadlineStatusTracker {
  /**
   * Update deadline status with validation and side effects.
   */
  async updateStatus(
    deadlineId: string,
    newStatusInput: string,
    userId?: string,
    linkedReportId?: string,
  ): Promise<StatusUpdateEvent | null> {
    try {
      const payload = await getPayload({ config });
      const deadline = await payload.findByID({
        collection: "regulatory-deadlines",
        id: deadlineId,
        overrideAccess: true,
      });

      if (!deadline) {
        throw new Error(`Deadline ${deadlineId} not found`);
      }

      const previousStatus = String(deadline.status);
      const newStatus = toStoredStatus(newStatusInput);

      const updateData: {
        status: DeadlineStatus;
        completedDate?: string;
        submittedDate?: string;
        verifiedDate?: string;
        verifiedBy?: string;
        linkedReport?: string;
      } = {
        status: newStatus,
      };

      switch (newStatus) {
        case "completed":
          updateData.completedDate = new Date().toISOString().slice(0, 10);
          if (linkedReportId) updateData.linkedReport = linkedReportId;
          break;
        case "submitted":
          updateData.submittedDate = new Date().toISOString().slice(0, 10);
          updateData.status = "completed";
          if (linkedReportId) updateData.linkedReport = linkedReportId;
          break;
        case "verified":
          updateData.verifiedDate = new Date().toISOString().slice(0, 10);
          updateData.status = "completed";
          if (userId) updateData.verifiedBy = userId;
          break;
        case "missed":
        case "overdue":
          updateData.status = "missed";
          break;
        default:
          break;
      }

      await payload.update({
        collection: "regulatory-deadlines",
        id: deadlineId,
        data: updateData,
        overrideAccess: true,
      });

      return {
        deadlineId,
        previousStatus,
        newStatus: updateData.status,
        timestamp: new Date(),
        changedBy: userId,
      };
    } catch (error) {
      console.error("Error updating deadline status:", error);
      return null;
    }
  }

  /**
   * Auto-link report to deadline when report is submitted.
   */
  async linkReportToDeadline(
    organisationId: string,
    framework: string,
    reportId: string,
  ): Promise<void> {
    try {
      const payload = await getPayload({ config });
      const typeMap: Record<string, string> = {
        CSRD: "CSRD",
        CSRD_SET1: "CSRD",
        CSRD_SIMPLIFIED: "CSRD",
        ISSB: "ISSB",
        BRSR: "Other",
      };
      const deadlineType = typeMap[framework] ?? framework;

      const deadlines = await payload.find({
        collection: "regulatory-deadlines",
        where: {
          and: [
            { organisation: { equals: organisationId } },
            {
              or: [
                { type: { equals: deadlineType } },
                { framework: { equals: framework } },
              ],
            },
            {
              status: {
                in: ["pending", "in_progress", "not_started"],
              },
            },
          ],
        },
        limit: 20,
        overrideAccess: true,
      });

      for (const deadline of deadlines.docs || []) {
        await this.updateStatus(deadline.id, "completed", undefined, reportId);
      }
    } catch (error) {
      console.error("Error linking report to deadlines:", error);
    }
  }

  async updateOverdueDeadlines(): Promise<number> {
    try {
      const payload = await getPayload({ config });
      const today = new Date().toISOString().slice(0, 10);
      const overdueDeadlines = await payload.find({
        collection: "regulatory-deadlines",
        where: {
          and: [
            { dueDate: { less_than: today } },
            {
              status: {
                not_in: ["completed", "submitted", "verified", "missed", "overdue"],
              },
            },
            { isCatalog: { not_equals: true } },
          ],
        },
        limit: 100,
        overrideAccess: true,
      });

      let count = 0;
      for (const deadline of overdueDeadlines.docs || []) {
        await this.updateStatus(deadline.id, "missed");
        count++;
      }
      return count;
    } catch (error) {
      console.error("Error updating overdue deadlines:", error);
      return 0;
    }
  }

  getColorForStatus(status: DeadlineStatus): string {
    switch (status) {
      case "completed":
      case "submitted":
      case "verified":
        return "green";
      case "in_progress":
        return "yellow";
      case "missed":
      case "overdue":
        return "red";
      case "pending":
      case "not_started":
        return "gray";
      default:
        return "blue";
    }
  }
}

export const deadlineStatusTracker = new DeadlineStatusTracker();
