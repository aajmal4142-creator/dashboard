import { DocumentRepository } from "@/lib/carbon-trust/documentRepository";
import type { Payload } from "payload";

const mockPayload = {
  find: jest.fn(),
  findByID: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
} as unknown as Payload;

describe("DocumentRepository", () => {
  let repo: DocumentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DocumentRepository(mockPayload);
  });

  describe("uploadDocument", () => {
    it("should create a new document with version 1", async () => {
      const buffer = Buffer.from("test content");

      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: [],
        totalDocs: 0,
      });

      jest.mocked(mockPayload.create).mockResolvedValue({
        id: "doc-123",
        version: 1,
        isLatest: true,
      });

      const result = await repo.uploadDocument({
        certificationId: "cert-123",
        fileName: "report.pdf",
        fileBuffer: buffer,
        mimeType: "application/pdf",
        description: "Test report",
        tags: ["report"],
        userId: "user-123",
      });

      expect(result.version).toBe(1);
      expect(result.isLatest).toBe(true);
      expect(mockPayload.create).toHaveBeenCalled();
    });

    it("should increment version for existing documents", async () => {
      const buffer = Buffer.from("updated content");

      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: [
          {
            id: "doc-existing",
            version: 1,
            fileName: "report.pdf",
            isLatest: true,
          },
        ],
        totalDocs: 1,
      });

      jest.mocked(mockPayload.create).mockResolvedValue({
        id: "doc-124",
        version: 2,
        isLatest: true,
      });

      const result = await repo.uploadDocument({
        certificationId: "cert-123",
        fileName: "report.pdf",
        fileBuffer: buffer,
        mimeType: "application/pdf",
        description: "Updated report",
        tags: ["report"],
        userId: "user-123",
      });

      expect(result.version).toBe(2);
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isLatest: false,
          }),
        }),
      );
    });

    it("should calculate SHA256 hash for document", async () => {
      const buffer = Buffer.from("test content");

      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: [],
        totalDocs: 0,
      });

      jest.mocked(mockPayload.create).mockResolvedValue({
        id: "doc-123",
        version: 1,
      });

      await repo.uploadDocument({
        certificationId: "cert-123",
        fileName: "report.pdf",
        fileBuffer: buffer,
        mimeType: "application/pdf",
        description: "Test report",
        tags: [],
        userId: "user-123",
      });

      // Verify SHA256 hash was calculated
      expect(mockPayload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sha256Hash: expect.any(String),
          }),
        }),
      );
    });
  });

  describe("getDocumentVersions", () => {
    it("should retrieve all versions of a document", async () => {
      const versions = [
        { id: "doc-1", version: 2, fileName: "report.pdf", isLatest: true },
        { id: "doc-2", version: 1, fileName: "report.pdf", isLatest: false },
      ];

      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: versions,
        totalDocs: 2,
      });

      const result = await repo.getDocumentVersions("cert-123", "report.pdf");

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(2);
      expect(result[1].version).toBe(1);
    });
  });

  describe("getLatestDocuments", () => {
    it("should retrieve only latest version of each document", async () => {
      const docs = [
        { id: "doc-1", fileName: "report.pdf", isLatest: true, version: 2 },
        { id: "doc-2", fileName: "evidence.xlsx", isLatest: true, version: 1 },
      ];

      jest.mocked(mockPayload.find).mockResolvedValue({
        docs,
        totalDocs: 2,
      });

      const result = await repo.getLatestDocuments("cert-123");

      expect(result).toHaveLength(2);
      expect(result.every((doc) => doc.isLatest)).toBe(true);
    });
  });

  describe("verifyDocumentIntegrity", () => {
    it("should return true for matching hash", async () => {
      const expectedHash = "abc123def456";

      jest.mocked(mockPayload.findByID).mockResolvedValue({
        id: "doc-123",
        sha256Hash: expectedHash,
      });

      const result = await repo.verifyDocumentIntegrity("doc-123", expectedHash);

      expect(result).toBe(true);
    });

    it("should return false for non-matching hash", async () => {
      jest.mocked(mockPayload.findByID).mockResolvedValue({
        id: "doc-123",
        sha256Hash: "abc123def456",
      });

      const result = await repo.verifyDocumentIntegrity("doc-123", "different_hash");

      expect(result).toBe(false);
    });

    it("should return false if document not found", async () => {
      jest.mocked(mockPayload.findByID).mockResolvedValue(null);

      const result = await repo.verifyDocumentIntegrity("doc-123", "any_hash");

      expect(result).toBe(false);
    });
  });

  describe("searchDocuments", () => {
    it("should search documents by query", async () => {
      const docs = [
        { id: "doc-1", fileName: "emissions_report.pdf", description: "Annual report" },
      ];

      jest.mocked(mockPayload.find).mockResolvedValue({
        docs,
        totalDocs: 1,
      });

      const result = await repo.searchDocuments("cert-123", "emissions");

      expect(result).toHaveLength(1);
    });

    it("should filter by tags when provided", async () => {
      jest.mocked(mockPayload.find).mockResolvedValue({
        docs: [],
        totalDocs: 0,
      });

      await repo.searchDocuments("cert-123", "report", ["critical"]);

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            and: expect.arrayContaining([expect.any(Object)]),
          }),
        }),
      );
    });
  });
});
