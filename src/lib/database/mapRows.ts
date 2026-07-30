import type { FieldMappings } from "./types";

export type MappedDatapointRow = {
  index: number;
  metricKey: string;
  value: number | null;
  quality: "measured" | "calculated" | "estimated" | "missing";
  unit?: string;
  externalId?: string;
  supplierId?: string;
};

const QUALITIES = new Set(["measured", "calculated", "estimated", "missing"]);

function cellString(row: Record<string, unknown>, column: string): string | undefined {
  const v = row[column];
  if (v == null) return undefined;
  if (typeof v === "object" && v !== null && "value" in v) {
    const inner = (v as { value: unknown }).value;
    return inner == null ? undefined : String(inner);
  }
  return String(v);
}

function cellNumber(row: Record<string, unknown>, column: string): number | null {
  const v = row[column];
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "object" && v !== null && "value" in v) {
    const inner = (v as { value: unknown }).value;
    if (inner == null) return null;
    const n = typeof inner === "number" ? inner : Number(inner);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map raw connector rows into ClearESG ingest-shaped records using fieldMappings.
 */
export function mapRowsToDatapoints(
  rows: Record<string, unknown>[],
  mappings: FieldMappings,
): { records: MappedDatapointRow[]; errors: Array<{ index: number; error: string }> } {
  const records: MappedDatapointRow[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  const byTarget = new Map(mappings.columns.map((c) => [c.target, c.source] as const));
  const defaults = mappings.defaults ?? {};

  rows.forEach((row, index) => {
    try {
      const metricCol = byTarget.get("metricKey");
      const metricKey =
        (metricCol ? cellString(row, metricCol) : undefined)?.trim() ||
        defaults.metricKey?.trim();
      if (!metricKey) {
        errors.push({
          index,
          error: "Missing metricKey (map a column or set defaults.metricKey)",
        });
        return;
      }

      const valueCol = byTarget.get("value");
      let value: number | null = null;
      if (valueCol) {
        value = cellNumber(row, valueCol);
      }

      const qualityCol = byTarget.get("quality");
      let quality: MappedDatapointRow["quality"] = defaults.quality ?? "measured";
      if (qualityCol) {
        const q = cellString(row, qualityCol)?.trim().toLowerCase();
        if (q && QUALITIES.has(q)) {
          quality = q as MappedDatapointRow["quality"];
        }
      }
      if (value == null && quality !== "missing") {
        quality = "missing";
      }

      const unitCol = byTarget.get("unit");
      const unit =
        (unitCol ? cellString(row, unitCol) : undefined)?.trim() || defaults.unit?.trim();

      const externalCol = byTarget.get("externalId");
      const externalId = externalCol ? cellString(row, externalCol)?.trim() : undefined;

      const supplierCol = byTarget.get("supplierId");
      const supplierId = supplierCol ? cellString(row, supplierCol)?.trim() : undefined;

      records.push({
        index,
        metricKey,
        value,
        quality,
        unit,
        externalId,
        supplierId,
      });
    } catch (err) {
      errors.push({
        index,
        error: err instanceof Error ? err.message : "Row mapping failed",
      });
    }
  });

  return { records, errors };
}

export function mappingSourceColumns(mappings: FieldMappings): string[] {
  const cols = mappings.columns.map((c) => c.source.trim()).filter(Boolean);
  return [...new Set(cols)];
}

export function parseFieldMappings(raw: unknown): FieldMappings | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.columns)) return null;
  const columns: FieldMappings["columns"] = [];
  for (const item of obj.columns) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.source !== "string" || typeof c.target !== "string") continue;
    const target = c.target as FieldMappings["columns"][number]["target"];
    const allowed = new Set([
      "metricKey",
      "value",
      "unit",
      "quality",
      "externalId",
      "supplierId",
    ]);
    if (!allowed.has(target)) continue;
    columns.push({ source: c.source, target });
  }
  const defaultsRaw =
    obj.defaults && typeof obj.defaults === "object"
      ? (obj.defaults as Record<string, unknown>)
      : undefined;
  const defaults: FieldMappings["defaults"] = {};
  if (defaultsRaw) {
    if (typeof defaultsRaw.metricKey === "string") {
      defaults.metricKey = defaultsRaw.metricKey;
    }
    if (typeof defaultsRaw.unit === "string") {
      defaults.unit = defaultsRaw.unit;
    }
    if (typeof defaultsRaw.quality === "string" && QUALITIES.has(defaultsRaw.quality)) {
      defaults.quality = defaultsRaw.quality as NonNullable<
        FieldMappings["defaults"]
      >["quality"];
    }
  }
  return { columns, defaults };
}
