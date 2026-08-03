/**
 * Build a plain-text / structured SECR draft disclosure summary — pure, zero I/O.
 * Placeholders only; no LLM.
 */

import { SECR_SECTIONS } from "./catalog";
import type { SecrCoverageResult, SecrDraftSummary, SecrGapKind } from "./types";

function gapKindLabel(kind: SecrGapKind | null): string {
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

/**
 * Deterministic draft pack for directors' report preparation / export.
 */
export function buildSecrDraftSummary(input: {
  coverage: SecrCoverageResult;
  periodLabel?: string | null;
  generatedAt?: string;
}): SecrDraftSummary {
  const { coverage } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const periodLabel = input.periodLabel?.trim() || coverage.periodId;

  const lines: string[] = [
    "ClearESG — UK SECR draft disclosure pack",
    `Period: ${periodLabel}`,
    `Generated: ${generatedAt}`,
    "",
    `Core required coverage: ${coverage.core.pctCovered}% (${coverage.core.covered}/${coverage.core.total} covered, ${coverage.core.partial} partial, ${coverage.core.gap} gap)`,
    `Supporting coverage: ${coverage.supporting.pctCovered}% (${coverage.supporting.covered}/${coverage.supporting.total} covered)`,
    "",
    "This draft is a data-readiness checklist. It is not a Companies Act filing and not an assurance opinion.",
    "",
  ];

  for (const section of SECR_SECTIONS) {
    const row = coverage.sections.find((s) => s.section.id === section.id);
    lines.push(`## ${section.title}`);
    lines.push(section.description);
    lines.push("");

    if (!row || row.disclosures.length === 0) {
      lines.push("(No catalogued disclosures in this section.)");
      lines.push("");
      continue;
    }

    for (const d of row.disclosures) {
      const level = d.level === "core" ? "Core" : "Supporting";
      const status = d.state.toUpperCase();
      const gap = d.state === "covered" ? "" : ` — ${gapKindLabel(d.gapKind)}`;
      lines.push(`[${status}] ${d.code} (${level}) ${d.label}${gap}`);
      if (d.note) {
        lines.push(`  Note: ${d.note}`);
      }
      if (d.presentMetricKeys.length > 0) {
        lines.push(`  Present: ${d.presentMetricKeys.join(", ")}`);
      }
      if (d.missingMetricKeys.length > 0) {
        lines.push(`  Missing: ${d.missingMetricKeys.join(", ")}`);
      }
      if (d.state !== "covered" && d.gapKind !== "unmapped") {
        lines.push(`  Fill in Metrics: ${d.metricsHref}`);
      }
      if (d.sectionId === "methodology" || d.sectionId === "directors_report") {
        lines.push(
          "  Narrative placeholder: [Draft statement for directors' report — replace before filing]",
        );
      }
    }
    lines.push("");
  }

  if (coverage.gaps.length > 0) {
    lines.push("## Open gaps and partials");
    for (const g of coverage.gaps) {
      lines.push(`- ${g.code}: ${g.label} (${gapKindLabel(g.gapKind)})`);
    }
    lines.push("");
  }

  lines.push("## End of draft");

  return {
    title: "UK SECR draft disclosure pack",
    periodId: coverage.periodId,
    generatedAt,
    corePctCovered: coverage.core.pctCovered,
    supportingPctCovered: coverage.supporting.pctCovered,
    lines,
  };
}

export function secrDraftToPlainText(draft: SecrDraftSummary): string {
  return draft.lines.join("\n");
}
