import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { buildFigureLineage, evidenceFreshness } from "@/lib/assurance";
import { getCurrentContext } from "@/lib/auth";
import type { FactorUsage } from "@/lib/calc/types";
import { DATA_METRICS } from "@/lib/data";
import type { ReportSnapshot } from "@/lib/reports";
import config from "@/payload.config";

type Props = { params: Promise<{ datapointId: string }> };

/**
 * Auditor one-click traversal — Phase 4.
 * Factors resolve from the latest published snapshot pins for this org/period —
 * never “latest factor by metricKey”.
 */
export async function GET(_req: Request, { params }: Props) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { datapointId } = await params;
  const payload = await getPayload({ config });

  const dp = await payload.findByID({
    collection: "datapoints",
    id: datapointId,
    depth: 2,
    overrideAccess: true,
  });
  const orgId =
    typeof dp.organisation === "string" ? dp.organisation : dp.organisation?.id;
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const periodId = typeof dp.period === "string" ? dp.period : dp.period?.id;
  let factorsUsed: FactorUsage[] = [];
  let periodStart = "";
  let periodEnd = "";
  if (periodId) {
    const period = await payload.findByID({
      collection: "reporting-periods",
      id: periodId,
      overrideAccess: true,
    });
    periodStart = String(period.startDate ?? "");
    periodEnd = String(period.endDate ?? "");

    const reports = await payload.find({
      collection: "reports",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: periodId } },
          { status: { equals: "published" } },
        ],
      },
      sort: "-version",
      limit: 1,
      overrideAccess: true,
    });
    const snap = reports.docs[0]?.snapshot as ReportSnapshot | null | undefined;
    factorsUsed = snap?.factorsUsed ?? [];
  }

  const evidenceIds = (dp.evidence ?? []).map((e) => (typeof e === "string" ? e : e.id));
  const evidenceDocs = [];
  for (const id of evidenceIds) {
    const ev = await payload.findByID({
      collection: "evidence",
      id,
      depth: 0,
      overrideAccess: true,
    });
    const linked = (ev.linkedDatapoints ?? []).map((d) =>
      typeof d === "string" ? d : d.id,
    );
    evidenceDocs.push({
      id: ev.id,
      filename: ev.filename,
      sha256: ev.sha256,
      uploadedAt: String(ev.uploadedAt ?? ev.createdAt),
      coverageStart: ev.coverageStart ? String(ev.coverageStart) : null,
      coverageEnd: ev.coverageEnd ? String(ev.coverageEnd) : null,
      linkedDatapointIds: linked,
    });
  }

  const lineage = buildFigureLineage({
    datapointId,
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
    factorRegistryKey:
      DATA_METRICS.find((m) => m.key === dp.metricKey)?.emissionFactorKey ?? null,
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

  return NextResponse.json({
    datapoint: {
      id: dp.id,
      metricKey: dp.metricKey,
      value: dp.value,
      unit: dp.unit,
      quality: dp.quality,
      approvalState: dp.approvalState ?? "pending",
      approvalReason: dp.approvalReason ?? null,
      source: dp.source,
      provenance: dp.provenance ?? null,
      enteredAt: dp.enteredAt,
      note: dp.note,
      factorId: dp.factorId ?? null,
    },
    lineage,
    freshness,
  });
}
