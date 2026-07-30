import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Payload } from "payload";
import { AuditorWorkflow, createAuditorWorkflow } from "../auditorWorkflow";

// Mock Payload instance
const createMockPayload = (): Payload => {
  return {
    findByID: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  } as unknown as Payload;
};

describe("AuditorWorkflow", () => {
  let workflow: AuditorWorkflow;
  let payload: Payload;

  beforeEach(() => {
    payload = createMockPayload();
    workflow = new AuditorWorkflow(payload);
  });

  describe("submitCertificationForReview", () => {
    it("should transition from draft to submitted", async () => {
      const mockCert = {
        id: "cert-1",
        organisation: { id: "org-1" },
        status: "draft",
      };

      vi.mocked(payload.findByID).mockResolvedValueOnce(mockCert);
      vi.mocked(payload.update).mockResolvedValueOnce(mockCert);
      vi.mocked(payload.create).mockResolvedValueOnce({});

      await workflow.submitCertificationForReview("cert-1", "org-1", "user-1");

      expect(payload.findByID).toHaveBeenCalledWith({
        collection: "carbon-trust-certifications",
        id: "cert-1",
      });

      expect(payload.update).toHaveBeenCalledWith({
        collection: "carbon-trust-certifications",
        id: "cert-1",
        data: expect.objectContaining({
          status: "submitted",
          submittedAt: expect.any(String),
        }),
      });

      expect(payload.create).toHaveBeenCalledWith({
        collection: "carbon-trust-audit-trail",
        data: expect.any(Object),
      });
    });

    it("should throw if certification not found", async () => {
      vi.mocked(payload.findByID).mockResolvedValueOnce(null);

      await expect(
        workflow.submitCertificationForReview("cert-1", "org-1", "user-1"),
      ).rejects.toThrow("Certification not found");
    });

    it("should throw if certification not in draft state", async () => {
      const mockCert = {
        id: "cert-1",
        organisation: { id: "org-1" },
        status: "under_review",
      };

      vi.mocked(payload.findByID).mockResolvedValueOnce(mockCert);

      await expect(
        workflow.submitCertificationForReview("cert-1", "org-1", "user-1"),
      ).rejects.toThrow("Cannot submit certification");
    });
  });

  describe("reviewChecklistItem", () => {
    it("should approve an item with feedback", async () => {
      const mockItem = {
        id: "item-1",
        certification: { id: "cert-1" },
        status: "in_progress",
        requirementName: "Test Requirement",
      };

      vi.mocked(payload.findByID).mockResolvedValueOnce(mockItem);
      vi.mocked(payload.update).mockResolvedValueOnce(mockItem);
      vi.mocked(payload.create).mockResolvedValueOnce({});

      await workflow.reviewChecklistItem(
        "item-1",
        "cert-1",
        "org-1",
        "auditor-1",
        "Looks good",
        true,
      );

      expect(payload.update).toHaveBeenCalledWith({
        collection: "carbon-trust-checklist-items",
        id: "item-1",
        data: expect.objectContaining({
          status: "approved",
          auditorFeedback: "Looks good",
          auditorApprovedAt: expect.any(String),
        }),
      });
    });

    it("should request additional info for an item", async () => {
      const mockItem = {
        id: "item-1",
        certification: { id: "cert-1" },
        status: "submitted",
        requirementName: "Test Requirement",
      };

      vi.mocked(payload.findByID).mockResolvedValueOnce(mockItem);
      vi.mocked(payload.update).mockResolvedValueOnce(mockItem);
      vi.mocked(payload.create).mockResolvedValueOnce({});

      await workflow.reviewChecklistItem(
        "item-1",
        "cert-1",
        "org-1",
        "auditor-1",
        "Need more details",
        false,
      );

      expect(payload.update).toHaveBeenCalledWith({
        collection: "carbon-trust-checklist-items",
        id: "item-1",
        data: expect.objectContaining({
          status: "additional_info_requested",
          auditorFeedback: "Need more details",
        }),
      });
    });
  });

  describe("batchApproveItems", () => {
    it("should approve multiple items at once", async () => {
      const mockItem1 = {
        id: "item-1",
        certification: { id: "cert-1" },
        status: "submitted",
      };
      const mockItem2 = {
        id: "item-2",
        certification: { id: "cert-1" },
        status: "submitted",
      };

      vi.mocked(payload.findByID)
        .mockResolvedValueOnce(mockItem1)
        .mockResolvedValueOnce(mockItem2);

      vi.mocked(payload.update).mockResolvedValue(mockItem1);
      vi.mocked(payload.create).mockResolvedValueOnce({});

      await workflow.batchApproveItems(
        "cert-1",
        ["item-1", "item-2"],
        "org-1",
        "auditor-1",
      );

      expect(payload.update).toHaveBeenCalledTimes(2);
      expect(payload.create).toHaveBeenCalledWith({
        collection: "carbon-trust-audit-trail",
        data: expect.any(Object),
      });
    });
  });

  describe("approveCertification", () => {
    it("should approve certification when all critical items are approved", async () => {
      const mockCert = {
        id: "cert-1",
        organisation: { id: "org-1" },
        status: "under_review",
      };

      const mockItems = {
        docs: [
          { id: "item-1", status: "approved", severity: "critical" },
          { id: "item-2", status: "approved", severity: "high" },
        ],
        totalDocs: 2,
      };

      vi.mocked(payload.findByID).mockResolvedValueOnce(mockCert);
      vi.mocked(payload.find).mockResolvedValueOnce(mockItems);
      vi.mocked(payload.update).mockResolvedValueOnce(mockCert);
      vi.mocked(payload.create).mockResolvedValueOnce({});

      await workflow.approveCertification("cert-1", "org-1", "auditor-1", "All good");

      expect(payload.update).toHaveBeenCalledWith({
        collection: "carbon-trust-certifications",
        id: "cert-1",
        data: expect.objectContaining({
          status: "approved",
          reviewNotes: "All good",
        }),
      });
    });

    it("should throw if critical items are not approved", async () => {
      const mockCert = {
        id: "cert-1",
        organisation: { id: "org-1" },
        status: "under_review",
      };

      const mockItems = {
        docs: [
          { id: "item-1", status: "in_progress", severity: "critical" },
          { id: "item-2", status: "approved", severity: "high" },
        ],
        totalDocs: 2,
      };

      vi.mocked(payload.findByID).mockResolvedValueOnce(mockCert);
      vi.mocked(payload.find).mockResolvedValueOnce(mockItems);

      await expect(
        workflow.approveCertification("cert-1", "org-1", "auditor-1"),
      ).rejects.toThrow("Cannot approve: critical/high severity items still pending");
    });
  });

  describe("rejectCertification", () => {
    it("should reject certification with reason", async () => {
      const mockCert = {
        id: "cert-1",
        organisation: { id: "org-1" },
        status: "under_review",
      };

      vi.mocked(payload.findByID).mockResolvedValueOnce(mockCert);
      vi.mocked(payload.update).mockResolvedValueOnce(mockCert);
      vi.mocked(payload.create).mockResolvedValueOnce({});

      await workflow.rejectCertification(
        "cert-1",
        "org-1",
        "auditor-1",
        "Insufficient documentation",
      );

      expect(payload.update).toHaveBeenCalledWith({
        collection: "carbon-trust-certifications",
        id: "cert-1",
        data: expect.objectContaining({
          status: "rejected",
          rejectionReason: "Insufficient documentation",
        }),
      });
    });
  });

  describe("calculateCompletionPercentage", () => {
    it("should calculate completion as approved/total items", async () => {
      const mockItems = {
        docs: [
          { id: "item-1", status: "approved" },
          { id: "item-2", status: "approved" },
          { id: "item-3", status: "in_progress" },
          { id: "item-4", status: "not_applicable" },
        ],
        totalDocs: 4,
      };

      vi.mocked(payload.find).mockResolvedValueOnce(mockItems);

      const percentage = await workflow.calculateCompletionPercentage("cert-1");

      // 3 out of 4 = 75%
      expect(percentage).toBe(75);
    });

    it("should return 0 when no items exist", async () => {
      const mockItems = { docs: [], totalDocs: 0 };

      vi.mocked(payload.find).mockResolvedValueOnce(mockItems);

      const percentage = await workflow.calculateCompletionPercentage("cert-1");

      expect(percentage).toBe(0);
    });
  });

  describe("getAuditTrail", () => {
    it("should return audit trail entries for certification", async () => {
      const mockTrail = {
        docs: [
          {
            action: "submitted",
            entityType: "certification",
            entityId: "cert-1",
            description: "Submitted for review",
            before: "draft",
            after: "submitted",
          },
        ],
        totalDocs: 1,
      };

      vi.mocked(payload.find).mockResolvedValueOnce(mockTrail);

      const trail = await workflow.getAuditTrail("cert-1");

      expect(trail).toHaveLength(1);
      expect(trail[0].action).toBe("submitted");
      expect(trail[0].description).toBe("Submitted for review");
    });
  });

  describe("createAuditorWorkflow factory", () => {
    it("should create an AuditorWorkflow instance", () => {
      const mockPayload = createMockPayload();
      const result = createAuditorWorkflow(mockPayload);

      expect(result).toBeInstanceOf(AuditorWorkflow);
    });
  });
});
