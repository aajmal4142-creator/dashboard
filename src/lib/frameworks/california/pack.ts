/**
 * California SB 253 / SB 261 readiness pack — pure, zero I/O. Mirrors the BRSR pack shape.
 */

import type { CaliforniaCoverageResult, CaliforniaGapKind } from "./types";

function gapKindLabel(kind: CaliforniaGapKind | null): string {
  switch (kind) {
    case "missing_data":
      return "missing metric";
    case "missing_evidence":
      return "missing evidence";
    case "missing_org_field":
      return "missing organisation profile field";
    case "missing_tcfd":
      return "missing TCFD answer";
    case "unmapped":
      return "not tracked in ClearESG";
    case "weak_quality":
      return "estimated / weak quality";
    case "phase_pending":
      return "deferred — later phase-in year";
    default:
      return "open";
  }
}

export type CaliforniaPack = {
  generatedAt: string;
  periodLabel: string;
  lines: string[];
  plainText: string;
};

export function buildCaliforniaPack(input: {
  coverage: CaliforniaCoverageResult;
  periodLabel?: string | null;
  generatedAt?: string;
}): CaliforniaPack {
  const { coverage } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const periodLabel = input.periodLabel?.trim() || coverage.periodId;
  const lawLabel =
    coverage.law === "253" ? "SB 253 (Scope 1/2/3 GHG)" : "SB 261 (climate risk)";

  const lines: string[] = [
    `ClearESG — California ${lawLabel} readiness pack`,
    `Period: ${periodLabel}`,
    `Generated: ${generatedAt}`,
    `Scope 3 required this period: ${coverage.scope3Required ? "yes" : "not yet"}`,
    "",
    `Coverage: ${coverage.summary.pctCovered}% (${coverage.summary.covered}/${coverage.summary.total} covered, ${coverage.summary.partial} partial, ${coverage.summary.gap} gap, ${coverage.summary.deferred} deferred)`,
    "",
    "This pack is a data-readiness checklist for SB 253/261 disclosures.",
    "It is not a CARB filing, not legal advice, and not an assurance opinion.",
    "",
  ];

  for (const section of coverage.sections) {
    lines.push(`## ${section.shortTitle} — ${section.title}`);
    lines.push(
      `${section.pctCovered}% (${section.covered}/${section.total} covered, ${section.partial} partial, ${section.gap} gap, ${section.deferred} deferred)`,
    );
    lines.push("");

    if (section.disclosures.length === 0) {
      lines.push("(No catalogued disclosures.)");
      lines.push("");
      continue;
    }

    for (const d of section.disclosures) {
      const status = d.state.toUpperCase();
      const gap = d.state === "covered" ? "" : ` — ${gapKindLabel(d.gapKind)}`;
      lines.push(`[${status}] ${d.code} (SB ${d.law}) ${d.label}${gap}`);
      if (d.note) lines.push(`  Note: ${d.note}`);
      if (d.presentMetricKeys.length) {
        lines.push(`  Present: ${d.presentMetricKeys.join(", ")}`);
      }
      if (d.missingMetricKeys.length) {
        lines.push(`  Missing metrics: ${d.missingMetricKeys.join(", ")}`);
      }
      if (d.missingOrgFields.length) {
        lines.push(`  Missing profile fields: ${d.missingOrgFields.join(", ")}`);
      }
      if (d.missingTcfdIds.length) {
        lines.push(`  Missing TCFD answers: ${d.missingTcfdIds.join(", ")}`);
      }
      if (
        d.state !== "covered" &&
        d.gapKind !== "unmapped" &&
        d.gapKind !== "phase_pending"
      ) {
        lines.push(`  Action: ${d.actionHref}`);
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

export function californiaPackToCsv(pack: CaliforniaPack): string {
  return ["line", ...pack.lines.map((l) => `"${l.replace(/"/g, '""')}"`)].join("\n");
}
