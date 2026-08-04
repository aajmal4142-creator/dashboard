/**
 * SFDR PAI pack export — pure, zero I/O. Mirror of SECR draft pack.
 */

import { SFDR_SECTIONS } from "./catalog";
import type { SfdrCoverageResult, SfdrGapKind } from "./types";

function gapKindLabel(kind: SfdrGapKind | null): string {
  switch (kind) {
    case "missing_data":
      return "missing metric";
    case "missing_evidence":
      return "missing evidence";
    case "missing_org_field":
      return "missing organisation field";
    case "unmapped":
      return "not tracked in ClearESG";
    case "weak_quality":
      return "estimated / weak quality";
    default:
      return "open";
  }
}

export type SfdrPaiPack = {
  generatedAt: string;
  periodLabel: string;
  lines: string[];
  plainText: string;
};

export function buildSfdrPaiPack(input: {
  coverage: SfdrCoverageResult;
  periodLabel?: string | null;
  generatedAt?: string;
}): SfdrPaiPack {
  const { coverage } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const periodLabel = input.periodLabel?.trim() || coverage.periodId;

  const lines: string[] = [
    "ClearESG — SFDR Principal Adverse Impact (PAI) readiness pack",
    `Period: ${periodLabel}`,
    `Generated: ${generatedAt}`,
    "",
    `Table 1 coverage: ${coverage.summary.pctCovered}% (${coverage.summary.covered}/${coverage.summary.total} covered, ${coverage.summary.partial} partial, ${coverage.summary.gap} gap)`,
    "",
    "This pack is a data-readiness checklist for PAI indicators. It is not an SFDR Article 8/9 filing and not an assurance opinion.",
    "",
  ];

  for (const section of SFDR_SECTIONS) {
    const row = coverage.sections.find((s) => s.sectionId === section.id);
    lines.push(`## ${section.title}`);
    if (section.description) lines.push(section.description);
    lines.push("");

    const indicators = row?.indicators ?? [];
    if (indicators.length === 0) {
      lines.push("(No catalogued indicators in this section.)");
      lines.push("");
      continue;
    }

    for (const d of indicators) {
      const status = d.state.toUpperCase();
      const gap = d.state === "covered" ? "" : ` — ${gapKindLabel(d.gapKind)}`;
      lines.push(`[${status}] ${d.code} ${d.label}${gap}`);
      if (d.note) lines.push(`  Note: ${d.note}`);
      if (d.presentMetricKeys?.length) {
        lines.push(`  Present: ${d.presentMetricKeys.join(", ")}`);
      }
      if (d.missingMetricKeys?.length) {
        lines.push(`  Missing: ${d.missingMetricKeys.join(", ")}`);
      }
      if (d.state !== "covered" && d.gapKind !== "unmapped") {
        lines.push(`  Action: ${d.actionHref}`);
      }
    }
    lines.push("");
  }

  const plainText = lines.join("\n");
  return { generatedAt, periodLabel, lines, plainText };
}

export function sfdrPaiPackToCsv(pack: SfdrPaiPack): string {
  const rows = [["section", "key", "value"]];
  rows.push(["meta", "period", pack.periodLabel]);
  rows.push(["meta", "generatedAt", pack.generatedAt]);
  for (const line of pack.lines) {
    if (line.startsWith("## ")) {
      rows.push(["section", "title", line.slice(3)]);
    } else if (line.startsWith("[")) {
      rows.push(["indicator", "status_line", line]);
    } else if (line.startsWith("  ")) {
      rows.push(["detail", "note", line.trim()]);
    }
  }
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function sfdrPaiPackToPlainText(pack: SfdrPaiPack): string {
  return pack.plainText;
}
