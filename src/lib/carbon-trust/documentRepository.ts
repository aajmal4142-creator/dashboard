import crypto from "crypto";
import type { Payload } from "payload";

interface DocumentUploadRequest {
  certificationId: string;
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
  description: string;
  tags: string[];
  userId: string;
}

interface DocumentVersion {
  id: string;
  version: number;
  fileName: string;
  uploadedAt: Date;
  uploadedBy: string;
  sha256Hash: string;
  description: string;
  isLatest: boolean;
}

export class DocumentRepository {
  constructor(private payload: Payload) {}

  async uploadDocument(req: DocumentUploadRequest): Promise<DocumentVersion> {
    // Calculate SHA256 hash for integrity verification
    const sha256Hash = crypto.createHash("sha256").update(req.fileBuffer).digest("hex");

    // Generate S3 key
    const timestamp = new Date().getTime();
    const randomId = crypto.randomBytes(4).toString("hex");
    const s3Key = `carbon-trust/${req.certificationId}/${timestamp}-${randomId}-${req.fileName}`;

    // Check if document with same name already exists (for versioning)
    const existingDocs = await this.payload.find({
      collection: "carbon-trust-documents",
      where: {
        and: [
          { certification: { equals: req.certificationId } },
          { fileName: { equals: req.fileName } },
          { isLatest: { equals: true } },
        ],
      },
      limit: 1,
    });

    let version = 1;
    let previousVersionId: string | undefined;

    if (existingDocs.docs.length > 0) {
      const previousDoc = existingDocs.docs[0];
      version = (previousDoc.version as number) + 1;
      previousVersionId = previousDoc.id;

      // Mark previous version as no longer latest
      await this.payload.update({
        collection: "carbon-trust-documents",
        id: previousVersionId,
        data: { isLatest: false },
      });
    }

    // Create new document record
    const document = await this.payload.create({
      collection: "carbon-trust-documents",
      data: {
        certification: req.certificationId,
        fileName: req.fileName,
        fileSize: req.fileBuffer.length,
        mimeType: req.mimeType,
        s3Key,
        sha256Hash,
        version,
        isLatest: true,
        status: "draft",
        description: req.description,
        uploadedBy: req.userId,
        tags: req.tags.map((tag) => ({ tag })),
        previousVersion: previousVersionId,
      },
    });

    return {
      id: document.id as string,
      version,
      fileName: req.fileName,
      uploadedAt: new Date(document.createdAt as string),
      uploadedBy: req.userId,
      sha256Hash,
      description: req.description,
      isLatest: true,
    };
  }

  async getDocumentVersions(
    certificationId: string,
    fileName?: string,
  ): Promise<DocumentVersion[]> {
    const where = fileName
      ? {
          and: [
            { certification: { equals: certificationId } },
            { fileName: { equals: fileName } },
            { status: { not_equals: "deleted" } },
          ],
        }
      : {
          and: [
            { certification: { equals: certificationId } },
            { status: { not_equals: "deleted" } },
          ],
        };

    const result = await this.payload.find({
      collection: "carbon-trust-documents",
      where,
      sort: "-version",
      limit: 100,
    });

    return result.docs.map((doc) => ({
      id: doc.id as string,
      version: doc.version as number,
      fileName: doc.fileName as string,
      uploadedAt: new Date(doc.createdAt as string),
      uploadedBy: (doc.uploadedBy as { id: string }).id,
      sha256Hash: doc.sha256Hash as string,
      description: doc.description as string,
      isLatest: doc.isLatest as boolean,
    }));
  }

  async getLatestDocuments(certificationId: string): Promise<DocumentVersion[]> {
    const result = await this.payload.find({
      collection: "carbon-trust-documents",
      where: {
        and: [
          { certification: { equals: certificationId } },
          { isLatest: { equals: true } },
          { status: { not_equals: "deleted" } },
        ],
      },
      limit: 100,
    });

    return result.docs.map((doc) => ({
      id: doc.id as string,
      version: doc.version as number,
      fileName: doc.fileName as string,
      uploadedAt: new Date(doc.createdAt as string),
      uploadedBy: (doc.uploadedBy as { id: string }).id,
      sha256Hash: doc.sha256Hash as string,
      description: doc.description as string,
      isLatest: doc.isLatest as boolean,
    }));
  }

  async verifyDocumentIntegrity(
    documentId: string,
    expectedHash: string,
  ): Promise<boolean> {
    const doc = await this.payload.findByID({
      collection: "carbon-trust-documents",
      id: documentId,
    });

    if (!doc) return false;

    return (doc.sha256Hash as string) === expectedHash;
  }

  async markDocumentAsApproved(
    documentId: string,
    auditorComment?: string,
  ): Promise<void> {
    await this.payload.update({
      collection: "carbon-trust-documents",
      id: documentId,
      data: {
        status: "approved",
        auditorComments: auditorComment,
        reviewedAt: new Date().toISOString(),
      },
    });
  }

  async searchDocuments(
    certificationId: string,
    query: string,
    tags?: string[],
  ): Promise<DocumentVersion[]> {
    const where =
      tags && tags.length > 0
        ? {
            and: [
              { certification: { equals: certificationId } },
              {
                or: [
                  { fileName: { contains: query } },
                  { description: { contains: query } },
                ],
              },
              { tags: { some: { tag: { in: tags } } } },
              { status: { not_equals: "deleted" } },
            ],
          }
        : {
            and: [
              { certification: { equals: certificationId } },
              {
                or: [
                  { fileName: { contains: query } },
                  { description: { contains: query } },
                ],
              },
              { status: { not_equals: "deleted" } },
            ],
          };

    const result = await this.payload.find({
      collection: "carbon-trust-documents",
      where,
      limit: 100,
    });

    return result.docs.map((doc) => ({
      id: doc.id as string,
      version: doc.version as number,
      fileName: doc.fileName as string,
      uploadedAt: new Date(doc.createdAt as string),
      uploadedBy: (doc.uploadedBy as { id: string }).id,
      sha256Hash: doc.sha256Hash as string,
      description: doc.description as string,
      isLatest: doc.isLatest as boolean,
    }));
  }
}

export function createDocumentRepository(payload: Payload): DocumentRepository {
  return new DocumentRepository(payload);
}
