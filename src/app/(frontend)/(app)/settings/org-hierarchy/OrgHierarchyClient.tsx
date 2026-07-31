"use client";

import { useEffect, useState, useTransition } from "react";

import { EmptyState, PageCard, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import {
  CONSOLIDATION_METHOD_LABELS,
  CONSOLIDATION_METHODS,
  type ConsolidationMethod,
  type HierarchyTreeNode,
} from "@/lib/consolidation/consolidate";
import { cn } from "@/lib/utils";

type OrgOption = {
  id: string;
  name: string;
  parentId: string | null;
  consolidationMethod: ConsolidationMethod;
  ownershipPercent: number;
};

type PreviewOrg = {
  organisationId: string;
  organisationName: string;
  depth: number;
  ownershipPercent: number;
  pathFactor: number;
  consolidationMethod: ConsolidationMethod;
  consolidated: { total: number };
  hasData: boolean;
};

type Preview = {
  total: number;
  by_org: PreviewOrg[];
  warnings: string[];
  footer: string;
  period: string;
};

function TreeBranch({ nodes }: { nodes: HierarchyTreeNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <ul className="space-y-2">
      {nodes.map((n) => (
        <li key={n.id}>
          <div
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule pb-2"
            style={{ paddingLeft: `${n.depth * 16}px` }}
          >
            <span className="text-sm text-ink">{n.name}</span>
            {n.depth > 0 ? (
              <span className="font-data text-[12px] text-ink-muted">
                {n.ownershipPercent}% ·{" "}
                {CONSOLIDATION_METHOD_LABELS[n.consolidationMethod]}
              </span>
            ) : (
              <span className="text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                Root
              </span>
            )}
          </div>
          <TreeBranch nodes={n.children} />
        </li>
      ))}
    </ul>
  );
}

export function OrgHierarchyClient({
  activeOrgId,
  activeOrgName,
  canEdit,
  initialForest,
  initialOrgs,
}: {
  activeOrgId: string;
  activeOrgName: string;
  canEdit: boolean;
  initialForest: HierarchyTreeNode[];
  initialOrgs: OrgOption[];
}) {
  const self = initialOrgs.find((o) => o.id === activeOrgId);
  const [parentId, setParentId] = useState(self?.parentId ?? "");
  const [method, setMethod] = useState<ConsolidationMethod>(
    self?.consolidationMethod ?? "full",
  );
  const [ownership, setOwnership] = useState(String(self?.ownershipPercent ?? 100));
  const [forest, setForest] = useState(initialForest);
  const [orgs, setOrgs] = useState(initialOrgs);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "neutral">("neutral");
  const [pending, startTransition] = useTransition();
  const [previewPending, startPreview] = useTransition();

  const parentOptions = orgs.filter((o) => o.id !== activeOrgId);

  async function refreshTree() {
    const res = await fetch("/api/app/organisations/hierarchy");
    if (!res.ok) return;
    const data = (await res.json()) as {
      forest: HierarchyTreeNode[];
      orgs: OrgOption[];
    };
    setForest(data.forest);
    setOrgs(data.orgs);
  }

  function save() {
    if (!canEdit) {
      setStatus("Only owners and admins can edit organisation hierarchy.");
      setStatusTone("error");
      return;
    }
    const ownershipPercent = Number(ownership);
    if (
      !Number.isFinite(ownershipPercent) ||
      ownershipPercent < 0 ||
      ownershipPercent > 100
    ) {
      setStatus("Ownership % must be between 0 and 100.");
      setStatusTone("error");
      return;
    }

    setStatus("Saving hierarchy…");
    setStatusTone("neutral");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/app/organisations/${activeOrgId}/hierarchy`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentOrganisationId: parentId || null,
            consolidationMethod: method,
            ownershipPercent,
          }),
        });
        const data = (await res.json()) as { error?: string; note?: string };
        if (!res.ok) {
          setStatus(data.error ?? "Could not save hierarchy.");
          setStatusTone("error");
          return;
        }
        setStatus(data.note ?? "Hierarchy saved.");
        setStatusTone("ok");
        await refreshTree();
      } catch {
        setStatus("Network error while saving hierarchy.");
        setStatusTone("error");
      }
    });
  }

  function loadPreview() {
    startPreview(async () => {
      try {
        const year = new Date().getFullYear();
        const res = await fetch(`/api/app/reports/consolidated?period=${year}`);
        const data = (await res.json()) as Preview & { error?: string };
        if (!res.ok) {
          setStatus(data.error ?? "Preview failed.");
          setStatusTone("error");
          return;
        }
        setPreview(data);
      } catch {
        setStatus("Network error while loading consolidation preview.");
        setStatusTone("error");
      }
    });
  }

  useEffect(() => {
    loadPreview();
  }, []);

  return (
    <div className="space-y-8">
      {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

      <PageCard title="This organisation">
        <p className="text-[13px] text-ink-muted">
          Set an explicit consolidation parent for{" "}
          <span className="text-ink">{activeOrgName}</span>. Subsidiaries are never
          included unless a parent is set. Consultancy{" "}
          <span className="font-data text-[12px]">parentOrg</span> is separate.
        </p>

        <div className="mt-5 grid max-w-xl gap-4">
          <AppSelectNative
            label="Consolidation parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            disabled={!canEdit || pending}
          >
            <option value="">None (root)</option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </AppSelectNative>

          <AppSelectNative
            label="Consolidation method"
            value={method}
            onChange={(e) => setMethod(e.target.value as ConsolidationMethod)}
            disabled={!canEdit || pending}
          >
            {CONSOLIDATION_METHODS.map((value) => (
              <option key={value} value={value}>
                {CONSOLIDATION_METHOD_LABELS[value]}
              </option>
            ))}
          </AppSelectNative>

          <AppField
            label="Ownership % (parent owns this org)"
            type="number"
            min={0}
            max={100}
            step={1}
            value={ownership}
            onChange={(e) => setOwnership(e.target.value)}
            disabled={!canEdit || pending || method === "full"}
            className="font-data"
          />
          {method === "full" ? (
            <p className="text-[12px] text-ink-muted">
              Full method includes 100% of emissions regardless of ownership %.
            </p>
          ) : (
            <p className="text-[12px] text-ink-muted">
              Example: we own {ownership || "70"}% of this branch — emissions are scaled
              by that share along the hierarchy path.
            </p>
          )}

          {canEdit ? (
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              Save hierarchy
            </Button>
          ) : (
            <p className="text-sm text-ink-muted">View only</p>
          )}
        </div>
      </PageCard>

      <PageCard title="Hierarchy tree">
        {forest.length === 0 ? (
          <EmptyState
            title="No organisations"
            body="Membership-accessible organisations will appear here once loaded."
          />
        ) : (
          <TreeBranch nodes={forest} />
        )}
      </PageCard>

      <PageCard title="Consolidation preview">
        <div className="mb-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={previewPending}
            onClick={loadPreview}
          >
            Refresh preview
          </Button>
        </div>
        {!preview ? (
          <p className="text-[13px] text-ink-muted">
            {previewPending ? "Loading preview…" : "No preview yet."}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-ink-muted">
              Period <span className="font-data text-ink">{preview.period}</span>
              {" · "}
              Consolidated total{" "}
              <span className="font-data text-ink">{preview.total.toFixed(2)}</span> tCO2e
            </p>

            {preview.warnings.length > 0 ? (
              <ul className="space-y-1 border border-amber/40 bg-amber/10 px-3 py-2 text-[12px] text-ink">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-rule text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                    <th className="py-2 pr-3 font-medium">Organisation</th>
                    <th className="py-2 pr-3 font-medium">Ownership</th>
                    <th className="py-2 pr-3 font-medium">Factor</th>
                    <th className="py-2 font-medium">Consolidated</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.by_org.map((row) => (
                    <tr key={row.organisationId} className="border-b border-rule">
                      <td
                        className="py-2 pr-3 text-ink"
                        style={{ paddingLeft: `${row.depth * 12}px` }}
                      >
                        {row.organisationName}
                        {!row.hasData && row.depth > 0 ? (
                          <span className="ml-2 text-[11px] text-amber">no data</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 font-data text-ink-muted">
                        {row.depth === 0 ? "—" : `${row.ownershipPercent}%`}
                      </td>
                      <td className="py-2 pr-3 font-data text-ink-muted">
                        {row.pathFactor.toFixed(2)}
                      </td>
                      <td className="py-2 font-data text-ink">
                        {row.consolidated.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className={cn("border-t border-rule pt-3 text-[12px] text-ink-muted")}>
              {preview.footer}
            </p>
          </div>
        )}
      </PageCard>
    </div>
  );
}
