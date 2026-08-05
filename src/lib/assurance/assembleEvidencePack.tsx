import { renderToBuffer } from "@react-pdf/renderer";
import type { Payload, Where } from "payload";

import { readChainState } from "@/lib/approvals";
import type { AssuranceLevel } from "@/lib/assurance/types";
import { isAssuranceLevel } from "@/lib/assurance/pathways";
import type { ReportSnapshot } from "@/lib/reports";
import { REPORT_DISCLAIMER } from "@/lib/reports/types";

import { EvidencePackPdfDocument } from "./EvidencePackPdfDocument";
import {
  buildEvidencePackManifest,
  evidencePackBasename,
  evidencePackToCsv,
  pathwayChecklistToCsv,
  type EvidencePackManifest,
} from "./evidencePack";
import { loadAssurancePayload } from "./loadAssurance";
import { buildOpinionLetterDraft } from "./opinionLetter";
import { buildStoreZip } from "./zipStore";

export type EvidencePackFormat = "pdf" | "csv" | "zip";

export type AssembleEvidencePackResult = {
  manifest: EvidencePackManifest;
  basename: string;
  buffer: Uint8Array;
  contentType: string;
  filename: string;
};

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

/**
 * Load published report + lineage, build evidence-pack bytes (PDF / CSV / ZIP).
 */
export async function assembleEvidencePack(opts: {
  payload: Payload;
  organisationId: string;
  periodId?: string | null;
  reportId?: string | null;
  format: EvidencePackFormat;
  assuranceLevel?: AssuranceLevel | null;
}): Promise<
  | { ok: true; result: AssembleEvidencePackResult }
  | { ok: false; status: number; error: string }
