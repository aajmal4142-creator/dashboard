import type { LineageEdge, LineageGraph, LineageLayout, LaidOutNode } from "./types";

const NODE_W = 168;
const NODE_H = 56;
const COL_GAP = 72;
const ROW_GAP = 20;
const PAD = 24;

/**
 * Simple left-to-right layered layout for SVG rendering.
 * Uses graph.layers when present; otherwise buckets by kind.
 */
export function layoutLineageGraph(graph: LineageGraph): LineageLayout {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const layers =
    graph.layers.length > 0
      ? graph.layers
      : [
          graph.nodes
            .filter(
              (n) => n.kind === "source" || n.kind === "input" || n.kind === "evidence",
            )
            .map((n) => n.id),
          graph.nodes
            .filter((n) => n.kind === "transform" || n.kind === "factor")
            .map((n) => n.id),
          graph.nodes.filter((n) => n.kind === "result").map((n) => n.id),
        ].filter((l) => l.length > 0);

  const laid: LaidOutNode[] = [];
  let maxBottom = 0;

  layers.forEach((layer, col) => {
    const x = PAD + col * (NODE_W + COL_GAP);
    layer.forEach((id, row) => {
      const n = byId.get(id);
      if (!n) return;
      const y = PAD + row * (NODE_H + ROW_GAP);
      laid.push({ ...n, x, y, width: NODE_W, height: NODE_H });
      maxBottom = Math.max(maxBottom, y + NODE_H);
    });
  });

  const width =
    PAD * 2 +
    Math.max(1, layers.length) * NODE_W +
    Math.max(0, layers.length - 1) * COL_GAP;
  const height = Math.max(PAD * 2 + NODE_H, maxBottom + PAD);

  return { nodes: laid, edges: graph.edges, width, height };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trunc(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

/**
 * Serialise a laid-out graph to an SVG string (token-colour placeholders via
 * currentColor / CSS custom properties for print and download).
 */
export function lineageLayoutToSvg(layout: LineageLayout, title?: string): string {
  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));
  const edgePaths: string[] = [];

  for (const e of layout.edges) {
    const a = nodeMap.get(e.from);
    const b = nodeMap.get(e.to);
    if (!a || !b) continue;
    const x1 = a.x + a.width;
    const y1 = a.y + a.height / 2;
    const x2 = b.x;
    const y2 = b.y + b.height / 2;
    const mx = (x1 + x2) / 2;
    edgePaths.push(
      `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="var(--rule-strong)" stroke-width="1.25" />`,
    );
    if (e.label) {
      edgePaths.push(
        `<text x="${mx}" y="${(y1 + y2) / 2 - 4}" text-anchor="middle" font-size="9" fill="var(--ink-muted)">${escapeXml(trunc(e.label, 28))}</text>`,
      );
    }
  }

  const nodeShapes = layout.nodes
    .map((n) => {
      const fill =
        n.kind === "result"
          ? "var(--accent-quiet)"
          : n.kind === "transform" || n.kind === "factor"
            ? "var(--surface-2)"
            : "var(--surface-1)";
      const stroke = n.kind === "result" ? "var(--accent)" : "var(--rule)";
      const valueLine =
        n.value != null && Number.isFinite(n.value)
          ? escapeXml(`${n.value}${n.unit ? ` ${n.unit}` : ""}`)
          : "";
      return [
        `<g data-kind="${escapeXml(n.kind)}" data-id="${escapeXml(n.id)}">`,
        `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1" />`,
        `<text x="${n.x + 10}" y="${n.y + 18}" font-size="10" font-weight="600" fill="var(--ink)">${escapeXml(trunc(n.label, 22))}</text>`,
        valueLine
          ? `<text x="${n.x + 10}" y="${n.y + 36}" font-size="11" font-family="ui-monospace, monospace" fill="var(--ink)">${valueLine}</text>`
          : n.detail
            ? `<text x="${n.x + 10}" y="${n.y + 36}" font-size="9" fill="var(--ink-muted)">${escapeXml(trunc(n.detail, 26))}</text>`
            : "",
        `</g>`,
      ].join("");
    })
    .join("\n");

  const heading = title
    ? `<text x="${PAD}" y="16" font-size="12" font-weight="600" fill="var(--ink)">${escapeXml(title)}</text>`
    : "";

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height + (title ? 8 : 0)}" viewBox="0 0 ${layout.width} ${layout.height + (title ? 8 : 0)}" role="img" aria-label="Datapoint lineage graph">`,
    heading,
    ...edgePaths,
    nodeShapes,
    `</svg>`,
  ].join("\n");
}

export function lineageToJson(graph: LineageGraph): string {
  return `${JSON.stringify(graph, null, 2)}\n`;
}

export function lineageDownloadFilename(metricKey: string, ext: "json" | "svg"): string {
  const safe = metricKey.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 64);
  return `lineage-${safe}.${ext}`;
}

/** Re-export for callers that only need edge typing. */
export type { LineageEdge };
