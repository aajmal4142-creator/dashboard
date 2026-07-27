import type { Payload } from "payload";

import {
  buildFigureLineage,
  evidenceFreshness,
  type FigureLineage,
  type FreshnessResult,
} from "@/lib/assurance";
import type { FactorUsage } from "@/lib/calc/types";
import { DATA_METRICS } from "@/lib/data";
import type { ReportSnapshot } from "@/lib/reports";

export type AssurancePayload = {
  snapshot: ReportSnapshot;
  versionLabel: string;
  figures: Array<{
    datapointId: string;
    metricKey: string;
    value: number | null;
    unit: string | null;
    quality: string;
    lineage: FigureLineage;
    freshness: Array<{ evidenceId: string } & FreshnessResult>;
  }>;
};

/** Build Assurance Room payload from a published report + live datapoints for lineage. */
export async function loadAssurancePayload(
  payload: Payload,
  report: {
    id: string;
    version: number;
    snapshot?: unknown;
    organisation: string | { id: string };
    period: string | { id: string };
  },
): Promise<AssurancePayload | null> {
  const snapshot = report.snapshot as ReportSnapshot | null;
  if (!snapshot) return null;

  const orgId =
    typeof report.organisation === "string"
      ? report.organisation
      : report.organisation.id;
  const periodId = typeof report.period === "string" ? report.period : report.period.id;

  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    overrideAccess: true,
  });
  const periodStart = String(period.startDate ?? "");
  const periodEnd = String(period.endDate ?? "");
  const factorsUsed: FactorUsage[] = snapshot.factorsUsed ?? [];

  const dps = await payload.find({
    collection: "datapoints",
    where: {
      and: [{ organisation: { equals: orgId } }, { period: { equals: periodId } }],
    },
    limit: 200,
    overrideAccess: true,
  });

  const figures = [];
  for (const dp of dps.docs) {
    const evidenceIds = (dp.evidence ?? []).map((e) =>
      typeof e === "string" ? e : e.id,
    );
    const evidenceDocs = [];
    for (const id of evidenceIds) {
      const ev = await payload.findByID({
        collection: "evidence",
        id,
        depth: 0,
        overrideAccess: true,
      });
      evidenceDocs.push({
        id: ev.id,
        filename: ev.filename,
        sha256: ev.sha256,
        uploadedAt: String(ev.uploadedAt ?? ev.createdAt),
        coverageStart: ev.coverageStart ? String(ev.coverageStart) : null,
        coverageEnd: ev.coverageEnd ? String(ev.coverageEnd) : null,
        linkedDatapointIds: (ev.linkedDatapoints ?? []).map((d) =>
          typeof d === "string" ? d : d.id,
        ),
      });
    }

    const factorRegistryKey =
      DATA_METRICS.find((m) => m.key === dp.metricKey)?.emissionFactorKey ?? null;

    const lineage = buildFigureLineage({
      datapointId: dp.id,
      metricKey: dp.metricKey,
      value: typeof dp.value === "number" ? dp.value : null,
      quality: dp.quality,
      provenance:
        dp.provenance === "supplier_primary" ||
        dp.provenance === "spend_estimate" ||
        dp.provenance === "manual"
          ? dp.provenance
          : null,
      datapointFactorId: dp.factorId ?? null,
      factorRegistryKey,
      datapointEvidenceIds: evidenceIds,
      evidenceDocs,
      factorsUsed,
    });

    const freshness = evidenceDocs.map((e) => ({
      evidenceId: e.id,
      ...evidenceFreshness({
        coverageStart: e.coverageStart,
        coverageEnd: e.coverageEnd,
        periodStart,
        periodEnd,
      }),
    }));

    figures.push({
      datapointId: dp.id,
      metricKey: dp.metricKey,
      value: typeof dp.value === "number" ? dp.value : null,
      unit: dp.unit ?? null,
      quality: dp.quality,
      lineage,
      freshness,
    });
  }

  return {
    snapshot,
    versionLabel: `v${report.version}`,
    figures,
  };
}
