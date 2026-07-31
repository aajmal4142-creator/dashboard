import { recipeForMetric } from "./recipes";
import type { BuildLineageInput, LineageEdge, LineageGraph, LineageNode } from "./types";

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    manual: "Manual entry",
    import: "File import",
    supplier: "Supplier portal",
    estimate: "Estimate",
    api: "API ingest",
    internal_survey: "Internal survey",
  };
  return map[source] ?? source;
}

function node(
  partial: Omit<
    LineageNode,
    "detail" | "value" | "unit" | "quality" | "timestamp" | "actorId" | "meta"
  > &
    Partial<
      Pick<
        LineageNode,
        "detail" | "value" | "unit" | "quality" | "timestamp" | "actorId" | "meta"
      >
    >,
): LineageNode {
  return {
    detail: partial.detail ?? null,
    value: partial.value ?? null,
    unit: partial.unit ?? null,
    quality: partial.quality ?? null,
    timestamp: partial.timestamp ?? null,
    actorId: partial.actorId ?? null,
    meta: partial.meta ?? {},
    id: partial.id,
    kind: partial.kind,
    label: partial.label,
  };
}

function edge(from: string, to: string, label: string | null = null): LineageEdge {
  return { id: `e:${from}->${to}`, from, to, label };
}

/**
 * Build a layered lineage graph: sources/inputs → transforms/factors → result.
 * Pure — no I/O. Circular predecessor refs are dropped.
 */
