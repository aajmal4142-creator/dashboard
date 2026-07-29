import { getPayload } from "payload";
import config from "@/payload.config";

export interface BulkImportRow {
  supplier_name: string;
  email: string;
  industry?: string;
  region?: string;
  annual_spend?: string;
  tier?: string;
}

const SUPPLIER_CATEGORIES = [
  "purchased_goods",
  "capital_goods",
  "transport",
  "waste",
  "business_travel",
  "other",
] as const;

type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];

function mapSupplierCategory(industry?: string): SupplierCategory {
  if (!industry) return "other";
  const normalized = industry
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if ((SUPPLIER_CATEGORIES as readonly string[]).includes(normalized)) {
    return normalized as SupplierCategory;
  }
  const labelMap: Record<string, SupplierCategory> = {
    "purchased goods": "purchased_goods",
    "capital goods": "capital_goods",
    "business travel": "business_travel",
  };
  return labelMap[industry.trim().toLowerCase()] ?? "other";
}

export interface BulkImportResult {
  rowIndex: number;
  supplierName: string;
  email: string;
  status: "created" | "existing" | "error" | "skipped";
  supplierId?: string;
  message?: string;
}

export interface BulkImportSummary {
  totalRows: number;
  created: number;
  existing: number;
  errors: number;
  skipped: number;
  results: BulkImportResult[];
  errorDetails: string[];
}

/**
 * Parse CSV data
 */
export function parseCSV(csvData: string): BulkImportRow[] {
  const lines = csvData.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((col) => col.trim().toLowerCase());
  const rows: BulkImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((val) => val.trim());
    const row: Record<string, string> = {};

    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] || "";
    }

    rows.push({
      supplier_name: row.supplier_name || row.name || "",
      email: row.email || row.contact_email || "",
      industry: row.industry || row.category || "",
      region: row.region || row.country || "",
      annual_spend: row.annual_spend || row.spend || "",
      tier: row.tier || "",
    });
  }

  return rows;
}

/**
 * Validate CSV row
 */
export function validateRow(
  row: BulkImportRow,
  rowIndex: number,
): { valid: boolean; error?: string } {
  if (!row.supplier_name || !row.supplier_name.trim()) {
    return { valid: false, error: `Row ${rowIndex}: supplier_name required` };
  }

  if (!row.email || !row.email.trim().includes("@")) {
    return { valid: false, error: `Row ${rowIndex}: valid email required` };
  }

  // Validate annual_spend if provided
  if (row.annual_spend && isNaN(parseFloat(row.annual_spend))) {
    return { valid: false, error: `Row ${rowIndex}: annual_spend must be numeric` };
  }

  return { valid: true };
}

/**
 * Perform bulk import of suppliers
 */
export async function performBulkImport(
  organisationId: string,
  rows: BulkImportRow[],
  _userId: string,
): Promise<BulkImportSummary> {
  const payload = await getPayload({ config });
  const results: BulkImportResult[] = [];
  const errorDetails: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const validation = validateRow(row, i + 2); // +2 for header row and 1-indexed

    if (!validation.valid) {
      results.push({
        rowIndex: i + 1,
        supplierName: row.supplier_name,
        email: row.email,
        status: "error",
        message: validation.error,
      });
      errorDetails.push(validation.error!);
      continue;
    }

    try {
      // Check for existing supplier
      const existing = await payload.find({
        collection: "suppliers",
        where: {
          and: [
            { organisation: { equals: organisationId } },
            { contactEmail: { equals: row.email.toLowerCase() } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      });

      if (existing.docs.length > 0) {
        results.push({
          rowIndex: i + 1,
          supplierName: row.supplier_name,
          email: row.email,
          status: "existing",
          supplierId: String(existing.docs[0].id),
          message: "Supplier already exists",
        });
        continue;
      }

      // Create new supplier
      const newSupplier = await payload.create({
        collection: "suppliers",
        data: {
          organisation: organisationId,
          name: row.supplier_name,
          contactEmail: row.email.toLowerCase(),
          category: mapSupplierCategory(row.industry),
          annualSpend: row.annual_spend ? parseFloat(row.annual_spend) : undefined,
          requestStatus: "not_sent",
          reminderCount: 0,
        },
        overrideAccess: true,
      });

      results.push({
        rowIndex: i + 1,
        supplierName: row.supplier_name,
        email: row.email,
        status: "created",
        supplierId: String(newSupplier.id),
        message: "Created successfully",
      });
    } catch (error) {
      results.push({
        rowIndex: i + 1,
        supplierName: row.supplier_name,
        email: row.email,
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      errorDetails.push(
        `Row ${i + 2}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  const summary: BulkImportSummary = {
    totalRows: rows.length,
    created: results.filter((r) => r.status === "created").length,
    existing: results.filter((r) => r.status === "existing").length,
    errors: results.filter((r) => r.status === "error").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
    errorDetails,
  };

  return summary;
}

/**
 * Send bulk questionnaires to imported suppliers
 */
export async function sendBulkQuestionnaires(
  organisationId: string,
  supplierIds: string[],
  periodId?: string,
): Promise<{
  sent: number;
  failed: number;
  errors: string[];
}> {
  const payload = await getPayload({ config });
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const supplierId of supplierIds) {
    try {
      const supplier = await payload.findByID({
        collection: "suppliers",
        id: supplierId,
        overrideAccess: true,
      });

      if (!supplier || supplier.organisation !== organisationId) {
        failed++;
        errors.push(`Supplier ${supplierId} not found or unauthorized`);
        continue;
      }

      // Update supplier with request status
      await payload.update({
        collection: "suppliers",
        id: supplierId,
        data: {
          requestStatus: "sent",
          sentAt: new Date().toISOString(),
          requestPeriod: periodId,
          reminderCount: 0,
        },
        overrideAccess: true,
      });

      // In production, send email here via email service
      // sendQuestionnaireEmail(supplier.contactEmail, supplier.requestToken);

      sent++;
    } catch (error) {
      failed++;
      errors.push(
        `Error sending to ${supplierId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  return { sent, failed, errors };
}

/**
 * Generate import preview (dry-run)
 */
export async function generateImportPreview(
  organisationId: string,
  rows: BulkImportRow[],
): Promise<{
  valid: number;
  duplicates: number;
  errors: number;
  preview: Array<{
    row: BulkImportRow;
    status: "new" | "duplicate" | "error";
    message: string;
  }>;
}> {
  const payload = await getPayload({ config });
  const preview: Array<{
    row: BulkImportRow;
    status: "new" | "duplicate" | "error";
    message: string;
  }> = [];

  let valid = 0;
  let duplicates = 0;
  let errors = 0;

  for (const row of rows) {
    const validation = validateRow(row, preview.length + 1);

    if (!validation.valid) {
      preview.push({
        row,
        status: "error",
        message: validation.error || "Invalid row",
      });
      errors++;
      continue;
    }

    // Check for existing
    const existing = await payload.find({
      collection: "suppliers",
      where: {
        and: [
          { organisation: { equals: organisationId } },
          { contactEmail: { equals: row.email.toLowerCase() } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });

    if (existing.docs.length > 0) {
      preview.push({
        row,
        status: "duplicate",
        message: "Already in system",
      });
      duplicates++;
    } else {
      preview.push({
        row,
        status: "new",
        message: "Will be created",
      });
      valid++;
    }
  }

  return { valid, duplicates, errors, preview };
}
