"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Download, GitFork, Network, RefreshCw, X } from "lucide-react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import { cn } from "@/lib/utils";

type SizeMode = "emissions" | "spend";
type ScopeKey = "Scope1" | "Scope2" | "Scope3";

type NetworkNode = {
  id: string;
  name: string;
  tier: number;
  spend: number;
  emissions: number;
  scope: ScopeKey;
  location?: string | null;
  category?: string | null;
  estimated?: boolean;
  parentId?: string | null;
  relationshipStrength?: string | null;
  supplierId?: string | null;
};

type LaidOutNode = NetworkNode & {
  x: number;
  y: number;
  radius: number;
  colorVar: string;
  opacity: number;
};

type LaidOutLink = {
  sourceId: string;
  targetId: string;
  weight: number;
  strength: number;
};

type LayoutPayload = {
  nodes: LaidOutNode[];
  links: LaidOutLink[];
  center: { id: string; label: string; x: number; y: number; radius: number };
  stats: {
    totalSuppliers: number;
    totalSpend: number;
    totalEmissions: number;
    tierCounts: Record<string, number>;
    estimatedCount: number;
  };
  viewBox: { width: number; height: number };
};

type NetworkSummary = {
  id: string;
  name: string;
  edgeCount: number;
  createdAt?: string;
};

type NetworkView = {
  id: string;
  name: string;
  organisationName: string;
  sizeMode: SizeMode;
  visibleTiers: number[] | "all";
  nodes: NetworkNode[];
  layout: LayoutPayload;
};

type TierFilter = "all" | "1" | "1,2" | "1,2,3";

