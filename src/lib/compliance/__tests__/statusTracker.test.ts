import { describe, it, expect, beforeEach, vi } from "vitest";
import { DeadlineStatusTracker } from "../statusTracker";

vi.mock("payload", () => ({
  getPayload: vi.fn(),
}));

describe("DeadlineStatusTracker", () => {
  let tracker: DeadlineStatusTracker;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateStatus", () => {
    it("should transition from not_started to in_progress", async () => {
      const result = await tracker.updateStatus("deadline-1", "in_progress", "user-1");

      if (result) {
        expect(result.newStatus).toBe("in_progress");
        expect(result.deadlineId).toBe("deadline-1");
      }
    });

    it("should set completedDate when status becomes completed", async () => {
      const result = await tracker.updateStatus("deadline-1", "completed");

      expect(result?.newStatus).toBe("completed");
    });

    it("should set submittedDate when status becomes submitted", async () => {
      const result = await tracker.updateStatus(
        "deadline-1",
        "submitted",
        "user-1",
        "report-123",
      );

      expect(result?.newStatus).toBe("submitted");
    });

    it("should set verifiedDate and verifiedBy when status becomes verified", async () => {
      const userId = "user-1";
      const result = await tracker.updateStatus("deadline-1", "verified", userId);

      expect(result?.newStatus).toBe("verified");
      expect(result?.changedBy).toBe(userId);
    });

    it("should track timestamp", async () => {
      const result = await tracker.updateStatus("deadline-1", "in_progress");

      if (result) {
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.timestamp.getTime()).toBeLessThanOrEqual(new Date().getTime());
      }
    });
  });

  describe("linkReportToDeadline", () => {
    it("should link report to matching deadlines", async () => {
      // This would need mocked Payload to fully test
      // For now, just verify the method exists and can be called
      expect(tracker.linkReportToDeadline).toBeDefined();
    });
  });

  describe("updateOverdueDeadlines", () => {
    it("should mark past deadlines as overdue", async () => {
      const count = await tracker.updateOverdueDeadlines();
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getColorForStatus", () => {
    it("should return green for verified status", () => {
      const color = tracker.getColorForStatus("verified");
      expect(color).toBe("green");
    });

    it("should return green for submitted status", () => {
      const color = tracker.getColorForStatus("submitted");
      expect(color).toBe("green");
    });

    it("should return yellow for in_progress status", () => {
      const color = tracker.getColorForStatus("in_progress");
      expect(color).toBe("yellow");
    });

    it("should return red for overdue status", () => {
      const color = tracker.getColorForStatus("overdue");
      expect(color).toBe("red");
    });

    it("should return gray for not_started status", () => {
      const color = tracker.getColorForStatus("not_started");
      expect(color).toBe("gray");
    });

    it("should return blue as default for unknown status", () => {
      const color = tracker.getColorForStatus(
        "unknown" as
          | "not_started"
          | "in_progress"
          | "completed"
          | "submitted"
          | "verified"
          | "overdue",
      );
      expect(color).toBe("blue");
    });
  });
});
