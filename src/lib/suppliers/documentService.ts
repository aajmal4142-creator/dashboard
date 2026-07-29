import { getPayload, type Where } from "payload";
import fs from "fs";
import path from "path";
import config from "@/payload.config";

export interface DocumentUploadResult {
  success: boolean;
  documentId?: string;
  error?: string;
  virusScanStatus: "clean" | "infected" | "inconclusive" | "pending";
  fileSize: number;
}

const DOC_TYPES = [
  "sustainability_report",
  "esg_report",
  "certification",
  "carbon_data",
  "audit_report",
  "verification",
  "policy",
  "other",
] as const;

type DocType = (typeof DOC_TYPES)[number];

function toDocType(value: string): DocType {
  return (DOC_TYPES as readonly string[]).includes(value) ? (value as DocType) : "other";
}

/**
 * Validate file before upload
 */
export function validateDocument(
  file: {
    name: string;
    size: number;
    type: string;
  },
  maxSizeBytes: number = 50 * 1024 * 1024, // 50MB default
): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${maxSizeBytes / 1024 / 1024}MB`,
    };
  }

  // Check file type (only allow documents)
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "text/plain",
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed. Allowed: PDF, Word, Excel, Images, Text`,
    };
  }

  return { valid: true };
}

/**
 * Simulate virus scan (in production, integrate with VirusTotal or ClamAV)
 */
export async function scanDocument(
  _filePath: string,
): Promise<{ status: "clean" | "infected" | "inconclusive"; result: string }> {
  try {
    // Placeholder: In production, call VirusTotal or ClamAV
    // For now, return clean status
    return {
      status: "clean",
      result: "Mock scan: File appears clean",
    };
  } catch (error) {
    return {
      status: "inconclusive",
      result: `Scan error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

/**
 * Upload document to storage
 */
export async function uploadDocument(
  organisationId: string,
  supplierId: string,
  file: {
    data: Buffer;
    name: string;
    size: number;
    type: string;
  },
  docType: string,
  userId: string,
  metadata?: {
    tags?: string[];
    description?: string;
    expiryDate?: Date;
  },
): Promise<DocumentUploadResult> {
  // Validate file
  const validation = validateDocument(file);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      virusScanStatus: "pending",
      fileSize: file.size,
    };
  }

  try {
    // Store file locally (in production, use S3)
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "documents",
      organisationId,
      supplierId,
    );
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, `${Date.now()}-${file.name}`);
    fs.writeFileSync(filePath, file.data);

    // Virus scan
    const scanResult = await scanDocument(filePath);

    // Create document record in Payload
    const payload = await getPayload({ config });
    const doc = await payload.create({
      collection: "supplier-documents",
      data: {
        organisation: organisationId,
        supplier: supplierId,
        filename: file.name,
        docType: toDocType(docType),
        fileSize: file.size,
        mimeType: file.type,
        filePath: `/documents/${organisationId}/${supplierId}/${path.basename(filePath)}`,
        version: "1.0",
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        expiryDate: metadata?.expiryDate?.toISOString(),
        tags: metadata?.tags ?? [],
        description: metadata?.description,
        virusScanStatus: scanResult.status,
        virusScanResult: scanResult.result,
      },
      overrideAccess: true,
    });

    return {
      success: true,
      documentId: String(doc.id),
      virusScanStatus: scanResult.status,
      fileSize: file.size,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
      virusScanStatus: "pending",
      fileSize: file.size,
    };
  }
}

/**
 * Search documents
 */
export async function searchDocuments(
  organisationId: string,
  query: {
    supplierId?: string;
    docType?: string;
    tags?: string[];
    searchTerm?: string;
    expiryDaysBefore?: number; // Find certs expiring within N days
  },
): Promise<
  Array<{
    id: string;
    filename: string;
    docType: string;
    uploadedAt: Date;
    expiryDate?: Date;
    supplier: { id: string; name: string };
  }>
> {
  const payload = await getPayload({ config });

  // Build where clause
  const where: Where = {
    organisation: { equals: organisationId },
  };

  if (query.supplierId) {
    where.supplier = { equals: query.supplierId };
  }

  if (query.docType) {
    where.docType = { equals: query.docType };
  }

  // Execute search
  const results = await payload.find({
    collection: "supplier-documents",
    where,
    limit: 1000,
    sort: "-uploadedAt",
    overrideAccess: true,
  });

  // Filter by search term and expiry (client-side for now)
  let filtered = results.docs.map((doc) => {
    const supplierRel = doc.supplier;
    return {
      id: String(doc.id),
      filename: doc.filename,
      docType: doc.docType,
      uploadedAt: new Date(doc.updatedAt),
      expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
      supplier: {
        id: typeof supplierRel === "string" ? supplierRel : String(supplierRel.id),
        name: typeof supplierRel === "string" ? "Unknown" : supplierRel.name,
      },
    };
  });

  if (query.searchTerm) {
    const term = query.searchTerm.toLowerCase();
    filtered = filtered.filter(
      (doc) =>
        doc.filename.toLowerCase().includes(term) ||
        doc.supplier.name.toLowerCase().includes(term),
    );
  }

  if (query.expiryDaysBefore && query.expiryDaysBefore > 0) {
    const today = new Date();
    const cutoff = new Date(
      today.getTime() + query.expiryDaysBefore * 24 * 60 * 60 * 1000,
    );
    filtered = filtered.filter((doc) => doc.expiryDate && doc.expiryDate <= cutoff);
  }

  return filtered;
}

/**
 * Get document details with linked items
 */
export async function getDocumentDetails(documentId: string) {
  const payload = await getPayload({ config });

  const doc = await payload.findByID({
    collection: "supplier-documents",
    id: documentId,
    overrideAccess: true,
  });

  if (!doc) return null;

  return {
    id: String(doc.id),
    filename: doc.filename,
    docType: doc.docType,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    version: doc.version,
    uploadedAt: new Date(doc.updatedAt),
    uploadedBy:
      typeof doc.uploadedBy === "string" ? doc.uploadedBy : doc.uploadedBy.email,
    expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null,
    virusScanStatus: doc.virusScanStatus,
    description: doc.description,
    tags: doc.tags ?? [],
    linkedCheckpoints: doc.linkedCheckpoints ?? [],
    linkedFindings: doc.linkedFindings ?? [],
  };
}

/**
 * Link document to compliance checkpoint or audit finding
 */
export async function linkDocumentToCheckpoint(
  documentId: string,
  checkpointId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = await getPayload({ config });

    const doc = await payload.findByID({
      collection: "supplier-documents",
      id: documentId,
      overrideAccess: true,
    });

    const linkedCheckpoints = [...(doc.linkedCheckpoints ?? []), checkpointId];

    await payload.update({
      collection: "supplier-documents",
      id: documentId,
      data: { linkedCheckpoints },
      overrideAccess: true,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check for expiring certifications
 */
export async function getExpiringCertifications(
  organisationId: string,
  daysUntilExpiry: number = 30,
): Promise<
  Array<{
    supplierId: string;
    supplierName: string;
    documentName: string;
    expiryDate: Date;
    daysRemaining: number;
  }>
> {
  const expiringDocs = await searchDocuments(organisationId, {
    docType: "certification",
    expiryDaysBefore: daysUntilExpiry,
  });

  const today = new Date();
  return expiringDocs.map((doc) => ({
    supplierId: doc.supplier.id,
    supplierName: doc.supplier.name,
    documentName: doc.filename,
    expiryDate: doc.expiryDate!,
    daysRemaining: Math.ceil(
      (doc.expiryDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    ),
  }));
}
