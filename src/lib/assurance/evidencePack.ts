/**
 * Pure assurance evidence-pack manifest (F17).
 * Distinct from audience report packs (F36). No I/O.
 */

import type { AssuranceLevel } from "./types";
import type { EvidenceLinkState } from "./lineage";
import type { AssuranceEvidenceType } from "./pathways";
import { getPathway } from "./pathways";

export const EVIDENCE_PACK_KIND = "assurance_evidence" as const;

export type EvidencePackEmissions = {
  scope1Tco2e: number;
  scope2LocationTco2e: number;
  scope2MarketTco2e: number | null;
  scope3Tco2e: number;
  totalTco2e: number;
  dataQualityPct: number;
};

export type EvidencePackFactor = {
  factorId: string;
  key: string;
  value: number;
  source: string;
  year: number;
};

export type EvidencePackGap = {
  code: string;
  label: string;
  severity: "high" | "medium" | "low";
  message: string;
  scope?: string;
};

export type EvidencePackEvidenceLink = {
  evidenceId: string;
  filename: string;
  sha256: string;
  datapointId: string | null;
  metricKey: string | null;
  linkState: EvidenceLinkState | "index_only";
  /** App path or id pointer for auditors — not a signed URL. */
  pathHint: string;
};

export type EvidencePackLineagePointer = {
  datapointId: string;
  metricKey: string;
  value: number | null;
  quality: string;
  evidenceLink: EvidenceLinkState;
  factorId: string | null;
  evidenceIds: string[];
};

export type EvidencePackLockSummary = {
  reportId: string | null;
  reportStatus: string | null;
  reportVersion: number | null;
  approvalStep: string | null;
  approvalChainStatus: string | null;
  lockedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  datapointsTotal: number;
  datapointsLocked: number;
  datapointsInProgress: number;
  datapointsRejected: number;
};

export type EvidencePackManifest = {
  kind: typeof EVIDENCE_PACK_KIND;
  generatedAt: string;
  organisationId: string;
  organisationName: string;
  periodId: string;
  periodLabel: string;
  framework: string;
  versionLabel: string;
  /** F18 hook — limited vs reasonable pathway when selected on the engagement. */
  assuranceLevel: AssuranceLevel | null;
  /** F18 hook — required evidence type ids for the selected pathway (empty when no level). */
  pathwayRequiredEvidenceTypes: AssuranceEvidenceType[];
  disclaimer: string;
  emissions: EvidencePackEmissions;
  factors: EvidencePackFactor[];
  missingDataRegister: EvidencePackGap[];
  evidenceLinks: EvidencePackEvidenceLink[];
  lineagePointers: EvidencePackLineagePointer[];
  lockSummary: EvidencePackLockSummary;
};

export type EvidencePackFigureInput = {
  datapointId: string;
  metricKey: string;
  value: number | null;
  quality: string;
  evidenceLink: EvidenceLinkState;
  factorId: string | null;
  evidence: Array<{
    id: string;
    filename: string;
    sha256: string;
    bidirectionallyLinked: boolean;
  }>;
};

export type BuildEvidencePackManifestInput = {
  organisationId: string;
  organisationName: string;
  periodId: string;
  periodLabel: string;
  framework: string;
  versionLabel: string;
  generatedAt: string;
  disclaimer: string;
  /** F18 shared level enum — optional until pathway UI wires it. */
  assuranceLevel?: AssuranceLevel | null;
  emissions: {
    scope1: number;
    scope2: number;
    scope2LocationBased?: number;
    scope2MarketBased?: number | null;
    scope3: number;
    total: number;
    dataQualityPct: number;
  };
  factors: Array<{
    factorId: string;
    key: string;
    value: number;
    source: string;
    year: number;
  }>;
  dataGaps: Array<{
    code: string;
    label: string;
    severity: "high" | "medium" | "low";
    message: string;
    scope?: string;
  }>;
  /** Soft index from snapshot when lineage figures omit an attachment. */
  evidenceIndex: Array<{ filename: string; sha256: string; metricKey?: string }>;
  figures: EvidencePackFigureInput[];
  lockSummary: EvidencePackLockSummary;
};