export function buildDatapointLineageGraph(input: BuildLineageInput): LineageGraph {
  const recipe = recipeForMetric(input.metricKey);
  const nodes: LineageNode[] = [];
  const edges: LineageEdge[] = [];
  const seen = new Set<string>();

  function add(n: LineageNode) {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  }

  const sourceId = "source:origin";
  add(
    node({
      id: sourceId,
      kind: "source",
      label: sourceLabel(input.source),
      detail: input.provenance ? `Provenance: ${input.provenance}` : null,
      timestamp: input.enteredAt ?? null,
      actorId: input.enteredBy ?? null,
      meta: { source: input.source, provenance: input.provenance ?? null },
    }),
  );

  const inputLayer: string[] = [sourceId];
  const periodByKey = new Map((input.periodInputs ?? []).map((p) => [p.metricKey, p]));

  for (const key of recipe?.inputKeys ?? []) {
    if (key === input.metricKey) continue; // prevent self-loop
    const sibling = periodByKey.get(key);
    const id = sibling ? `input:${sibling.id}` : `input:missing:${key}`;
    add(
      node({
        id,
        kind: "input",
        label: sibling?.label ?? key,
        detail: sibling ? null : "Source deleted or not in period",
        value: sibling?.value ?? null,
        unit: sibling?.unit ?? null,
        quality: sibling?.quality ?? "missing",
        meta: { metricKey: key, present: Boolean(sibling) },
      }),
    );
    inputLayer.push(id);
  }

  for (const ev of input.evidence ?? []) {
    const id = `evidence:${ev.id}`;
    add(
      node({
        id,
        kind: "evidence",
        label: ev.filename || ev.id,
        detail: "Evidence attachment",
        meta: { evidenceId: ev.id },
      }),
    );
    inputLayer.push(id);
  }

  const transformLayer: string[] = [];
  let previousTransformId: string | null = null;

  const versionsAsc = [...(input.versions ?? [])].sort(
    (a, b) => a.versionNumber - b.versionNumber,
  );

  for (const v of versionsAsc) {
    const id = `transform:v${v.versionNumber}`;
    const before =
      v.oldValue != null && Number.isFinite(v.oldValue) ? String(v.oldValue) : "—";
    const after =
      v.newValue != null && Number.isFinite(v.newValue) ? String(v.newValue) : "—";
    add(
      node({
        id,
        kind: "transform",
        label: `${v.changeType} · v${v.versionNumber}`,
        detail: v.reason ?? `${before} → ${after}`,
        value: v.newValue,
        quality: v.newQuality,
        timestamp: v.changedAt,
        actorId: v.changedBy,
        meta: {
          changeType: v.changeType,
          versionNumber: v.versionNumber,
          before: v.oldValue,
          after: v.newValue,
        },
      }),
    );
    transformLayer.push(id);

    if (previousTransformId) {
      edges.push(edge(previousTransformId, id, "then"));
    } else {
      for (const from of inputLayer) {
        edges.push(edge(from, id, null));
      }
    }
    previousTransformId = id;
  }

  if (recipe?.formula) {
    const id = "transform:formula";
    add(
      node({
        id,
        kind: "transform",
        label: "Calculation",
        detail: recipe.formula,
        meta: {
          formula: recipe.formula,
          emissionFactorKey: recipe.emissionFactorKey,
        },
      }),
    );
    transformLayer.push(id);
    if (previousTransformId) {
      edges.push(edge(previousTransformId, id, recipe.formula));
    } else {
      for (const from of inputLayer) {
        edges.push(edge(from, id, null));
      }
    }
    previousTransformId = id;
  }

  if (input.factor || input.factorId || recipe?.emissionFactorKey) {
    const factor = input.factor;
    const id = factor
      ? `factor:${factor.id}`
      : `factor:${input.factorId ?? recipe?.emissionFactorKey ?? "unresolved"}`;
    add(
      node({
        id,
        kind: "factor",
        label: factor
          ? `${factor.key} (${factor.source} ${factor.year})`
          : input.factorId
            ? `Pinned factor ${input.factorId}`
            : `Factor key ${recipe?.emissionFactorKey}`,
        detail: factor
          ? `${factor.value} ${factor.unit}`
          : input.factorId
            ? "Pinned id present; registry row not loaded"
            : "Registry key available for live preview",
        value: factor?.value ?? null,
        unit: factor?.unit ?? null,
        meta: {
          factorId: factor?.id ?? input.factorId ?? null,
          key: factor?.key ?? recipe?.emissionFactorKey ?? null,
        },
      }),
    );
    transformLayer.push(id);
    const attachTo = previousTransformId ?? null;
    if (attachTo) {
      edges.push(edge(id, attachTo, "× factor"));
    } else {
      for (const from of inputLayer) {
        edges.push(edge(from, id, null));
      }
      previousTransformId = id;
    }
  }

  const resultId = `result:${input.datapointId}`;
  add(
    node({
      id: resultId,
      kind: "result",
      label: input.metricLabel ?? input.metricKey,
      detail: input.metricKey,
      value: input.value,
      unit: input.unit,
      quality: input.quality,
      timestamp: input.enteredAt ?? null,
      actorId: input.enteredBy ?? null,
      meta: { datapointId: input.datapointId, metricKey: input.metricKey },
    }),
  );

  if (previousTransformId) {
    edges.push(edge(previousTransformId, resultId, "result"));
  } else {
    for (const from of inputLayer) {
      edges.push(edge(from, resultId, null));
    }
  }

  // Deduplicate edges (factor dual paths etc.)
  const edgeSeen = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    if (edgeSeen.has(e.id)) return false;
    edgeSeen.add(e.id);
    return true;
  });

  const layers: string[][] = [
    inputLayer.filter((id) => seen.has(id)),
    transformLayer.filter((id) => seen.has(id)),
    [resultId],
  ].filter((layer) => layer.length > 0);

  return {
    datapointId: input.datapointId,
    metricKey: input.metricKey,
    metricLabel: input.metricLabel ?? recipe?.label ?? null,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    nodes,
    edges: uniqueEdges,
    layers,
  };
}

/** Compact JSON-serialisable snapshot for persistence on the datapoint. */
export function lineageSnapshotFromGraph(graph: LineageGraph): {
  datapointId: string;
  metricKey: string;
  generatedAt: string;
  nodeCount: number;
  edgeCount: number;
  nodeIds: string[];
  edgeIds: string[];
  layers: string[][];
} {
  return {
    datapointId: graph.datapointId,
    metricKey: graph.metricKey,
    generatedAt: graph.generatedAt,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodeIds: graph.nodes.map((n) => n.id),
    edgeIds: graph.edges.map((e) => e.id),
    layers: graph.layers,
  };
}
