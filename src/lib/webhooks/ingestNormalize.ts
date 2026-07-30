import { z } from "zod";
import { supplierKeyFrom } from "@/lib/suppliers/supplierKey";

const QualitySchema = z.enum(["measured", "calculated", "estimated", "missing"]);

const RawDatapointSchema = z
  .object({
    metricKey: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    value: z.number().nullable().optional(),
    quality: QualitySchema.optional(),
    unit: z.string().optional(),
    source: z.string().optional(),
    supplierId: z.string().optional(),
    externalId: z.string().optional(),
  })
  .superRefine((row, ctx) => {
    if (!row.metricKey && !row.type) {
      ctx.addIssue({
        code: "custom",
        message: "metricKey or type is required",
        path: ["metricKey"],
      });
    }
  });

const CompanySchema = z.object({
  externalId: z.string().optional(),
  name: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  billingContact: z.string().optional(),
  dataPoints: z.array(RawDatapointSchema).optional(),
});

const SupplierSchema = z.object({
  externalId: z.string().optional(),
  name: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  supplierId: z.string().optional(),
  emissionsData: z.array(RawDatapointSchema).optional(),
});

const EnvelopeSchema = z.object({
  dryRun: z.boolean().optional(),
  records: z.array(RawDatapointSchema).optional(),
  datapoints: z.array(RawDatapointSchema).optional(),
  emissions: z.array(RawDatapointSchema).optional(),
  company: CompanySchema.optional(),
  suppliers: z.array(SupplierSchema).optional(),
});

export type NormalizedIngestRecord = {
  index: number;
  metricKey: string;
  value: number | null | undefined;
  quality: "measured" | "calculated" | "estimated" | "missing";
  unit?: string;
  source: string;
  supplierKey: string;
  supplierId?: string;
  externalId?: string;
};

export type NormalizeResult = {
  dryRun: boolean;
  records: NormalizedIngestRecord[];
  errors: Array<{ index: number; error: string; path?: string }>;
};

function resolveMetricKey(row: z.infer<typeof RawDatapointSchema>): string {
  if (row.metricKey?.trim()) return row.metricKey.trim();
  const type = row.type?.trim() ?? "";
  const category = row.category?.trim();
  if (category) return `${category}.${type}`;
  return type;
}

function toNormalized(
  row: z.infer<typeof RawDatapointSchema>,
  index: number,
  defaults?: { supplierId?: string; externalId?: string },
): NormalizedIngestRecord {
  const supplierId = row.supplierId ?? defaults?.supplierId;
  return {
    index,
    metricKey: resolveMetricKey(row),
    value: row.value,
    quality: row.quality ?? "estimated",
    unit: row.unit,
    source: row.source ?? "api",
    supplierKey: supplierKeyFrom(supplierId),
    supplierId,
    externalId: row.externalId ?? defaults?.externalId,
  };
}

function pushRawList(
  list: z.infer<typeof RawDatapointSchema>[] | undefined,
  into: Array<z.infer<typeof RawDatapointSchema>>,
  defaults?: { supplierId?: string; externalId?: string },
): void {
  if (!list) return;
  for (const row of list) {
    into.push({
      ...row,
      supplierId: row.supplierId ?? defaults?.supplierId,
      externalId: row.externalId ?? defaults?.externalId,
    });
  }
}

/**
 * Accept single datapoint, array, or company/emissions/supplier envelopes.
 * Line-by-line validation errors are returned; valid rows still proceed.
 */
export function normalizeIngestPayload(
  body: unknown,
  options?: { dryRunDefault?: boolean },
): NormalizeResult {
  const dryRunDefault = options?.dryRunDefault ?? false;
  const errors: Array<{ index: number; error: string; path?: string }> = [];
  const rawRows: Array<z.infer<typeof RawDatapointSchema>> = [];
  let dryRun = dryRunDefault;

  if (Array.isArray(body)) {
    if (body.length === 0) {
      return {
        dryRun,
        records: [],
        errors: [{ index: 0, error: "Batch must contain at least one record" }],
      };
    }
    if (body.length > 1000) {
      return {
        dryRun,
        records: [],
        errors: [{ index: 0, error: "Batch exceeds maximum of 1000 records" }],
      };
    }
    for (const item of body) {
      rawRows.push(item as z.infer<typeof RawDatapointSchema>);
    }
  } else if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const looksLikeEnvelope =
      "records" in obj ||
      "datapoints" in obj ||
      "emissions" in obj ||
      "company" in obj ||
      "suppliers" in obj ||
      "dryRun" in obj;

    if (looksLikeEnvelope) {
      const parsed = EnvelopeSchema.safeParse(body);
      if (!parsed.success) {
        return {
          dryRun,
          records: [],
          errors: parsed.error.issues.map((issue, i) => ({
            index: i,
            error: issue.message,
            path: issue.path.join("."),
          })),
        };
      }
      dryRun = parsed.data.dryRun ?? dryRunDefault;
      pushRawList(parsed.data.records, rawRows);
      pushRawList(parsed.data.datapoints, rawRows);
      pushRawList(parsed.data.emissions, rawRows);
      if (parsed.data.company?.dataPoints) {
        pushRawList(parsed.data.company.dataPoints, rawRows, {
          externalId: parsed.data.company.externalId,
        });
      }
      if (parsed.data.suppliers) {
        for (const supplier of parsed.data.suppliers) {
          pushRawList(supplier.emissionsData, rawRows, {
            supplierId: supplier.supplierId,
            externalId: supplier.externalId,
          });
        }
      }
    } else {
      rawRows.push(obj as z.infer<typeof RawDatapointSchema>);
    }
  } else {
    return {
      dryRun,
      records: [],
      errors: [{ index: 0, error: "Request body must be a JSON object or array" }],
    };
  }

  if (rawRows.length === 0) {
    return {
      dryRun,
      records: [],
      errors: [{ index: 0, error: "No datapoints found in payload" }],
    };
  }

  if (rawRows.length > 1000) {
    return {
      dryRun,
      records: [],
      errors: [{ index: 0, error: "Batch exceeds maximum of 1000 records" }],
    };
  }

  const records: NormalizedIngestRecord[] = [];
  rawRows.forEach((row, index) => {
    const parsed = RawDatapointSchema.safeParse(row);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push({
        index,
        error: first?.message ?? "Invalid datapoint",
        path: first?.path.join(".") || undefined,
      });
      return;
    }
    if (parsed.data.quality !== "missing" && parsed.data.value === undefined) {
      // value may be omitted only when quality is missing; otherwise allow null
    }
    try {
      records.push(toNormalized(parsed.data, index));
    } catch (err) {
      errors.push({
        index,
        error: err instanceof Error ? err.message : "Invalid datapoint",
      });
    }
  });

  return { dryRun, records, errors };
}