/** Build a deterministic assurance evidence-pack manifest. Pure. */
export function buildEvidencePackManifest(
  input: BuildEvidencePackManifestInput,
): EvidencePackManifest {
  const lineagePointers: EvidencePackLineagePointer[] = input.figures.map((f) => ({
    datapointId: f.datapointId,
    metricKey: f.metricKey,
    value: f.value,
    quality: f.quality,
    evidenceLink: f.evidenceLink,
    factorId: f.factorId,
    evidenceIds: f.evidence.map((e) => e.id),
  }));

  const evidenceById = new Map<string, EvidencePackEvidenceLink>();
  for (const fig of input.figures) {
    for (const e of fig.evidence) {
      const existing = evidenceById.get(e.id);
      const linkState: EvidenceLinkState = e.bidirectionallyLinked
        ? "verified"
        : "unverified";
      if (!existing) {
        evidenceById.set(e.id, {
          evidenceId: e.id,
          filename: e.filename,
          sha256: e.sha256,
          datapointId: fig.datapointId,
          metricKey: fig.metricKey,
          linkState,
          pathHint: `/api/app/auditor/${fig.datapointId}`,
        });
      } else if (existing.linkState !== "verified" && linkState === "verified") {
        evidenceById.set(e.id, {
          ...existing,
          linkState: "verified",
          datapointId: fig.datapointId,
          metricKey: fig.metricKey,
          pathHint: `/api/app/auditor/${fig.datapointId}`,
        });
      }
    }
  }

  const linkedShas = new Set(
    [...evidenceById.values()].map((e) => e.sha256.toLowerCase()),
  );
  let indexOnly = 0;
  for (const row of input.evidenceIndex) {
    if (linkedShas.has(row.sha256.toLowerCase())) continue;
    const syntheticId = `index:${row.sha256.slice(0, 16)}`;
    if (evidenceById.has(syntheticId)) continue;
    evidenceById.set(syntheticId, {
      evidenceId: syntheticId,
      filename: row.filename,
      sha256: row.sha256,
      datapointId: null,
      metricKey: row.metricKey ?? null,
      linkState: "index_only",
      pathHint: `evidence#sha256=${row.sha256.slice(0, 12)}`,
    });
    indexOnly += 1;
    if (indexOnly > 200) break;
  }

  const evidenceLinks = [...evidenceById.values()].sort((a, b) =>
    a.filename.localeCompare(b.filename),
  );

  const scope2Location = input.emissions.scope2LocationBased ?? input.emissions.scope2;
  const scope2Market =
    input.emissions.scope2MarketBased === undefined
      ? null
      : input.emissions.scope2MarketBased;

  const assuranceLevel = input.assuranceLevel ?? null;
  const pathwayRequiredEvidenceTypes = assuranceLevel
    ? [...getPathway(assuranceLevel).requiredEvidenceTypes]
    : [];

  return {
    kind: EVIDENCE_PACK_KIND,
    generatedAt: input.generatedAt,
    organisationId: input.organisationId,
    organisationName: input.organisationName,
    periodId: input.periodId,
    periodLabel: input.periodLabel,
    framework: input.framework,
    versionLabel: input.versionLabel,
    assuranceLevel,
    pathwayRequiredEvidenceTypes,
    disclaimer: input.disclaimer,
    emissions: {
      scope1Tco2e: input.emissions.scope1,
      scope2LocationTco2e: scope2Location,
      scope2MarketTco2e: scope2Market,
      scope3Tco2e: input.emissions.scope3,
      totalTco2e: input.emissions.total,
      dataQualityPct: input.emissions.dataQualityPct,
    },
    factors: input.factors.map((f) => ({
      factorId: f.factorId,
      key: f.key,
      value: f.value,
      source: f.source,
      year: f.year,
    })),
    missingDataRegister: input.dataGaps.map((g) => ({
      code: g.code,
      label: g.label,
      severity: g.severity,
      message: g.message,
      scope: g.scope,
    })),
    evidenceLinks,
    lineagePointers,
    lockSummary: { ...input.lockSummary },
  };
}

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Flatten manifest to CSV sections for the ZIP companion file. */
export function evidencePackToCsv(manifest: EvidencePackManifest): string {
  const lines: string[] = [
    "section,key,value",
    `meta,kind,${manifest.kind}`,
    `meta,organisation,${csvEscape(manifest.organisationName)}`,
    `meta,organisationId,${csvEscape(manifest.organisationId)}`,
    `meta,period,${csvEscape(manifest.periodLabel)}`,
    `meta,periodId,${csvEscape(manifest.periodId)}`,
    `meta,framework,${csvEscape(manifest.framework)}`,
    `meta,version,${csvEscape(manifest.versionLabel)}`,
    `meta,assuranceLevel,${manifest.assuranceLevel ?? ""}`,
    `meta,pathwayRequiredEvidenceTypes,${csvEscape(manifest.pathwayRequiredEvidenceTypes.join("|"))}`,
    `meta,generatedAt,${csvEscape(manifest.generatedAt)}`,
    `emissions,scope1_tco2e,${manifest.emissions.scope1Tco2e}`,
    `emissions,scope2_location_tco2e,${manifest.emissions.scope2LocationTco2e}`,
    `emissions,scope2_market_tco2e,${manifest.emissions.scope2MarketTco2e ?? ""}`,
    `emissions,scope3_tco2e,${manifest.emissions.scope3Tco2e}`,
    `emissions,total_tco2e,${manifest.emissions.totalTco2e}`,
    `emissions,dataQualityPct,${manifest.emissions.dataQualityPct}`,
    `lock,reportId,${manifest.lockSummary.reportId ?? ""}`,
    `lock,reportStatus,${manifest.lockSummary.reportStatus ?? ""}`,
    `lock,approvalStep,${manifest.lockSummary.approvalStep ?? ""}`,
    `lock,approvalChainStatus,${manifest.lockSummary.approvalChainStatus ?? ""}`,
    `lock,lockedAt,${manifest.lockSummary.lockedAt ?? ""}`,
    `lock,datapointsTotal,${manifest.lockSummary.datapointsTotal}`,
    `lock,datapointsLocked,${manifest.lockSummary.datapointsLocked}`,
    `lock,datapointsInProgress,${manifest.lockSummary.datapointsInProgress}`,
    `lock,datapointsRejected,${manifest.lockSummary.datapointsRejected}`,
  ];

  for (const f of manifest.factors) {
    lines.push(
      `factor,${csvEscape(f.key)},${csvEscape(`${f.source} ${f.year}; value=${f.value}; id=${f.factorId}`)}`,
    );
  }
  for (const g of manifest.missingDataRegister) {
    lines.push(`gap,${csvEscape(g.code)},${csvEscape(`${g.severity}: ${g.message}`)}`);
  }
  for (const e of manifest.evidenceLinks) {
    lines.push(
      `evidence,${csvEscape(e.evidenceId)},${csvEscape(`${e.filename}; sha=${e.sha256}; link=${e.linkState}; dp=${e.datapointId ?? ""}; path=${e.pathHint}`)}`,
    );
  }
  for (const p of manifest.lineagePointers) {
    lines.push(
      `lineage,${csvEscape(p.datapointId)},${csvEscape(`${p.metricKey}; value=${p.value ?? ""}; quality=${p.quality}; evidence=${p.evidenceLink}; factor=${p.factorId ?? ""}; evidenceIds=${p.evidenceIds.join("|")}`)}`,
    );
  }

  return lines.join("\n");
}

export function evidencePackBasename(manifest: EvidencePackManifest): string {
  const org = manifest.organisationName
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const period = manifest.periodLabel
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `clearesg-evidence-pack-${org || "org"}-${period || "period"}`;
}
