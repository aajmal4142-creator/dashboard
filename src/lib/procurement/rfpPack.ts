/**
 * RFP-lite vendor comparison pack — pure, zero I/O, zero Payload imports.
 * Builds a plain-text + CSV export from an already-computed trade-off comparison
 * (weighted ranking + Pareto frontier). Informational vendor comparison only — not a
 * legal filing, not a procurement determination, and not a substitute for a signed RFQ.
 */

import type { TradeoffWeights } from "./tradeoffTypes";

export type RfpPack = {
  generatedAt: string;
  title: string;
  lines: string[];
  plainText: string;
  csv: string;
};

/**
 * Minimal duck-typed comparison shape (deliberately narrower than the full
 * `TradeoffComparisonResult`) so both the server DTO and the client's locally-declared
 * comparison type satisfy it without needing to share every field (e.g. `pareto.excluded`
 * is not needed here).
 */
type RfpScoredOption = {
  id: string;
  name: string;
  cost: number | null;
  tco2e: number | null;
  leadDays: number | null;
  quality: "measured" | "missing";
  message: string | null;
  rank: number | null;
  weightedScore: number | null;
};

type RfpParetoPoint = { id: string; name: string };

export type RfpComparisonInput = {
  ranked: {
    options: RfpScoredOption[];
    ranked: RfpScoredOption[];
    measuredCount: number;
    missingCount: number;
  };
  pareto: {
    frontier: RfpParetoPoint[];
    includeLead: boolean;
  };
};

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function fmt(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function optionLine(row: RfpScoredOption, frontierIds: Set<string>): string {
  const rank = row.rank !== null ? `[${row.rank}]` : "[—]";
  const parts = [
    `${rank} ${row.name}`,
    `cost ${fmt(row.cost, 0)}`,
    `tCO₂e ${fmt(row.tco2e)}`,
  ];
  if (row.leadDays !== null) parts.push(`lead ${fmt(row.leadDays, 0)}d`);
  if (row.weightedScore !== null) parts.push(`score ${fmt(row.weightedScore, 3)}`);
  if (frontierIds.has(row.id)) parts.push("Pareto frontier");
  if (row.quality === "missing")
    parts.push(`MISSING — ${row.message ?? "incomplete data"}`);
  return parts.join(" · ");
}

/**
 * Build an RFP/vendor comparison pack from a saved trade-off scenario + its computed
 * comparison. Missing cost/carbon rows are always listed separately — never folded into
 * a zero.
 */
export function buildRfpPack(input: {
  title: string;
  notes?: string | null;
  weights: TradeoffWeights;
  comparison: RfpComparisonInput;
  generatedAt?: string;
}): RfpPack {
  const { comparison, weights } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const title = input.title.trim() || "Untitled RFQ";
  const frontierIds = new Set(comparison.pareto.frontier.map((p) => p.id));
  const missingRows = comparison.ranked.options.filter((o) => o.quality === "missing");

  const lines: string[] = [
    "ClearESG — RFP / vendor comparison pack",
    `RFQ: ${title}`,
    `Generated: ${generatedAt}`,
  ];
  if (input.notes?.trim()) lines.push(`Notes: ${input.notes.trim()}`);
  lines.push(
    "",
    `Weights — cost ${fmt(weights.cost, 3)} / carbon ${fmt(weights.carbon, 3)} / lead ${fmt(weights.lead, 3)}`,
    `Measured ${comparison.ranked.measuredCount} · Missing ${comparison.ranked.missingCount}`,
    "",
    "This pack is an informational vendor comparison only.",
    "It is not a legal filing, not a signed RFQ, and not a procurement determination.",
    "Confirm final pricing and terms directly with each vendor.",
    "",
    "## Ranked vendors (lower weighted score is better)",
  );

  if (comparison.ranked.ranked.length === 0) {
    lines.push("(No vendor has both measurable cost and carbon.)");
  } else {
    for (const row of comparison.ranked.ranked) {
      lines.push(optionLine(row, frontierIds));
    }
  }

  if (missingRows.length > 0) {
    lines.push("", "## Excluded — missing data (never treated as zero)");
    for (const row of missingRows) {
      lines.push(`- ${row.name}: ${row.message ?? "Missing cost or carbon."}`);
    }
  }

  lines.push(
    "",
    "## Pareto frontier",
    comparison.pareto.frontier.length > 0
      ? `${comparison.pareto.frontier.map((p) => p.name).join(", ")} (${
          comparison.pareto.includeLead ? "cost + carbon + lead" : "cost + carbon"
        })`
      : "(No non-dominated vendor — insufficient measured data.)",
    "",
  );

  const csvHeader = [
    "rank",
    "name",
    "cost",
    "tco2e",
    "leadDays",
    "weightedScore",
    "quality",
    "paretoFrontier",
  ];
  const csvRows = comparison.ranked.options.map((row) =>
    [
      row.rank !== null ? String(row.rank) : "",
      csvCell(row.name),
      row.cost !== null ? String(row.cost) : "",
      row.tco2e !== null ? String(row.tco2e) : "",
      row.leadDays !== null ? String(row.leadDays) : "",
      row.weightedScore !== null ? String(row.weightedScore) : "",
      row.quality,
      frontierIds.has(row.id) ? "yes" : "no",
    ].join(","),
  );
  const csv = [csvHeader.join(","), ...csvRows].join("\n");

  return {
    generatedAt,
    title,
    lines,
    plainText: lines.join("\n"),
    csv,
  };
}
