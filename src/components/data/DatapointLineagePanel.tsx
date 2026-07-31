"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Metric } from "@/components/ui/metric";
import type { LaidOutNode, LineageEdge, LineageGraph } from "@/lib/data/lineage";
import { lineageDownloadFilename, lineageToJson } from "@/lib/data/lineage";

type LayoutPayload = {
  width: number;
  height: number;
  nodes: LaidOutNode[];
  edges: LineageEdge[];
};

function LineageSvg({
  layout,
  selectedId,
  onSelect,
}: {
  layout: LayoutPayload;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="max-h-[420px] bg-canvas text-ink"
      role="img"
      aria-label="Datapoint lineage graph"
    >
      {layout.edges.map((e) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        const x1 = a.x + a.width;
        const y1 = a.y + a.height / 2;
        const x2 = b.x;
        const y2 = b.y + b.height / 2;
        const mx = (x1 + x2) / 2;
        return (
          <g key={e.id}>
            <path
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none"
              stroke="var(--rule-strong)"
              strokeWidth={1.25}
            />
            {e.label ? (
              <text
                x={mx}
                y={(y1 + y2) / 2 - 4}
                textAnchor="middle"
                fill="var(--ink-muted)"
                fontSize={9}
              >
                {e.label.length > 28 ? `${e.label.slice(0, 27)}…` : e.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {layout.nodes.map((n) => (
        <g
          key={n.id}
          className="cursor-pointer"
          onClick={() => onSelect(n.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              onSelect(n.id);
            }
          }}
        >
          <rect
            x={n.x}
            y={n.y}
            width={n.width}
            height={n.height}
            rx={6}
            fill={
              n.kind === "result"
                ? "var(--accent-quiet)"
                : n.kind === "transform" || n.kind === "factor"
                  ? "var(--surface-2)"
                  : "var(--surface-1)"
            }
            stroke={
              selectedId === n.id || n.kind === "result" ? "var(--accent)" : "var(--rule)"
            }
            strokeWidth={selectedId === n.id ? 2 : 1}
          />
          <text
            x={n.x + 10}
            y={n.y + 18}
            fill="var(--ink)"
            fontSize={10}
            fontWeight={600}
          >
            {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
          </text>
          {n.value != null && Number.isFinite(n.value) ? (
            <text
              x={n.x + 10}
              y={n.y + 36}
              fill="var(--ink)"
              fontSize={11}
              className="font-data"
            >
              {n.value}
              {n.unit ? ` ${n.unit}` : ""}
            </text>
          ) : n.detail ? (
            <text x={n.x + 10} y={n.y + 36} fill="var(--ink-muted)" fontSize={9}>
              {n.detail.length > 26 ? `${n.detail.slice(0, 25)}…` : n.detail}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export function DatapointLineagePanel({
  datapointId,
  metricLabel,
  open,
  onOpenChange,
}: {
  datapointId: string;
  metricLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [layout, setLayout] = useState<LayoutPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedId(null);
    try {
      const res = await fetch(`/api/app/datapoints/${datapointId}/lineage`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        graph?: LineageGraph;
        layout?: LayoutPayload;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load lineage.");
        setGraph(null);
        setLayout(null);
        return;
      }
      setGraph(data.graph ?? null);
      setLayout(data.layout ?? null);
    } catch {
      setError("Could not load lineage.");
      setGraph(null);
      setLayout(null);
    } finally {
      setLoading(false);
    }
  }, [datapointId]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) void load();
  }

  function downloadJson() {
    if (!graph) return;
    const blob = new Blob([lineageToJson(graph)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = lineageDownloadFilename(graph.metricKey, "json");
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadSvg() {
    window.open(`/api/app/datapoints/${datapointId}/lineage?format=svg`, "_blank");
  }

  function printView() {
    window.print();
  }

  const selected = graph?.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-rule bg-surface-1 text-ink print:max-w-none print:overflow-visible">
        <DialogHeader className="print:block">
          <DialogTitle className="font-display text-ink">Data lineage</DialogTitle>
          <DialogDescription className="text-ink-muted">
            Sources → transforms → result for {metricLabel}. Factors and formulas are read
            from the live datapoint, version history, and metric recipes.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-[13px] text-ink-muted">Loading lineage…</p>
        ) : error ? (
          <p className="border border-rust/40 bg-rust/10 px-3 py-2 text-[13px] text-rust">
            {error}
          </p>
        ) : layout && graph ? (
          <div className="space-y-4 print:space-y-3">
            <div className="overflow-x-auto rounded-[6px] border border-rule bg-canvas p-2 print:border-rule-strong">
              <LineageSvg
                layout={layout}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>

            <div className="flex flex-wrap gap-4 text-[11px] text-ink-muted print:hidden">
              <span>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-[2px] border border-rule bg-surface-1" />
                Source / input
              </span>
              <span>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-[2px] border border-rule bg-surface-2" />
                Transform / factor
              </span>
              <span>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-[2px] border border-accent bg-accent-quiet" />
                Result
              </span>
              <span className="font-data tabular-nums">
                {graph.nodes.length} nodes · {graph.edges.length} edges
              </span>
            </div>

            {selected ? (
              <div className="border-t border-rule pt-3 print:hidden">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {selected.kind}
                </p>
                <p className="mt-1 text-[13px] font-medium text-ink">{selected.label}</p>
                {selected.detail ? (
                  <p className="mt-1 text-[12px] text-ink-muted">{selected.detail}</p>
                ) : null}
                {selected.value != null ? (
                  <p className="mt-1 font-data text-[13px] tabular-nums text-ink">
                    <Metric
                      value={selected.value}
                      size="sm"
                      decimals={3}
                      className="inline"
                      inView={false}
                    />
                    {selected.unit ? ` ${selected.unit}` : null}
                    {selected.quality ? (
                      <span className="text-ink-muted"> · {selected.quality}</span>
                    ) : null}
                  </p>
                ) : null}
                {selected.timestamp ? (
                  <p className="mt-1 font-data text-[11px] text-ink-muted tabular-nums">
                    {selected.timestamp}
                    {selected.actorId ? ` · ${selected.actorId}` : null}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[12px] text-ink-muted print:hidden">
                Select a node for formula, values, and actor detail.
              </p>
            )}
          </div>
        ) : (
          <p className="py-6 text-center text-[13px] text-ink-muted">
            No lineage available.
          </p>
        )}

        <DialogFooter className="print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!graph}
            onClick={downloadJson}
          >
            Download JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!graph}
            onClick={downloadSvg}
          >
            Download SVG
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!graph}
            onClick={printView}
          >
            Print
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
