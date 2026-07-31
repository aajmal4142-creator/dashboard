import type { Payload } from "payload";

import { ESRS_TOPICS, isMaterial, type MatrixPoint } from "@/lib/materiality";
import { buildIssbSnapshot, type IssbDisclosureSnapshot } from "@/lib/issb";
import type { ReportSnapshot } from "@/lib/reports/types";
import {
  buildTcfdSnapshot,
  parseEmissions,
  resolveScenarioSummaries,
  type TcfdDisclosureSnapshot,
} from "@/lib/tcfd";

import {
  assembleMultiFrameworkReport,
  filterIssbMetricsWithoutEmissionsDup,
  isCsrdSourceComplete,
  isGriSourceComplete,
  isIssbSourceComplete,
  isTcfdSourceComplete,
} from "./assemble";
import type {
  FrameworkCompletenessInput,
  GriMaterialTopic,
  IssbMetricItem,
  MultiFrameworkReport,
  MultiFrameworkTarget,
  SharedEmissionsBlock,
  TcfdRiskItem,
  TcfdScenarioItem,
} from "./types";

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function topicLabel(code: string): string {
  return ESRS_TOPICS.find((t) => t.id === code)?.label ?? code;
}

function emissionsFromReportSnapshot(
  snap: ReportSnapshot | null,
): SharedEmissionsBlock | null {
  if (!snap?.emissions) return null;
  return {
    scope1: Number(snap.emissions.scope1 ?? 0),
    scope2: Number(snap.emissions.scope2 ?? 0),
    scope3: Number(snap.emissions.scope3 ?? 0),
    total: Number(snap.emissions.total ?? 0),
    dataQualityPct: Number(snap.emissions.dataQualityPct ?? 0),
    emissionsStandard: snap.emissionsStandard,
    periodLabel: snap.periodLabel,
  };
}

function emissionsFromTcfdLike(raw: unknown): SharedEmissionsBlock | null {
  const parsed = parseEmissions(raw);
  if (!parsed || parsed.quality === "missing") return null;
  return {
    scope1: parsed.scope1,
    scope2: parsed.scope2,
    scope3: parsed.scope3,
    total: parsed.total,
    dataQualityPct: parsed.dataQualityPct,
    emissionsStandard: parsed.emissionsStandard,
    periodLabel: parsed.periodLabel,
  };
}

const CSRD_FRAMEWORKS = ["CSRD_SET1", "CSRD_SIMPLIFIED"] as const;

/**
 * Resolve `[period]` path param: four-digit year or reporting-period id.
 */
export async function resolveMultiFrameworkPeriod(
  payload: Payload,
  organisationId: string,
  periodParam: string,
): Promise<{
  periodId: string;
  periodLabel: string;
  reportingYear: number;
} | null> {
  const trimmed = periodParam.trim();
  const asYear = Number(trimmed);

  if (/^\d{4}$/.test(trimmed) && Number.isInteger(asYear)) {
    const periods = await payload.find({
      collection: "reporting-periods",
      where: {
        and: [
          { organisation: { equals: organisationId } },
          {
            or: [
              { label: { contains: String(asYear) } },
              { endDate: { greater_than_equal: `${asYear}-01-01` } },
            ],
          },
        ],
      },
      limit: 20,
      sort: "-endDate",
      overrideAccess: true,
    });

    const match =
      periods.docs.find((p) => {
        const endYear = new Date(String(p.endDate)).getFullYear();
        return endYear === asYear || String(p.label).includes(String(asYear));
      }) ?? periods.docs[0];

    if (!match) return null;
    return {
      periodId: String(match.id),
      periodLabel: String(match.label),
      reportingYear: asYear,
    };
  }

  try {
    const period = await payload.findByID({
      collection: "reporting-periods",
      id: trimmed,
      depth: 0,
      overrideAccess: true,
    });
    if (relationId(period.organisation) !== organisationId) return null;
    const reportingYear =
      new Date(String(period.endDate)).getFullYear() || new Date().getFullYear();
    return {
      periodId: String(period.id),
      periodLabel: String(period.label),
      reportingYear,
    };
  } catch {
    return null;
  }
}

