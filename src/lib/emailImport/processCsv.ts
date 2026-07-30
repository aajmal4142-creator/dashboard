import {
  dryRunImport,
  parseCsvToImportRows,
  type DryRunResult,
  type ExistingDatapoint,
  type ImportRowInput,
} from "@/lib/data";

export type ValidateInboundCsvResult =
  | {
      ok: true;
      rows: ImportRowInput[];
      diff: DryRunResult;
    }
  | {
      ok: false;
      error: string;
      rows: ImportRowInput[];
      diff?: DryRunResult;
    };

/**
 * Parse CSV text and validate against existing datapoints (reuse F1/import path).
 */
export function validateInboundCsv(opts: {
  csvText: string;
  existing: ExistingDatapoint[];
  periodLocked: boolean;
}): ValidateInboundCsvResult {
  const rows = parseCsvToImportRows(opts.csvText);
  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "CSV has no data rows. Include a header (metricKey,value,unit,quality) and at least one row.",
      rows: [],
    };
  }

  const diff = dryRunImport({
    rows,
    existing: opts.existing,
    periodLocked: opts.periodLocked,
  });

  if (opts.periodLocked) {
    return {
      ok: false,
      error: "Reporting period is locked or published. Writes are refused.",
      rows,
      diff,
    };
  }

  const writable = diff.rows.filter(
    (r) => (r.kind === "added" || r.kind === "changed") && r.after,
  );

  if (diff.rejected > 0 && writable.length === 0) {
    return {
      ok: false,
      error: "Nothing to import — all rows were rejected.",
      rows,
      diff,
    };
  }

  return { ok: true, rows, diff };
}