> {
  let report: {
    id: string;
    version: number;
    status?: string | null;
    snapshot?: unknown;
    organisation: string | { id: string };
    period: string | { id: string };
    framework?: string | null;
    lockedAt?: string | null;
    approvedAt?: string | null;
    publishedAt?: string | null;
    approvalStep?: unknown;
    approvalChainStatus?: unknown;
    approvalState?: unknown;
    approvedBy?: unknown;
  } | null = null;

  if (opts.reportId) {
    try {
      report = await opts.payload.findByID({
        collection: "reports",
        id: opts.reportId,
        depth: 0,
        overrideAccess: true,
      });
    } catch {
      return { ok: false, status: 404, error: "Report not found" };
    }
    const orgId = relationId(report.organisation);
    if (orgId !== opts.organisationId) {
      return { ok: false, status: 404, error: "Report not found" };
    }
  } else {
    const whereAnd: Where[] = [
      { organisation: { equals: opts.organisationId } },
      { status: { equals: "published" } },
    ];
    if (opts.periodId) {
      whereAnd.push({ period: { equals: opts.periodId } });
    }
    const found = await opts.payload.find({
      collection: "reports",
      where: { and: whereAnd },
      sort: "-version",
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    report = found.docs[0] ?? null;
  }

  if (!report) {
    return {
      ok: false,
      status: 404,
      error:
        "No published report for this organisation and period. Publish from Reports first.",
    };
  }

  const periodId = relationId(report.period);
  if (!periodId) {
    return { ok: false, status: 409, error: "Report has no reporting period" };
  }
  if (opts.periodId && opts.periodId !== periodId) {
    return {
      ok: false,
      status: 409,
      error: "Report period does not match the requested period",
    };
  }

  const assurance = await loadAssurancePayload(opts.payload, report);
  if (!assurance) {
    return {
      ok: false,
      status: 409,
      error: "Published report has no snapshot. Re-publish from Reports.",
    };
  }

  const snapshot = assurance.snapshot as ReportSnapshot;
  const chain = readChainState({
    status: report.status,
    lockedAt: report.lockedAt,
    approvalStep: report.approvalStep,
    approvalChainStatus: report.approvalChainStatus,
    approvalState: report.approvalState,
    approvedBy: report.approvedBy,
  });

  const dps = await opts.payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: opts.organisationId } },
        { period: { equals: periodId } },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });

  let datapointsLocked = 0;
  let datapointsInProgress = 0;
  let datapointsRejected = 0;
  for (const dp of dps.docs) {
    const st = readChainState(dp);
    if (st.status === "locked") datapointsLocked += 1;
    else if (st.status === "rejected") datapointsRejected += 1;
    else datapointsInProgress += 1;
  }

  let assuranceLevel = opts.assuranceLevel ?? null;
  let pathwayCompletedIds: string[] = [];
  let engagementForOpinion: {
    materialityThresholdTco2e?: unknown;
    samplingMethod?: unknown;
    samplingPopulationSize?: unknown;
    samplingSampleSize?: unknown;
    samplingNotes?: unknown;
    notes?: unknown;
    dataGaps?: unknown;
  } | null = null;
  {
    const engagements = await opts.payload.find({
      collection: "assurance-engagements",
      where: {
        and: [
          { organisation: { equals: opts.organisationId } },
          { reportingPeriod: { equals: periodId } },
        ],
      },
      sort: "-updatedAt",
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const eng = engagements.docs[0] as
      | {
          assuranceLevel?: unknown;
          pathwayLevel?: unknown;
          pathwayCheckpoints?: Array<{ checkpointId?: string }>;
          materialityThresholdTco2e?: unknown;
          samplingMethod?: unknown;
          samplingPopulationSize?: unknown;
          samplingSampleSize?: unknown;
          samplingNotes?: unknown;
          notes?: unknown;
          dataGaps?: unknown;
        }
      | undefined;
    if (!assuranceLevel) {
      const fromEng = eng?.assuranceLevel ?? eng?.pathwayLevel;
      if (isAssuranceLevel(fromEng)) assuranceLevel = fromEng;
    }
    if (Array.isArray(eng?.pathwayCheckpoints)) {
      pathwayCompletedIds = eng.pathwayCheckpoints
        .map((c) => (typeof c.checkpointId === "string" ? c.checkpointId : ""))
        .filter((id) => id.length > 0);
    }
    engagementForOpinion = eng ?? null;
  }

  const manifest = buildEvidencePackManifest({
    organisationId: opts.organisationId,
    organisationName: snapshot.organisationName,
    periodId,
    periodLabel: snapshot.periodLabel,
    framework: snapshot.framework,
    versionLabel: assurance.versionLabel,
    generatedAt: new Date().toISOString(),
    disclaimer: snapshot.disclaimer || REPORT_DISCLAIMER,
    assuranceLevel,
    emissions: snapshot.emissions,
    factors: snapshot.factorsUsed,
    dataGaps: snapshot.dataGaps ?? [],
    evidenceIndex: snapshot.evidenceIndex,
    figures: assurance.figures.map((f) => ({
      datapointId: f.datapointId,
      metricKey: f.metricKey,
      value: f.value,
      quality: f.quality,
      evidenceLink: f.lineage.evidenceLink,
      factorId: f.lineage.factor?.factorId ?? null,
      evidence: f.lineage.evidence,
    })),
    lockSummary: {
      reportId: report.id,
      reportStatus: report.status ?? null,
      reportVersion: report.version,
      approvalStep: chain.step,
      approvalChainStatus: chain.status,
      lockedAt: report.lockedAt ? String(report.lockedAt) : null,
      approvedAt: report.approvedAt ? String(report.approvedAt) : null,
      publishedAt: report.publishedAt ? String(report.publishedAt) : null,
      datapointsTotal: dps.docs.length,
      datapointsLocked,
      datapointsInProgress,
      datapointsRejected,
    },
  });

  const basename = evidencePackBasename(manifest);
  const csvText = evidencePackToCsv(manifest);
  const csvBytes = new TextEncoder().encode(csvText);

  if (opts.format === "csv") {
    return {
      ok: true,
      result: {
        manifest,
        basename,
        buffer: csvBytes,
        contentType: "text/csv; charset=utf-8",
        filename: `${basename}.csv`,
      },
    };
  }

  const pdfBuffer = await renderToBuffer(<EvidencePackPdfDocument manifest={manifest} />);
  const pdfBytes = new Uint8Array(pdfBuffer);

  if (opts.format === "pdf") {
    return {
      ok: true,
      result: {
        manifest,
        basename,
        buffer: pdfBytes,
        contentType: "application/pdf",
        filename: `${basename}.pdf`,
      },
    };
  }

  const pathwayCsv = pathwayChecklistToCsv({
    assuranceLevel,
    completedIds: pathwayCompletedIds,
  });
  const pathwayBytes = new TextEncoder().encode(pathwayCsv);

  const zipEntries = [
    { name: `${basename}.pdf`, data: pdfBytes },
    { name: `${basename}.csv`, data: csvBytes },
    {
      name: `${basename}.pathway-checklist.csv`,
      data: pathwayBytes,
    },
    {
      name: `${basename}.manifest.json`,
      data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    },
  ];

  if (assuranceLevel && engagementForOpinion) {
    const eng = engagementForOpinion;
    const dataGaps = Array.isArray(eng.dataGaps)
      ? (eng.dataGaps as Array<{
          metric?: string | null;
          severity?: string | null;
          description?: string | null;
        }>)
      : [];
    const gapLines = dataGaps.map(
      (g) =>
        `- [${g.severity ?? "unknown"}] ${g.metric ?? "unlabelled"}: ${g.description ?? ""}`,
    );
    const findingsSummary =
      [
        typeof eng.notes === "string" ? eng.notes.trim() || null : null,
        gapLines.length > 0 ? `Data gaps identified:\n${gapLines.join("\n")}` : null,
      ]
        .filter(Boolean)
        .join("\n\n") || null;

    const opinionDraft = buildOpinionLetterDraft({
      level: assuranceLevel,
      organisationName: manifest.organisationName,
      periodLabel: manifest.periodLabel,
      materialityThresholdTco2e:
        typeof eng.materialityThresholdTco2e === "number"
          ? eng.materialityThresholdTco2e
          : null,
      samplingPlan: {
        method: typeof eng.samplingMethod === "string" ? eng.samplingMethod : null,
        populationSize:
          typeof eng.samplingPopulationSize === "number"
            ? eng.samplingPopulationSize
            : null,
        sampleSize:
          typeof eng.samplingSampleSize === "number" ? eng.samplingSampleSize : null,
        notes: typeof eng.samplingNotes === "string" ? eng.samplingNotes : null,
      },
      findingsSummary,
    });
    zipEntries.push({
      name: `${basename}.opinion-draft.txt`,
      data: new TextEncoder().encode(opinionDraft),
    });
  }

  const zip = buildStoreZip(zipEntries);

  return {
    ok: true,
    result: {
      manifest,
      basename,
      buffer: zip,
      contentType: "application/zip",
      filename: `${basename}.zip`,
    },
  };
}
