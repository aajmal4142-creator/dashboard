import type { CalcResult } from "@/lib/calc";
import type { MatrixPoint } from "@/lib/materiality";

export type ReportDataGap = {
  code: string;
  label: string;
  severity: "high" | "medium" | "low";
  message: string;
  scope?: "scope1" | "scope2" | "scope3" | "governance" | "materiality" | "evidence";
};

/**
 * Flag audit-visible data gaps from calc quality, materiality, and evidence.
 * Pure — no I/O.
 */
export function detectReportDataGaps(input: {
  calc: CalcResult;
  materialityPoints: MatrixPoint[];
  materialityNarrative: string | null;
  evidenceCount: number;
  framework: string;
}): ReportDataGap[] {
  const gaps: ReportDataGap[] = [];
  const isCsrd =
    input.framework === "CSRD_SET1" ||
    input.framework === "CSRD_SIMPLIFIED" ||
    input.framework.toLowerCase().includes("csrd");

  const scopes = [
    { key: "scope1" as const, label: "Scope 1 — direct emissions" },
    { key: "scope2" as const, label: "Scope 2 — purchased energy" },
    { key: "scope3" as const, label: "Scope 3 — value chain" },
  ];

  for (const s of scopes) {
    const measured = input.calc.emissions[s.key];
    if (measured.quality === "missing") {
      gaps.push({
        code: `${s.key}_missing`,
        label: s.label,
        severity: "high",
        message: `${s.label} has quality missing. Enter activity data before filing.`,
        scope: s.key,
      });
    } else if (measured.quality === "estimated") {
      gaps.push({
        code: `${s.key}_estimated`,
        label: s.label,
        severity: "medium",
        message: `${s.label} uses estimated factors. Prefer measured activity where possible.`,
        scope: s.key,
      });
    }
  }

  const market = input.calc.emissions.scope2Methods?.marketBased;
  if (
    market &&
    market.quality === "missing" &&
    input.calc.emissions.scope2.quality !== "missing"
  ) {
    gaps.push({
      code: "scope2_market_missing",
      label: "Scope 2 — market-based",
      severity: "medium",
      message:
        "Market-based Scope 2 is incomplete (residual mix or contractual instruments missing). Location-based figure is available.",
      scope: "scope2",
    });
  }

  if (input.calc.dataQualityPct < 50) {
    gaps.push({
      code: "data_quality_low",
      label: "Data quality",
      severity: "high",
      message: `Data quality is ${Math.round(input.calc.dataQualityPct)}%. Raise measured/calculated share before assurance.`,
    });
  } else if (input.calc.dataQualityPct < 75) {
    gaps.push({
      code: "data_quality_moderate",
      label: "Data quality",
      severity: "medium",
      message: `Data quality is ${Math.round(input.calc.dataQualityPct)}%. Improve coverage for audit readiness.`,
    });
  }

  if (input.materialityPoints.length === 0) {
    gaps.push({
      code: "materiality_missing",
      label: "Double materiality",
      severity: isCsrd ? "high" : "medium",
      message: "No finalised materiality assessment for this period.",
      scope: "materiality",
    });
  } else if (!input.materialityNarrative?.trim()) {
    gaps.push({
      code: "materiality_narrative",
      label: "Materiality narrative",
      severity: "medium",
      message: "Materiality matrix exists but narrative is empty.",
      scope: "materiality",
    });
  }

  if (input.evidenceCount === 0) {
    gaps.push({
      code: "evidence_missing",
      label: "Evidence",
      severity: "medium",
      message:
        "No evidence files linked. Attach source documents for audit trail strength.",
      scope: "evidence",
    });
  }

  if (
    input.calc.factorsUsed.length === 0 &&
    input.calc.emissions.total.quality !== "missing"
  ) {
    gaps.push({
      code: "factors_unpinned",
      label: "Emission factors",
      severity: "high",
      message: "No emission factors pinned. Report may not be reproducible.",
    });
  }

  return gaps;
}
