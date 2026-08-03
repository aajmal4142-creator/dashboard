"use client";

import { useEffect, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
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
  total: number | null;
  by_org: PreviewOrg[];
  warnings: string[];
  footer: string;
  period: string;
  quality: "measured" | "partial" | "missing";
  measured_org_count: number;
  missing_org_count: number;
  quality_message: string | null;
  has_subsidiaries: boolean;
  unconsolidated_child_list: Array<{
    organisationId: string;
    organisationName: string;
    reason: string;
  }>;
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

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
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
  const { t } = useI18n();
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
      setStatus(t("orgHierarchy.viewOnlyEdit"));
      setStatusTone("error");
      return;
    }
    const ownershipPercent = Number(ownership);
    if (
      !Number.isFinite(ownershipPercent) ||
      ownershipPercent < 0 ||
      ownershipPercent > 100
    ) {
      setStatus(t("orgHierarchy.ownershipRange"));
      setStatusTone("error");
      return;
    }

    setStatus(t("orgHierarchy.saving"));
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
          setStatus(data.error ?? t("orgHierarchy.errorSave"));
          setStatusTone("error");
          return;
        }
        setStatus(data.note ?? t("orgHierarchy.saved"));
        setStatusTone("ok");
        await refreshTree();
      } catch {
        setStatus(t("orgHierarchy.errorNetworkSave"));
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
          setStatus(data.error ?? t("orgHierarchy.errorPreview"));
          setStatusTone("error");
          return;
        }
        setPreview(data);
      } catch {
        setStatus(t("orgHierarchy.errorNetworkPreview"));
        setStatusTone("error");
      }
    });
  }

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  return (
    <div className="space-y-8">
      {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

      <PageCard title={t("orgHierarchy.thisOrgTitle")}>
        <p className="text-[13px] text-ink-muted">
          {t("orgHierarchy.thisOrgHelp", { name: activeOrgName })}
        </p>

        <div className="mt-5 grid max-w-xl gap-4">
          <AppSelectNative
            label={t("orgHierarchy.parentLabel")}
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            disabled={!canEdit || pending}
          >
            <option value="">{t("orgHierarchy.parentNone")}</option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </AppSelectNative>

          <AppSelectNative
            label={t("orgHierarchy.methodLabel")}
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
            label={t("orgHierarchy.ownershipLabel")}
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
            <p className="text-[12px] text-ink-muted">{t("orgHierarchy.fullHelp")}</p>
          ) : (
            <p className="text-[12px] text-ink-muted">
              {t("orgHierarchy.proportionalHelp", { pct: ownership || "70" })}
            </p>
          )}

          {canEdit ? (
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              {t("orgHierarchy.save")}
            </Button>
          ) : (
            <p className="text-sm text-ink-muted">{t("orgHierarchy.viewOnly")}</p>
          )}
        </div>
      </PageCard>

      <PageCard title={t("orgHierarchy.treeTitle")}>
        {forest.length === 0 ? (
          <EmptyState
            title={t("orgHierarchy.treeEmptyTitle")}
            body={t("orgHierarchy.treeEmptyBody")}
          />
        ) : (
          <TreeBranch nodes={forest} />
        )}
      </PageCard>

      <PageCard title={t("orgHierarchy.previewTitle")}>
        <p className="mb-4 text-[12px] text-ink-muted">{t("orgHierarchy.previewHelp")}</p>
        <div className="mb-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={previewPending}
            onClick={loadPreview}
          >
            {t("orgHierarchy.refreshPreview")}
          </Button>
        </div>
        {!preview ? (
          <p className="text-[13px] text-ink-muted">
            {previewPending
              ? t("orgHierarchy.previewLoading")
              : t("orgHierarchy.previewNone")}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-ink-muted">
              {t("orgHierarchy.previewPeriod")}{" "}
              <span className="font-data text-ink">{preview.period}</span>
              {" · "}
              {t("orgHierarchy.previewTotal")}{" "}
              <span
                className={cn(
                  "font-data",
                  preview.total === null ? "text-amber" : "text-ink",
                )}
              >
                {fmt(preview.total)}
              </span>{" "}
              tCO2e
              {" · "}
              <span
                className={cn(
                  "font-data text-[12px]",
                  preview.quality === "measured"
                    ? "text-ink"
                    : preview.quality === "partial"
                      ? "text-amber"
                      : "text-rust",
                )}
              >
                {preview.quality}
              </span>
            </p>

            {preview.quality_message ? (
              <p className="text-[12px] text-ink-muted">{preview.quality_message}</p>
            ) : null}

            {preview.warnings.length > 0 ? (
              <ul className="space-y-1 border border-amber/40 bg-amber/10 px-3 py-2 text-[12px] text-ink">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}

            {preview.unconsolidated_child_list?.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
                  {t("orgHierarchy.missingEntities")}
                </p>
                <ul className="mt-2 space-y-1 text-[13px]">
                  {preview.unconsolidated_child_list.map((u) => (
                    <li key={u.organisationId} className="border-b border-rule py-1.5">
                      <span className="text-ink">{u.organisationName}</span>
                      <span className="ml-2 text-[12px] text-amber">{u.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-rule text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                    <th className="py-2 pr-3 font-medium">
                      {t("orgHierarchy.colOrganisation")}
                    </th>
                    <th className="py-2 pr-3 font-medium">
                      {t("orgHierarchy.colOwnership")}
                    </th>
                    <th className="py-2 pr-3 font-medium">
                      {t("orgHierarchy.colFactor")}
                    </th>
                    <th className="py-2 font-medium">
                      {t("orgHierarchy.colConsolidated")}
                    </th>
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
                        {!row.hasData ? (
                          <span className="ml-2 text-[11px] text-amber">
                            {t("orgHierarchy.noData")}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 font-data text-ink-muted">
                        {row.depth === 0 ? "—" : `${row.ownershipPercent}%`}
                      </td>
                      <td className="py-2 pr-3 font-data text-ink-muted">
                        {row.pathFactor.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          "py-2 font-data",
                          row.hasData ? "text-ink" : "text-amber",
                        )}
                      >
                        {row.hasData ? fmt(row.consolidated.total) : "—"}
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
