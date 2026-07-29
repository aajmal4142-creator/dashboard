import { AuditorWorkflow } from "@/lib/carbon-trust/auditorWorkflow";
import type { Payload } from "payload";

// Mock Payload
const mockPayload = {
  findByID: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
} as unknown as Payload;

describe("AuditorWorkflow", () => {
  let workflow: AuditorWorkflow;

  beforeEach(() => {
    jest.clearAllMocks();
    workflow = new AuditorWorkflow(mockPayload);
  });

  describe("submitCertificationForReview", () => {
    it("should update certification status to submitted", async () => {
      const mockCert = {
        id: "cert-123",
        organisation: { id: "org-123" },
        status: "draft",
      };

      jest.mocked(mockPayload.findByID).mockResolvedValue(mockCert);
      jest
        .mocked(mockPayload.update)
        .mockResolvedValue({ ...mockCert, status: "submitted" });

      await workflow.submitCertificationForReview("cert-123", "org-123", "user-123");

      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: "carbon-trust-certifications",
          id: "cert-123",
          data: expect.objectContaining({
            status: "submitted",
          }),
        }),
      );
    });

    it("should throw error if certification not found", async () => {
      jest.mocked(mockPayload.findByID).mockResolvedValue(null);

      await expect(
        workflow.submitCertificationForReview("cert-123", "org-123", "user-123"),
      ).rejects.toThrow("Certification not found or access denied");
    });

    it("should throw error if certification belongs to different org", async () => {
      const mockCert = {
        id: "cert-123",
        organisation: { id: "org-456" },
        status: "draft",
      };

      jest.mocked(mockPayload.findByID).mockResolvedValue(mockCert);

      await expect(
        workflow.submitCertificationForReview("cert-123", "org-123", "user-123"),
      ).rejects.toThrow("Certification not found or access denied");
    });

    it("should reject submission if certification is already submitted", async () => {
      const mockCert = {
        id: "cert-123",
        organisation: { id: "org-123" },
        status: "under_review",
      };

      jest.mocked(mockPayload.findByID).mockResolvedValue(mockCert);

      await expect(
        workflow.submitCertificationForReview("cert-123", "org-123", "user-123"),
      ).rejects.toThrow("Cannot submit certification");
    });
  });

  describe("calculateCompletionPercentage", () => {
    it("should return 0% for empty checklist", async () => {
      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: [],
        totalDocs: 0,
      });

      const percentage = await workflow.calculateCompletionPercentage("cert-123");

      expect(percentage).toBe(0);
    });

    it("should calculate completion percentage correctly", async () => {
      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: [
          { id: "item-1", status: "approved" },
          { id: "item-2", status: "approved" },
          { id: "item-3", status: "not_applicable" },
          { id: "item-4", status: "in_progress" },
        ],
        totalDocs: 4,
      });

      const percentage = await workflow.calculateCompletionPercentage("cert-123");

      // 3 out of 4 completed = 75%
      expect(percentage).toBe(75);
    });

    it("should count 'not_applicable' as completed", async () => {
      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: [
          { id: "item-1", status: "not_applicable" },
          { id: "item-2", status: "not_applicable" },
        ],
        totalDocs: 2,
      });

      const percentage = await workflow.calculateCompletionPercentage("cert-123");

      expect(percentage).toBe(100);
    });
  });

  describe("approveCertification", () => {
    it("should throw error if critical items are not approved", async () => {
      const mockCert = {
        id: "cert-123",
        organisation: { id: "org-123" },
        status: "under_review",
      };

      jest.mocked(mockPayload.findByID).mockResolvedValue(mockCert);
      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: [
          { id: "item-1", status: "critical", severity: "critical" },
          { id: "item-2", status: "in_progress", severity: "critical" },
        ],
        totalDocs: 2,
      });

      await expect(
        workflow.approveCertification("cert-123", "org-123", "auditor-123"),
      ).rejects.toThrow("Cannot approve");
    });

    it("should approve certification when all critical items are approved", async () => {
      const mockCert = {
        id: "cert-123",
        organisation: { id: "org-123" },
        status: "under_review",
      };

      jest.mocked(mockPayload.findByID).mockResolvedValue(mockCert);
      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: [
          { id: "item-1", status: "approved", severity: "critical" },
          { id: "item-2", status: "approved", severity: "critical" },
        ],
        totalDocs: 2,
      });

      jest
        .mocked(mockPayload.update)
        .mockResolvedValue({ ...mockCert, status: "approved" });

      await workflow.approveCertification("cert-123", "org-123", "auditor-123");

      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: "carbon-trust-certifications",
          data: expect.objectContaining({
            status: "approved",
          }),
        }),
      );
    });
  });

  describe("getAuditTrail", () => {
    it("should retrieve audit trail for certification", async () => {
      const mockTrail = [
        {
          id: "trail-1",
          action: "certification_submitted",
          description: "Certification submitted",
        },
        {
          id: "trail-2",
          action: "auditor_assigned",
          description: "Auditor assigned",
        },
      ];

      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: mockTrail,
        totalDocs: 2,
      });

      const trail = await workflow.getAuditTrail("cert-123");

      expect(trail).toHaveLength(2);
      expect(trail[0].action).toBe("certification_submitted");
    });

    it("should respect limit parameter", async () => {
      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: [],
        totalDocs: 0,
      });

      await workflow.getAuditTrail("cert-123", 50);

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        }),
      );
    });
  });
});