export async function buildMultiFrameworkReport(
  payload: Payload,
  opts: {
    organisationId: string;
    organisationName: string;
    periodId: string;
    periodLabel: string;
    reportingYear: number;
  },
): Promise<MultiFrameworkReport> {
  const year = opts.reportingYear;

  // —— CSRD (published report) ——
  const csrdReports = await payload.find({
    collection: "reports",
    where: {
      and: [
        { organisation: { equals: opts.organisationId } },
        { period: { equals: opts.periodId } },
        { status: { equals: "published" } },
        { framework: { in: [...CSRD_FRAMEWORKS] } },
      ],
    },
    limit: 1,
    sort: "-version",
    overrideAccess: true,
  });
  const csrdDoc = csrdReports.docs[0] ?? null;
  const csrdSnap = (csrdDoc?.snapshot as ReportSnapshot | null) ?? null;
  const csrdComplete = isCsrdSourceComplete({
    status: csrdDoc?.status,
    hasSnapshot: Boolean(csrdSnap?.emissions),
  });

  let csrdTargets: MultiFrameworkTarget[] = [];
  if (csrdComplete) {
    const targets = await payload.find({
      collection: "compliance-targets",
      where: {
        and: [
          { organisation: { equals: opts.organisationId } },
          { framework: { equals: "csrd" } },
        ],
      },
      limit: 50,
      overrideAccess: true,
    });
    csrdTargets = targets.docs.map((t) => ({
      metricKey: String(t.metricKey),
      metricLabel: t.metricLabel ? String(t.metricLabel) : null,
      targetValue: Number(t.targetValue),
      baselineYear: Number(t.baselineYear),
      targetYear: Number(t.targetYear),
      status: String(t.status),
    }));
  }

  // —— TCFD (final) ——
  const tcfdDocs = await payload.find({
    collection: "tcfd-disclosures",
    where: {
      and: [
        { organisation: { equals: opts.organisationId } },
        { reportingYear: { equals: year } },
        { status: { equals: "final" } },
      ],
    },
    limit: 1,
    sort: "-updatedAt",
    overrideAccess: true,
  });
  const tcfdDoc = tcfdDocs.docs[0] ?? null;
  const tcfdComplete = isTcfdSourceComplete({ status: tcfdDoc?.status });

  const tcfdRiskItems: TcfdRiskItem[] = [];
  let tcfdScenarios: TcfdScenarioItem[] = [];
  let tcfdEmissions: SharedEmissionsBlock | null = null;
  if (tcfdDoc && tcfdComplete) {
    let snapshot = tcfdDoc.snapshot as TcfdDisclosureSnapshot | null;
    if (!snapshot) {
      const scenarios = await resolveScenarioSummaries(payload, tcfdDoc.scenarioLinks);
      snapshot = buildTcfdSnapshot({
        organisationName: opts.organisationName,
        reportingYear: year,
        status: "final",
        answers: tcfdDoc.answers,
        emissionsSnapshot: tcfdDoc.emissionsSnapshot,
        scenarios: scenarios.slice(0, 5),
      });
    }
    tcfdEmissions = emissionsFromTcfdLike(
      snapshot.emissions ?? tcfdDoc.emissionsSnapshot,
    );
    tcfdScenarios = snapshot.scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      baselineYear: s.baselineYear,
      targetYear: s.targetYear,
      reductionPercent: s.reductionPercent,
      category: s.category,
    }));
    for (const pillar of snapshot.pillars) {
      if (pillar.pillar !== "strategy" && pillar.pillar !== "risk_management") {
        continue;
      }
      for (const q of pillar.questions) {
        if (!q.answer || q.answer.startsWith("— Not disclosed")) continue;
        tcfdRiskItems.push({
          id: q.id,
          pillar: pillar.pillar,
          label: q.label,
          answer: q.answer,
        });
      }
    }
  }

  // —— ISSB (final) ——
  const issbDocs = await payload.find({
    collection: "issb-disclosures",
    where: {
      and: [
        { organisation: { equals: opts.organisationId } },
        { reportingYear: { equals: year } },
        { status: { equals: "final" } },
      ],
    },
    limit: 1,
    sort: "-updatedAt",
    overrideAccess: true,
  });
  const issbDoc = issbDocs.docs[0] ?? null;
  const issbComplete = isIssbSourceComplete({ status: issbDoc?.status });

  let issbMetrics: IssbMetricItem[] = [];
  let issbEmissions: SharedEmissionsBlock | null = null;
  if (issbDoc && issbComplete) {
    let snapshot = issbDoc.snapshot as IssbDisclosureSnapshot | null;
    if (!snapshot) {
      const matNote =
        issbDoc.materialitySummary &&
        typeof issbDoc.materialitySummary === "object" &&
        issbDoc.materialitySummary !== null &&
        "narrative" in issbDoc.materialitySummary
          ? String(
              (issbDoc.materialitySummary as { narrative?: string | null }).narrative ??
                "",
            ) || null
          : null;
      snapshot = buildIssbSnapshot({
        organisationName: opts.organisationName,
        reportingYear: year,
        status: "final",
        s1Answers: issbDoc.s1Answers,
        s2Answers: issbDoc.s2Answers,
        emissionsSnapshot: issbDoc.emissionsSnapshot,
        linkedTcfdId: relationId(issbDoc.linkedTcfd),
        materialityNote: matNote,
      });
    }
    issbEmissions = emissionsFromTcfdLike(
      snapshot.emissions ?? issbDoc.emissionsSnapshot,
    );
    const rawMetrics: IssbMetricItem[] = [
      ...snapshot.s1.map((q) => ({
        id: q.id,
        standard: "S1" as const,
        label: q.label,
        answer: q.answer,
      })),
      ...snapshot.s2.map((q) => ({
        id: q.id,
        standard: "S2" as const,
        label: q.label,
        answer: q.answer,
      })),
    ].filter((q) => q.answer && !q.answer.startsWith("— Not disclosed"));
    issbMetrics = filterIssbMetricsWithoutEmissionsDup(rawMetrics);
  }

  // —— GRI (material topics from final materiality, or published GRI report) ——
  const griReports = await payload.find({
    collection: "reports",
    where: {
      and: [
        { organisation: { equals: opts.organisationId } },
        { period: { equals: opts.periodId } },
        { status: { equals: "published" } },
        { framework: { equals: "GRI" } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  const publishedGri = griReports.docs.length > 0;

  const materiality = await payload.find({
    collection: "materiality-assessments",
    where: {
      and: [
        { organisation: { equals: opts.organisationId } },
        { period: { equals: opts.periodId } },
      ],
    },
    limit: 1,
    sort: "-updatedAt",
    overrideAccess: true,
  });
  const matDoc = materiality.docs[0] ?? null;
  const matrixPoints: MatrixPoint[] = Array.isArray(
    (matDoc?.matrixSnapshot as { points?: MatrixPoint[] } | null)?.points,
  )
    ? ((matDoc?.matrixSnapshot as { points: MatrixPoint[] }).points ?? [])
    : [];

  const fromTopics: MatrixPoint[] =
    matrixPoints.length > 0
      ? matrixPoints
      : Array.isArray(matDoc?.topics)
        ? matDoc.topics.map((t) => ({
            esrsTopic: String(t.esrsTopic),
            impactScore: Number(t.impactScore ?? 0),
            financialScore: Number(t.financialScore ?? 0),
            material: isMaterial(
              Number(t.impactScore ?? 0),
              Number(t.financialScore ?? 0),
            ),
          }))
        : [];

  const snapPoints = csrdSnap?.materiality?.points ?? [];
  const pointSource = fromTopics.length > 0 ? fromTopics : snapPoints;

  const materialTopics: GriMaterialTopic[] = pointSource
    .filter((p) => p.material)
    .map((p) => ({
      esrsTopic: p.esrsTopic,
      label: topicLabel(p.esrsTopic),
      impactScore: p.impactScore,
      financialScore: p.financialScore,
    }));

  const griNarrative =
    (matDoc?.narrative ? String(matDoc.narrative) : null) ??
    csrdSnap?.materiality?.narrative ??
    null;

  const griComplete = isGriSourceComplete({
    materialityStatus: matDoc?.status ? String(matDoc.status) : null,
    materialTopicCount: materialTopics.length,
    publishedGriReport: publishedGri,
  });

  let griTopicsFinal = materialTopics;
  if (griComplete && griTopicsFinal.length === 0 && snapPoints.length > 0) {
    griTopicsFinal = snapPoints
      .filter((p) => p.material)
      .map((p) => ({
        esrsTopic: p.esrsTopic,
        label: topicLabel(p.esrsTopic),
        impactScore: p.impactScore,
        financialScore: p.financialScore,
      }));
  }

  const completeness: FrameworkCompletenessInput[] = [
    {
      framework: "csrd",
      complete: csrdComplete,
      skipReason: csrdComplete ? undefined : "No published CSRD report for this period.",
    },
    {
      framework: "tcfd",
      complete: tcfdComplete,
      skipReason: tcfdComplete ? undefined : "No final TCFD disclosure for this year.",
    },
    {
      framework: "issb",
      complete: issbComplete,
      skipReason: issbComplete ? undefined : "No final ISSB disclosure for this year.",
    },
    {
      framework: "gri",
      complete: griComplete,
      skipReason: griComplete
        ? undefined
        : "No final materiality topics (or published GRI report) for this period.",
    },
  ];

  const csrdEmissions = emissionsFromReportSnapshot(csrdSnap);

  return assembleMultiFrameworkReport({
    organisationId: opts.organisationId,
    organisationName: opts.organisationName,
    periodId: opts.periodId,
    periodLabel: opts.periodLabel,
    reportingYear: year,
    completeness,
    emissionsByFramework: {
      csrd: csrdEmissions,
      tcfd: tcfdEmissions,
      issb: issbEmissions,
    },
    csrd: csrdComplete
      ? {
          reportId: csrdDoc ? String(csrdDoc.id) : null,
          reportFramework: csrdDoc ? String(csrdDoc.framework) : null,
          targets: csrdTargets,
          scores: csrdSnap?.scores
            ? {
                overall: csrdSnap.scores.overall,
                e: csrdSnap.scores.e,
                s: csrdSnap.scores.s,
                g: csrdSnap.scores.g,
              }
            : null,
        }
      : undefined,
    tcfd: tcfdComplete
      ? {
          disclosureId: tcfdDoc ? String(tcfdDoc.id) : null,
          riskItems: tcfdRiskItems,
          scenarios: tcfdScenarios,
        }
      : undefined,
    issb: issbComplete
      ? {
          disclosureId: issbDoc ? String(issbDoc.id) : null,
          metrics: issbMetrics,
        }
      : undefined,
    gri: griComplete
      ? {
          narrative: griNarrative,
          materialTopics: griTopicsFinal,
        }
      : undefined,
  });
}
