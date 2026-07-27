export type SupplierSpendRow = {
  annualSpend: number | null | undefined;
  requestStatus: string;
};

/**
 * % of spend covered by supplier-reported data.
 * Spend with status `submitted` / total spend with a positive annualSpend.
 * Returns null when there is no spend to cover.
 */
export function spendCoveragePct(rows: SupplierSpendRow[]): number | null {
  let total = 0;
  let covered = 0;
  for (const row of rows) {
    const spend =
      typeof row.annualSpend === "number" && row.annualSpend > 0 ? row.annualSpend : 0;
    if (spend <= 0) continue;
    total += spend;
    if (row.requestStatus === "submitted") covered += spend;
  }
  if (total <= 0) return null;
  return Math.round((covered / total) * 1000) / 10;
}

export function responseRatePct(rows: { requestStatus: string }[]): number | null {
  const sent = rows.filter((r) =>
    ["sent", "opened", "submitted", "declined"].includes(r.requestStatus),
  );
  if (sent.length === 0) return null;
  const submitted = sent.filter((r) => r.requestStatus === "submitted").length;
  return Math.round((submitted / sent.length) * 1000) / 10;
}
