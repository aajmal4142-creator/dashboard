import type { Payload } from "payload";

import {
  buildDatapointLineageGraph,
  lineageSnapshotFromGraph,
  type LineageGraph,
  type LineageVersionStep,
} from "@/lib/data/lineage";
import { DATA_METRIC_BY_KEY } from "@/lib/data/metrics";
import { listDatapointVersions } from "@/lib/data/recordVersion";
import { DERIVED_METRICS } from "@/lib/derive/registry";
import { recipeForMetric } from "@/lib/data/lineage/recipes";

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function metricLabel(metricKey: string): string | null {
  return (
    DATA_METRIC_BY_KEY[metricKey]?.label ??
    DERIVED_METRICS.find((m) => m.key === metricKey)?.label ??
    null
  );
}

/**
 * Assemble a full datapoint lineage graph from live fields, versions, factor, and period siblings.
 */
export async function loadDatapointLineage(
  payload: Payload,
  opts: { organisationId: string; datapointId: string },
): Promise<LineageGraph> {
  const dp = await payload.findByID({
    collection: "datapoints",
    id: opts.datapointId,
    depth: 1,
    overrideAccess: true,
  });

  const orgId = relationId(dp.organisation);
  if (orgId !== opts.organisationId) {
    throw new Error("NOT_FOUND");
  }

  const periodId = relationId(dp.period);
  const versions = await listDatapointVersions(payload, {
    organisationId: opts.organisationId,
    datapointId: opts.datapointId,
  });

  const versionSteps: LineageVersionStep[] = versions.map((v) => ({
    versionNumber: v.versionNumber,
    changeType: v.changeType,
    changedAt: v.changedAt,
    changedBy: v.changedBy,
    reason: v.reason,
    oldValue: v.oldValue?.value ?? null,
    newValue: v.newValue?.value ?? null,
    oldQuality: v.oldValue?.quality ?? null,
    newQuality: v.newValue?.quality ?? null,
  }));

  const evidence = (dp.evidence ?? []).map((e) => {
    if (typeof e === "string") return { id: e, filename: e };
    return {
      id: String(e.id),
      filename: typeof e.filename === "string" ? e.filename : String(e.id),
    };
  });

  let factor: {
    id: string;
    key: string;
    value: number;
    unit: string;
    source: string;
    year: number;
  } | null = null;

  if (dp.factorId) {
    try {
      const row = await payload.findByID({
        collection: "emission-factors",
        id: dp.factorId,
        depth: 0,
        overrideAccess: true,
      });
      factor = {
        id: String(row.id),
        key: String(row.key),
        value: Number(row.value),
        unit: String(row.unit),
        source: String(row.source),
        year: Number(row.publicationYear),
      };
    } catch {
      factor = null;
    }
  }

  const recipe = recipeForMetric(String(dp.metricKey));
  let periodInputs: Array<{
    id: string;
    metricKey: string;
    label: string | null;
    value: number | null;
    unit: string | null;
    quality: string | null;
  }> = [];

  if (periodId && recipe && recipe.inputKeys.length > 0) {
    const siblings = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: opts.organisationId } },
          { period: { equals: periodId } },
          { metricKey: { in: recipe.inputKeys } },
        ],
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    });
    periodInputs = siblings.docs.map((s) => ({
      id: String(s.id),
      metricKey: String(s.metricKey),
      label: metricLabel(String(s.metricKey)),
      value: typeof s.value === "number" ? s.value : null,
      unit: typeof s.unit === "string" ? s.unit : null,
      quality: typeof s.quality === "string" ? s.quality : null,
    }));
  }

  return buildDatapointLineageGraph({
    datapointId: opts.datapointId,
    metricKey: String(dp.metricKey),
    metricLabel: metricLabel(String(dp.metricKey)),
    value: typeof dp.value === "number" ? dp.value : null,
    unit: typeof dp.unit === "string" ? dp.unit : null,
    quality: String(dp.quality),
    source: String(dp.source ?? "manual"),
    provenance: typeof dp.provenance === "string" ? dp.provenance : null,
    factorId: typeof dp.factorId === "string" ? dp.factorId : null,
    factor,
    evidence,
    versions: versionSteps,
    periodInputs,
    enteredBy: relationId(dp.enteredBy),
    enteredAt: dp.enteredAt ? String(dp.enteredAt) : null,
  });
}

/**
 * Persist a compact lineage snapshot on the datapoint (skips version + re-entry).
 */
export async function persistLineageSnapshot(
  payload: Payload,
  opts: { organisationId: string; datapointId: string },
): Promise<void> {
  const graph = await loadDatapointLineage(payload, opts);
  const snapshot = lineageSnapshotFromGraph(graph);
  await (
    payload.update as (args: {
      collection: "datapoints";
      id: string;
      data: Record<string, unknown>;
      overrideAccess: true;
      context: { skipDatapointVersion: true; skipLineageSnapshot: true };
    }) => Promise<unknown>
  )({
    collection: "datapoints",
    id: opts.datapointId,
    data: { lineageSnapshot: snapshot },
    overrideAccess: true,
    context: { skipDatapointVersion: true, skipLineageSnapshot: true },
  });
}