function formatNum(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatMoney(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${formatNum(n, 0)}`;
}

function cssVar(name: string): string {
  return `var(${name})`;
}

function positionOf(layout: LayoutPayload, id: string): { x: number; y: number } | null {
  if (id === "org") return { x: layout.center.x, y: layout.center.y };
  const n = layout.nodes.find((node) => node.id === id);
  return n ? { x: n.x, y: n.y } : null;
}

export function SupplyChainMapClient() {
  const [networks, setNetworks] = useState<NetworkSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<NetworkView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sizeMode, setSizeMode] = useState<SizeMode>("emissions");
  const [selected, setSelected] = useState<NetworkNode | null>(null);
  const [drillParent, setDrillParent] = useState<NetworkNode | null>(null);

  const loadNetworks = useCallback(async () => {
    const res = await fetch("/api/app/suppliers/supply-chain");
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to list supply chain networks");
    }
    const json = (await res.json()) as { networks: NetworkSummary[] };
    setNetworks(json.networks);
    return json.networks;
  }, []);

  const loadView = useCallback(async (id: string, tiers: TierFilter, mode: SizeMode) => {
    const qs = new URLSearchParams({
      tiers: tiers === "all" ? "all" : tiers,
      size: mode,
    });
    const res = await fetch(`/api/app/suppliers/supply-chain/${id}?${qs}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to load network");
    }
    const json = (await res.json()) as NetworkView;
    setView(json);
    setActiveId(id);
  }, []);

  const refresh = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const list = await loadNetworks();
        const id =
          activeId && list.some((n) => n.id === activeId) ? activeId : list[0]?.id;
        if (id) {
          await loadView(id, tierFilter, sizeMode);
        } else {
          setView(null);
          setActiveId(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load supply chain");
      }
    });
  }, [activeId, loadNetworks, loadView, sizeMode, tierFilter]);

  useEffect(() => {
    refresh();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    startTransition(async () => {
      setError(null);
      try {
        await loadView(activeId, tierFilter, sizeMode);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reload network");
      }
    });
  }, [activeId, tierFilter, sizeMode, loadView]);

  const createNetwork = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/app/suppliers/supply-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeEstimates: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create network");
      }
      const created = (await res.json()) as { id: string };
      const list = await loadNetworks();
      setNetworks(list);
      setActiveId(created.id);
      await loadView(created.id, tierFilter, sizeMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create network");
    } finally {
      setCreating(false);
    }
  };

  const exportCsv = async () => {
    if (!activeId) return;
    setError(null);
    try {
      const res = await fetch(`/api/app/suppliers/supply-chain/${activeId}/export`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clearesg-supply-chain-${activeId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  const childrenOfSelected = useMemo(() => {
    if (!view || !selected) return [];
    return view.nodes.filter((n) => n.parentId === selected.id);
  }, [view, selected]);

  const layout = view?.layout;
  const nodeById = useMemo(() => {
    const m = new Map<string, NetworkNode>();
    for (const n of view?.nodes ?? []) m.set(n.id, n);
    return m;
  }, [view]);

  return (
    <PageFrame
      eyebrow="Suppliers"
      title="Supply chain map"
      help="Radial view of Tier 1–3 suppliers. Colour is GHG scope; size follows emissions or spend. Tier 2/3 default to estimates when survey data is missing."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={pending}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!activeId || pending}
          >
            <Download className="size-3.5" aria-hidden />
            Export CSV
          </Button>
          <Button type="button" size="sm" onClick={createNetwork} disabled={creating}>
            <Network className="size-3.5" aria-hidden />
            {creating ? "Building…" : "Build network"}
          </Button>
        </div>
      }
    >
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      {pending && !view ? (
        <p className="text-sm text-ink-muted">Loading supply chain…</p>
      ) : null}

      {!pending && networks.length === 0 && !view ? (
        <EmptyState
          title="No supply chain network yet"
          body="Build a network from your Suppliers list. Tier 1 is auto-populated; Tier 2/3 are estimated until surveys land."
          action={
            <Button type="button" onClick={createNetwork} disabled={creating}>
              Build network
            </Button>
          }
        />
      ) : null}

      {networks.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-rule pb-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Network
          </span>
          {networks.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setActiveId(n.id)}
              className={cn(
                "rounded-[4px] border px-2.5 py-1 text-xs transition-colors",
                activeId === n.id
                  ? "border-accent bg-surface-2 text-ink"
                  : "border-rule bg-surface-1 text-ink-muted hover:text-ink",
              )}
            >
              {n.name}
              <span className="ml-1.5 font-data text-ink-muted">{n.edgeCount}</span>
            </button>
          ))}
        </div>
      ) : null}

      {view && layout ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <PageCard className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Nodes
              </p>
              <Metric
                value={layout.stats.totalSuppliers}
                size="lg"
                animate={false}
                className="mt-1"
              />
            </PageCard>
            <PageCard className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Total spend
              </p>
              <p className="mt-1 font-data text-xl text-ink">
                {formatMoney(layout.stats.totalSpend)}
              </p>
            </PageCard>
            <PageCard className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Emissions
              </p>
              <Metric
                value={layout.stats.totalEmissions}
                unit="tCO₂e"
                size="lg"
                decimals={1}
                animate={false}
                className="mt-1"
              />
            </PageCard>
            <PageCard className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Estimated
              </p>
              <Metric
                value={layout.stats.estimatedCount}
                size="lg"
                animate={false}
                className="mt-1"
              />
            </PageCard>
          </div>

          <PageCard className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Emissions by tier (Category 1 split)
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {([1, 2, 3] as const).map((tier) => {
                const nodes = view.nodes.filter((n) => n.tier === tier);
                const emissions = nodes.reduce((s, n) => s + n.emissions, 0);
                const estimated = nodes.filter((n) => n.estimated).length;
                return (
                  <div key={tier} className="rounded-[4px] border border-rule px-3 py-2">
                    <p className="text-[11px] text-ink-muted">
                      Tier {tier}
                      {tier >= 2 ? " upstream" : " direct"}
                    </p>
                    <p className="mt-1 font-data text-lg text-ink">
                      {formatNum(emissions)} tCO₂e
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {nodes.length} nodes
                      {estimated > 0 ? ` · ${estimated} estimated` : " · measured"}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[12px] text-ink-muted">
              Tier 2/3 use hybrid estimates when survey data is missing. Confidence shown
              on node detail.{" "}
              <Link
                href="/scope3/category-1"
                className="text-accent underline-offset-2 hover:underline"
              >
                Full Category 1 breakdown
              </Link>
            </p>
          </PageCard>

          <PageCard className="p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">{view.name}</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Click a supplier for detail. Lines scale with {sizeMode} share.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  Tiers
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value as TierFilter)}
                    className="rounded-[4px] border border-rule bg-surface-1 px-2 py-1 text-ink"
                  >
                    <option value="all">All</option>
                    <option value="1">Tier 1 only</option>
                    <option value="1,2">Tier 1–2</option>
                    <option value="1,2,3">Tier 1–3</option>
                  </select>
                </label>
                <div
                  className="flex rounded-[4px] border border-rule p-0.5"
                  role="group"
                  aria-label="Size by"
                >
                  <button
                    type="button"
                    onClick={() => setSizeMode("emissions")}
                    className={cn(
                      "rounded-[2px] px-2.5 py-1 text-xs",
                      sizeMode === "emissions"
                        ? "bg-accent text-[color:var(--canvas)]"
                        : "text-ink-muted",
                    )}
                  >
                    Emissions
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeMode("spend")}
                    className={cn(
                      "rounded-[2px] px-2.5 py-1 text-xs",
                      sizeMode === "spend"
                        ? "bg-accent text-[color:var(--canvas)]"
                        : "text-ink-muted",
                    )}
                  >
                    Spend
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
                className="mx-auto h-auto w-full max-w-3xl"
                role="img"
                aria-label="Supply chain network graph"
              >
                <rect
                  width={layout.viewBox.width}
                  height={layout.viewBox.height}
                  fill="var(--surface-2)"
                />

                {/* Rings */}
                {[1, 2, 3].map((tier) => {
                  const step = Math.min(layout.center.x * 0.28, 110);
                  return (
                    <circle
                      key={tier}
                      cx={layout.center.x}
                      cy={layout.center.y}
                      r={step * tier}
                      fill="none"
                      stroke="var(--rule)"
                      strokeWidth={1}
                      strokeDasharray={tier > 1 ? "3 4" : undefined}
                      opacity={0.7}
                    />
                  );
                })}

                {/* Links */}
                {layout.links.map((link) => {
                  const from = positionOf(layout, link.sourceId);
                  const to = positionOf(layout, link.targetId);
                  if (!from || !to) return null;
                  const strokeW = Math.max(0.6, Math.min(4, 0.6 + link.weight * 8));
                  return (
                    <line
                      key={`${link.sourceId}-${link.targetId}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="var(--rule-strong)"
                      strokeWidth={strokeW}
                      opacity={0.45 + link.strength * 0.35}
                    />
                  );
                })}

                {/* Org center */}
                <g>
                  <circle
                    cx={layout.center.x}
                    cy={layout.center.y}
                    r={layout.center.radius}
                    fill="var(--accent)"
                  />
                  <text
                    x={layout.center.x}
                    y={layout.center.y + layout.center.radius + 14}
                    textAnchor="middle"
                    className="fill-[color:var(--ink)]"
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-ui, Inter Tight, sans-serif)",
                    }}
                  >
                    {layout.center.label.length > 28
                      ? `${layout.center.label.slice(0, 26)}…`
                      : layout.center.label}
                  </text>
                </g>

                {/* Supplier nodes */}
                {layout.nodes.map((node) => (
                  <g
                    key={node.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelected(nodeById.get(node.id) ?? node);
                      setDrillParent(null);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(nodeById.get(node.id) ?? node);
                        setDrillParent(null);
                      }
                    }}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.radius}
                      fill={cssVar(node.colorVar)}
                      opacity={node.opacity}
                      stroke="var(--ink)"
                      strokeWidth={selected?.id === node.id ? 2 : 0.5}
                      strokeOpacity={0.35}
                    />
                    {node.tier === 1 ? (
                      <text
                        x={node.x}
                        y={node.y + node.radius + 12}
                        textAnchor="middle"
                        style={{
                          fontSize: 9,
                          fill: "var(--ink-muted)",
                          fontFamily: "var(--font-ui, Inter Tight, sans-serif)",
                        }}
                      >
                        {node.name.length > 18 ? `${node.name.slice(0, 16)}…` : node.name}
                      </text>
                    ) : null}
                  </g>
                ))}
              </svg>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 border-t border-rule pt-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-[2px] bg-[color:var(--rust)]" />
                Scope 1
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-[2px] bg-[color:var(--cobalt)]" />
                Scope 2
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-[2px] bg-[color:var(--signal)]" />
                Scope 3
              </span>
              <span>Size = {sizeMode}</span>
              <span>Tier 2/3 opacity reduced · dashed rings</span>
            </div>
          </PageCard>
        </div>
      ) : null}

      {/* Detail modal */}
      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,var(--ink)_45%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scm-modal-title"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-[6px] border border-rule bg-surface-1 p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-rule pb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                  Tier {selected.tier}
                  {selected.estimated ? " · Estimated" : ""}
                </p>
                <h3 id="scm-modal-title" className="mt-1 text-lg font-semibold text-ink">
                  {selected.name}
                </h3>
              </div>
              <button
                type="button"
                className="rounded-[4px] p-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-muted">Scope</dt>
                <dd className="font-data text-ink">{selected.scope}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Location</dt>
                <dd className="text-ink">{selected.location || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Spend</dt>
                <dd className="font-data text-ink">{formatMoney(selected.spend)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Emissions</dt>
                <dd className="font-data text-ink">
                  {formatNum(selected.emissions)} tCO₂e
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Confidence</dt>
                <dd className={selected.estimated ? "text-amber" : "text-signal"}>
                  {selected.estimated ? "Low (estimated)" : "High (actual / measured)"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Category</dt>
                <dd className="text-ink">{selected.category || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Strength</dt>
                <dd className="text-ink">{selected.relationshipStrength || "—"}</dd>
              </div>
            </dl>

            {selected.tier >= 2 ? (
              <p className="mt-3 rounded-[4px] border border-rule bg-surface-2 px-2.5 py-2 text-[12px] text-ink-muted">
                Tier {selected.tier} node
                {selected.estimated
                  ? " — emissions from hybrid estimate (spend × industry intensity × allocation). Not double-counted with Tier 1 direct."
                  : " — measured emissions allocated to this relationship."}
              </p>
            ) : null}

            {selected.supplierId ? (
              <Link
                href={`/suppliers/${selected.supplierId}/tier-emissions`}
                className="mt-3 inline-block text-xs text-accent underline-offset-2 hover:underline"
              >
                Open Tier 2 estimate
              </Link>
            ) : null}

            {childrenOfSelected.length > 0 ? (
              <div className="mt-4 border-t border-rule pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  <GitFork className="size-3.5" aria-hidden />
                  Downstream ({childrenOfSelected.length})
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {childrenOfSelected.map((child) => (
                    <li key={child.id}>
                      <button
                        type="button"
                        className="w-full rounded-[4px] border border-rule px-2 py-1.5 text-left text-ink hover:bg-surface-2"
                        onClick={() => {
                          setDrillParent(selected);
                          setSelected(child);
                        }}
                      >
                        <span className="font-medium">{child.name}</span>
                        <span className="ml-2 font-data text-xs text-ink-muted">
                          T{child.tier} · {formatNum(child.emissions)} t
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-xs text-ink-muted">
                No downstream suppliers recorded for this node.
              </p>
            )}

            {drillParent ? (
              <button
                type="button"
                className="mt-3 text-xs text-accent underline-offset-2 hover:underline"
                onClick={() => {
                  setSelected(drillParent);
                  setDrillParent(null);
                }}
              >
                Back to {drillParent.name}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageFrame>
  );
}
