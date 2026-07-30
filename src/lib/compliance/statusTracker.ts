import { getPayload } from "payload";
import config from "@/payload.config";

type DeadlineStatus =
  "not_started" | "in_progress" | "completed" | "submitted" | "verified" | "overdue";

export interface StatusUpdateEvent {
  deadlineId: string;
  previousStatus: DeadlineStatus;
  newStatus: DeadlineStatus;
  timestamp: Date;
  changedBy?: string;
}

/**
 * Track deadline status transitions and auto-link reports.
 */
export class DeadlineStatusTracker {
  private payloadPromise = getPayload({ config });

  /**
   * Update deadline status with validation and side effects.
   */
  async updateStatus(
    deadlineId: string,
    newStatus: DeadlineStatus,
    userId?: string,
    linkedReportId?: string,
  ): Promise<StatusUpdateEvent | null> {
    try {
      const payload = await this.payloadPromise;
      const deadline = await payload.findByID({
        collection: "regulatory-deadlines",
        id: deadlineId,
      });

      if (!deadline) {
        throw new Error(`Deadline ${deadlineId} not found`);
      }

      const previousStatus = deadline.status as DeadlineStatus;

      // Prepare update data
      const updateData: Record<string, unknown> = {
        status: newStatus,
      };

      // Set status-specific timestamps
      switch (newStatus) {
        case "completed":
          updateData.completedDate = new Date().toISOString().split("T")[0];
          break;
        case "submitted":
          updateData.submittedDate = new Date().toISOString().split("T")[0];
          if (linkedReportId) {
            updateData.linkedReport = linkedReportId;
          }
          break;
        case "verified":
          updateData.verifiedDate = new Date().toISOString().split("T")[0];
          if (userId) {
            updateData.verifiedBy = userId;
          }
          break;
      }

      // Perform update
      await payload.update({
        collection: "regulatory-deadlines",
        id: deadlineId,
        data: updateData as {
          status?: DeadlineStatus;
          completedDate?: string;
          submittedDate?: string;
          verifiedDate?: string;
          verifiedBy?: string;
          linkedReport?: string;
        },
      });

      return {
        deadlineId,
        previousStatus,
        newStatus,
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
   * Called when a CSRD/BRSR/GRI report status changes to submitted.
   */
  async linkReportToDeadline(
    organisationId: string,
    framework: string,
    reportId: string,
  ): Promise<void> {
    try {
      const payload = await this.payloadPromise;
      // Find deadlines for this org and framework that are in_progress or completed
      const deadlines = await payload.find({
        collection: "regulatory-deadlines",
        where: {
          and: [
            { organisation: { equals: organisationId } },
            { framework: { equals: framework } },
            {
              status: {
                in: ["in_progress", "completed"],
              },
            },
          ],
        },
        limit: 10,
      });

      // Update each deadline to submitted
      for (const deadline of deadlines.docs || []) {
        await this.updateStatus(deadline.id, "submitted", undefined, reportId);
      }
    } catch (error) {
      console.error("Error linking report to deadlines:", error);
    }
  }

  /**
   * Mark overdue deadlines (for scheduled job).
   */
  async updateOverdueDeadlines(): Promise<number> {
    try {
      const payload = await this.payloadPromise;
      const today = new Date().toISOString().split("T")[0];
      const overdueDeadlines = await payload.find({
        collection: "regulatory-deadlines",
        where: {
          and: [
            {
              dueDate: {
                less_than: today,
              },
            },
            {
              status: {
                not_in: ["submitted", "verified", "overdue"],
              },
            },
          ],
        },
        limit: 100,
      });

      let count = 0;
      for (const deadline of overdueDeadlines.docs || []) {
        await this.updateStatus(deadline.id, "overdue");
        count++;
      }

      return count;
    } catch (error) {
      console.error("Error updating overdue deadlines:", error);
      return 0;
    }
  }

  /**
   * Get deadline color based on status.
   */
  getColorForStatus(status: DeadlineStatus): string {
    switch (status) {
      case "verified":
      case "submitted":
        return "green";
      case "in_progress":
      case "completed":
        return "yellow";
      case "overdue":
        return "red";
      case "not_started":
        return "gray";
      default:
        return "blue";
    }
  }
}

// Export singleton instance
export const deadlineStatusTracker = new DeadlineStatusTracker();
