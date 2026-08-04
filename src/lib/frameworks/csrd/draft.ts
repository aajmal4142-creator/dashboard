/**
 * CSRD / ESRS gap pack export — pure, zero I/O. Mirror of SECR/SFDR packs.
 */

import { CSRD_SECTIONS } from "./catalog";
import type { CsrdCoverageResult, CsrdGapKind } from "./types";

function gapKindLabel(kind: CsrdGapKind | null): string {
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

export type CsrdGapPack = {
  generatedAt: string;
  periodLabel: string;
  lines: string[];
  plainText: string;
};

export function buildCsrdGapPack(input: {
  coverage: CsrdCoverageResult;
  periodLabel?: string | null;
  generatedAt?: string;
}): CsrdGapPack {
  const { coverage } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const periodLabel = input.periodLabel?.trim() || coverage.periodId;

  const lines: string[] = [
    "ClearESG — CSRD / ESRS Set 1 gap analysis pack",
    `Period: ${periodLabel}`,
    `Generated: ${generatedAt}`,
    "",
    `Core: ${coverage.core.pctCovered}% (${coverage.core.covered}/${coverage.core.total} covered, ${coverage.core.partial} partial, ${coverage.core.gap} gap)`,
    `Supporting: ${coverage.supporting.pctCovered}% (${coverage.supporting.covered}/${coverage.supporting.total} covered, ${coverage.supporting.partial} partial, ${coverage.supporting.gap} gap)`,
    "",
    "This pack is a data-readiness checklist. It is not an EFRAG XBRL filing and not an assurance opinion.",
    "",
  ];

  for (const section of CSRD_SECTIONS) {
    const row = coverage.sections.find((s) => s.section.id === section.id);
    lines.push(`## ${section.title}`);
    if (section.description) lines.push(section.description);
    lines.push("");

    const disclosures = row?.disclosures ?? [];
    if (disclosures.length === 0) {
      lines.push("(No catalogued disclosures in this section.)");
      lines.push("");
      continue;
    }

    for (const d of disclosures) {
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
      if (d.state !== "covered") {
        lines.push(`  Action: ${d.metricsHref}`);
      }
    }
    lines.push("");
  }

  const plainText = lines.join("\n");
  return { generatedAt, periodLabel, lines, plainText };
}

export function csrdGapPackToCsv(pack: CsrdGapPack): string {
  const rows = [["section", "key", "value"]];
  rows.push(["meta", "period", pack.periodLabel]);
  rows.push(["meta", "generatedAt", pack.generatedAt]);
  for (const line of pack.lines) {
    if (line.startsWith("## ")) {
      rows.push(["section", "title", line.slice(3)]);
    } else if (line.startsWith("[")) {
      rows.push(["disclosure", "status_line", line]);
    } else if (line.startsWith("  ")) {
      rows.push(["detail", "note", line.trim()]);
    }
  }
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function csrdGapPackToPlainText(pack: CsrdGapPack): string {
  return pack.plainText;
}
