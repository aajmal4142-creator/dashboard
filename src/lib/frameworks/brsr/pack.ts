/**
 * BRSR SEBI-style readiness pack — pure, zero I/O.
 */

import { BRSR_PRINCIPLES } from "./catalog";
import type { BrsrCoverageResult, BrsrGapKind } from "./types";

function gapKindLabel(kind: BrsrGapKind | null): string {
  switch (kind) {
    case "missing_data":
      return "missing metric";
    case "missing_evidence":
      return "missing evidence";
    case "unmapped":
      return "not tracked in ClearESG";
    case "weak_quality":
      return "estimated / weak quality";
    default:
      return "open";
  }
}

export type BrsrPack = {
  generatedAt: string;
  periodLabel: string;
  lines: string[];
  plainText: string;
};

export function buildBrsrPack(input: {
  coverage: BrsrCoverageResult;
  periodLabel?: string | null;
  generatedAt?: string;
}): BrsrPack {
  const { coverage } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const periodLabel = input.periodLabel?.trim() || coverage.periodId;

  const lines: string[] = [
    "ClearESG — BRSR (SEBI) readiness pack",
    `Period: ${periodLabel}`,
    `Generated: ${generatedAt}`,
    "",
    `Core: ${coverage.core.pctCovered}% (${coverage.core.covered}/${coverage.core.total})`,
    `Comprehensive: ${coverage.comprehensive.pctCovered}% (${coverage.comprehensive.covered}/${coverage.comprehensive.total})`,
    "",
    "This pack is a data-readiness checklist for BRSR Essential/Leadership disclosures.",
    "It is not a SEBI filing and not an assurance opinion.",
    "",
  ];

  for (const principle of BRSR_PRINCIPLES) {
    const row = coverage.principles.find((p) => p.principle.id === principle.id);
    lines.push(`## ${principle.id} — ${principle.shortTitle}`);
    lines.push(principle.title);
    lines.push("");

    const disclosures = row?.disclosures ?? [];
    if (disclosures.length === 0) {
      lines.push("(No catalogued disclosures.)");
      lines.push("");
      continue;
    }

    for (const d of disclosures) {
      const status = d.state.toUpperCase();
      const gap = d.state === "covered" ? "" : ` — ${gapKindLabel(d.gapKind)}`;
      lines.push(`[${status}] ${d.code} (${d.level}) ${d.label}${gap}`);
      if (d.note) lines.push(`  Note: ${d.note}`);
      if (d.presentMetricKeys?.length) {
        lines.push(`  Present: ${d.presentMetricKeys.join(", ")}`);
      }
      if (d.missingMetricKeys?.length) {
        lines.push(`  Missing: ${d.missingMetricKeys.join(", ")}`);
      }
      if (d.state !== "covered" && d.gapKind !== "unmapped") {
        lines.push(`  Action: ${d.metricsHref}`);
      }
    }
    lines.push("");
  }

  return {
    generatedAt,
    periodLabel,
    lines,
    plainText: lines.join("\n"),
  };
}

export function brsrPackToCsv(pack: BrsrPack): string {
  return ["line", ...pack.lines.map((l) => `"${l.replace(/"/g, '""')}"`)].join("\n");
}
