import type { MatrixPoint } from "@/lib/materiality";
import { ESRS_TOPICS } from "@/lib/materiality/topics";

import { topicLabel } from "./pdfFormat";
import type { ReportDataGap } from "./dataGaps";

export type EsrsTopicDisclosure = {
  code: string;
  label: string;
  pillar: "E" | "S" | "G";
  material: boolean;
  status: "disclosed" | "material_gap" | "not_material" | "incomplete";
  narrative: string;
};

export type EsrsDisclosures = {
  governance: string;
  materiality: string;
  sustainabilityStrategy: string;
  topics: EsrsTopicDisclosure[];
};

export function buildEsrsDisclosures(input: {
  organisationName: string;
  scores: { overall: number; e: number; s: number; g: number };
  emissions: { scope1: number; scope2: number; scope3: number; total: number };
  materialityNarrative: string | null;
  materialityPoints: MatrixPoint[];
  dataGaps: ReportDataGap[];
  band: string;
}): EsrsDisclosures {
  const materialCodes = new Set(
    input.materialityPoints.filter((p) => p.material).map((p) => p.esrsTopic),
  );
  const pointByCode = new Map(input.materialityPoints.map((p) => [p.esrsTopic, p]));

  const topics: EsrsTopicDisclosure[] = ESRS_TOPICS.map((topic) => {
    const point = pointByCode.get(topic.id);
    const material = point?.material === true || materialCodes.has(topic.id);
    const relatedGaps = input.dataGaps.filter(
      (g) =>
        (topic.id === "E1" &&
          (g.scope === "scope1" || g.scope === "scope2" || g.scope === "scope3")) ||
        (topic.pillar === "G" && g.scope === "governance") ||
        (g.scope === "materiality" && material),
    );

    let status: EsrsTopicDisclosure["status"] = "not_material";
    if (material && relatedGaps.some((g) => g.severity === "high")) {
      status = "material_gap";
    } else if (material && relatedGaps.length > 0) {
      status = "incomplete";
    } else if (material) {
      status = "disclosed";
    } else if (point) {
      status = "not_material";
    }

    let narrative: string;
    if (topic.id === "E1") {
      narrative = `${input.organisationName} reports Scope 1 ${formatNum(input.emissions.scope1)} tCO2e, Scope 2 ${formatNum(input.emissions.scope2)} tCO2e, and Scope 3 ${formatNum(input.emissions.scope3)} tCO2e (total ${formatNum(input.emissions.total)} tCO2e) for this period.`;
    } else if (material && point) {
      narrative = `${topicLabel(topic.id)} is material (impact ${point.impactScore}, financial ${point.financialScore}). ${topic.description}`;
    } else if (point) {
      narrative = `${topicLabel(topic.id)} scored below the materiality threshold (impact ${point.impactScore}, financial ${point.financialScore}).`;
    } else {
      narrative = `${topicLabel(topic.id)} was not scored in the period materiality assessment.`;
    }

    return {
      code: topic.id,
      label: topic.label,
      pillar: topic.pillar,
      material,
      status,
      narrative,
    };
  });

  const materialList = topics.filter((t) => t.material).map((t) => t.code);
  const materiality =
    input.materialityNarrative?.trim() ||
    (materialList.length > 0
      ? `Double materiality identified ${materialList.length} material topic(s): ${materialList.join(", ")}.`
      : "No finalised double materiality assessment is available for this period.");

  const governance = `Governance pillar score ${Math.round(input.scores.g)} of 100 (${bandWord(input.band)} readiness). Business conduct (G1) disclosures rely on management-reported datapoints and board oversight records where provided.`;

  const sustainabilityStrategy = `Environment ${Math.round(input.scores.e)}, Social ${Math.round(input.scores.s)}, Governance ${Math.round(input.scores.g)}. Overall score ${Math.round(input.scores.overall)}. Strategy focus follows material ESRS topics${materialList.length ? ` (${materialList.join(", ")})` : ""}.`;

  return {
    governance,
    materiality,
    sustainabilityStrategy,
    topics,
  };
}

export function buildComplianceDeclaration(input: {
  organisationName: string;
  framework: string;
  preparedByName: string | null;
  preparedAt: string;
  approvedByName: string | null;
  approvedAt: string | null;
  version: number;
  dataGapCount: number;
}): string {
  const preparer = input.preparedByName ?? "management";
  const approval = input.approvedByName
    ? ` Approved by ${input.approvedByName}${input.approvedAt ? ` on ${input.approvedAt.slice(0, 10)}` : ""}.`
    : " Approval signature pending.";
  const gaps =
    input.dataGapCount > 0
      ? ` ${input.dataGapCount} data gap(s) are flagged in this report and must be read with the figures.`
      : " No high-priority data gaps were flagged at generation time.";

  return (
    `This ${input.framework} sustainability statement for ${input.organisationName} ` +
    `(version ${input.version}) was prepared by ${preparer} on ${input.preparedAt.slice(0, 10)}.` +
    approval +
    gaps +
    " ClearESG is not an assurance provider. This document summarises management-reported data and calculated estimates; it is not an audit opinion."
  );
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

function bandWord(band: string): string {
  if (band === "strong") return "strong";
  if (band === "moderate") return "moderate";
  if (band === "early") return "early-stage";
  return band;
}
