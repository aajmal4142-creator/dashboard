"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { ApprovalChip } from "@/components/governance/ApprovalChip";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  EmptyState,
  PageCard,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppSelectNative } from "@/components/ui/AppField";
import type {
  ApprovalAction,
  ApprovalHistoryEntry,
  ApprovalStep,
  ChainStatus,
} from "@/lib/approvals/types";
import { APPROVAL_STEPS } from "@/lib/approvals/types";
import { cn } from "@/lib/utils";

type InboxItem = {
  entityType: "datapoint" | "report";
  id: string;
  title: string;
  subtitle: string | null;
  step: ApprovalStep;
  status: ChainStatus;
  approvalState: string | null;
  assigneeRole: string | null;
  assigneeUserId: string | null;
  updatedAt: string | null;
  value: number | null;
  unit: string | null;
};

type Detail = {
  entityType: "datapoint" | "report";
  id: string;
  title: string;
  value?: number | null;
  unit?: string | null;
  version?: number;
  reportStatus?: string;
  step: ApprovalStep;
  status: ChainStatus;
  approvalState: string | null;
  approvalReason: string | null;
  assigneeRole: string | null;
  assigneeUserId: string | null;
  history: ApprovalHistoryEntry[];
  actions: {
    canAdvance: boolean;
    canReject: boolean;
    canReturn: boolean;
    publishToLock?: boolean;
  };
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; items: InboxItem[] };

const STEP_LABEL: Record<ApprovalStep, string> = {
  prepare: "Prepare",
  review: "Review",
  approve: "Approve",
  lock: "Lock",
};

function StepTrack({ step, status }: { step: ApprovalStep; status: ChainStatus }) {
  const currentIdx = APPROVAL_STEPS.indexOf(step);
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Approval steps">
      {APPROVAL_STEPS.map((s, i) => {
        const done = status === "locked" || (status === "in_progress" && i < currentIdx);
        const current = status !== "locked" && i === currentIdx;
        return (
          <li key={s} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="h-px w-3 bg-[var(--rule)]" />}
            <span
              className={cn(
                "rounded-[2px] border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                done &&
                  "border-[var(--signal)] bg-[var(--signal)]/10 text-[var(--signal)]",
                current &&
                  status === "rejected" &&
                  "border-[var(--rust)] bg-[var(--rust)]/10 text-[var(--rust)]",
                current &&
                  status !== "rejected" &&
                  "border-[var(--accent)] bg-[var(--accent-quiet)] text-[var(--accent)]",
                !done && !current && "border-[var(--rule)] text-[var(--ink-muted)]",
              )}
            >
              {STEP_LABEL[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ApprovalsClient({ canAct }: { canAct: boolean }) {
  const { t } = useI18n();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [entityFilter, setEntityFilter] = useState("");
  const [stepFilter, setStepFilter] = useState("");
  const [selected, setSelected] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState<{
    tone: "ok" | "error" | "neutral";
    text: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const params = new URLSearchParams();
      if (entityFilter) params.set("entityType", entityFilter);
      if (stepFilter) params.set("step", stepFilter);
      const res = await fetch(`/api/app/approvals?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        items?: InboxItem[];
      };
      if (!res.ok) {
        setLoad({
          kind: "error",
          message: data.error ?? t("approvals.errorLoad"),
        });
        return;
      }
      setLoad({ kind: "ok", items: data.items ?? [] });
    } catch {
      setLoad({ kind: "error", message: t("approvals.errorLoad") });
    }
  }, [entityFilter, stepFilter, t]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  async function openDetail(item: InboxItem) {
    setDetailLoading(true);
    setDetailError(null);
    setNote("");
    setSelected(null);
    try {
      const res = await fetch(`/api/app/approvals/${item.entityType}/${item.id}`);
      const data = (await res.json().catch(() => ({}))) as Detail & {
        error?: string;
      };
      if (!res.ok) {
        setDetailError(data.error ?? t("approvals.errorDetail"));
        return;
      }
      setSelected(data);
    } catch {
      setDetailError(t("approvals.errorDetail"));
    } finally {
      setDetailLoading(false);
    }
  }

  async function runAction(action: ApprovalAction) {
    if (!selected || !canAct || busy) return;
    if (action === "reject" && !note.trim()) {
      setStatusLine({
        tone: "error",
        text: t("approvals.reasonRequired"),
      });
      return;
    }
    setBusy(true);
    setStatusLine({ tone: "neutral", text: t("approvals.working") });
    try {
      const res = await fetch(
        `/api/app/approvals/${selected.entityType}/${selected.id}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: note.trim() || undefined,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        step?: ApprovalStep;
        status?: ChainStatus;
        approvalState?: string;
      };
      if (!res.ok) {
        setStatusLine({
          tone: "error",
          text: data.error ?? t("approvals.actionFailed"),
        });
        return;
      }
      setStatusLine({
        tone: "ok",
        text: t("approvals.actionOk", {
          action,
          step: data.step ?? "",
        }),
      });
      setNote("");
      await refresh();
      if (data.status === "locked") {
        setSelected(null);
      } else {
        await openDetail({
          entityType: selected.entityType,
          id: selected.id,
          title: selected.title,
          subtitle: null,
          step: data.step ?? selected.step,
          status: data.status ?? selected.status,
          approvalState: data.approvalState ?? null,
          assigneeRole: null,
          assigneeUserId: null,
          updatedAt: null,
          value: selected.value ?? null,
          unit: selected.unit ?? null,
        });
      }
    } catch {
      setStatusLine({ tone: "error", text: t("approvals.actionFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <AppSelectNative
            label={t("approvals.filterEntity")}
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="min-w-[140px]"
          >
            <option value="">{t("approvals.allEntities")}</option>
            <option value="datapoint">{t("approvals.datapoints")}</option>
            <option value="report">{t("approvals.reports")}</option>
          </AppSelectNative>
          <AppSelectNative
            label={t("approvals.filterStep")}
            value={stepFilter}
            onChange={(e) => setStepFilter(e.target.value)}
            className="min-w-[140px]"
          >
            <option value="">{t("approvals.allSteps")}</option>
            {APPROVAL_STEPS.filter((s) => s !== "lock").map((s) => (
              <option key={s} value={s}>
                {STEP_LABEL[s]}
              </option>
            ))}
          </AppSelectNative>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={load.kind === "loading"}
            onClick={() => void refresh()}
          >
            {t("approvals.refresh")}
          </Button>
        </div>

        {!canAct && <StatusLine tone="neutral">{t("approvals.viewOnly")}</StatusLine>}
        {statusLine && <StatusLine tone={statusLine.tone}>{statusLine.text}</StatusLine>}

        {load.kind === "loading" && <PageSkeleton rows={6} />}
        {load.kind === "error" && (
          <EmptyState
            title={t("approvals.errorLoad")}
            body={load.message}
            action={
              <Button type="button" size="sm" onClick={() => void refresh()}>
                {t("approvals.retry")}
              </Button>
            }
          />
        )}
        {load.kind === "ok" && load.items.length === 0 && (
          <EmptyState title={t("approvals.emptyTitle")} body={t("approvals.emptyHelp")} />
        )}
        {load.kind === "ok" && load.items.length > 0 && (
          <PageCard>
            <ul className="divide-y divide-[var(--rule)]">
              {load.items.map((item) => {
                const active =
                  selected?.id === item.id && selected.entityType === item.entityType;
                return (
                  <li key={`${item.entityType}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => void openDetail(item)}
                      className={cn(
                        "flex w-full flex-col gap-2 px-3 py-3 text-left transition-colors hover:bg-[var(--surface-2)]",
                        active && "bg-[var(--surface-2)]",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm text-ink">
                            {item.title}
                          </p>
                          <p className="font-mono text-[11px] text-ink-muted">
                            {item.entityType}
                            {item.subtitle ? ` · ${item.subtitle}` : ""}
                            {typeof item.value === "number"
                              ? ` · ${item.value}${item.unit ? ` ${item.unit}` : ""}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.entityType === "datapoint" && (
                            <ApprovalChip
                              state={item.approvalState}
                              step={item.step}
                              chainStatus={item.status}
                            />
                          )}
                          {item.entityType === "report" && (
                            <ApprovalChip step={item.step} chainStatus={item.status} />
                          )}
                        </div>
                      </div>
                      <StepTrack step={item.step} status={item.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </PageCard>
        )}
      </div>

      <aside className="space-y-3">
        <PageCard>
          <h2 className="font-display text-base text-ink">
            {t("approvals.detailTitle")}
          </h2>
          {detailLoading && (
            <p className="mt-3 text-sm text-ink-muted">{t("approvals.loadingDetail")}</p>
          )}
          {detailError && <StatusLine tone="error">{detailError}</StatusLine>}
          {!detailLoading && !selected && !detailError && (
            <p className="mt-3 text-sm text-ink-muted">{t("approvals.detailEmpty")}</p>
          )}
          {selected && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-display text-sm text-ink">{selected.title}</p>
                <p className="font-mono text-[11px] text-ink-muted">
                  {selected.entityType} · {selected.id}
                  {typeof selected.value === "number"
                    ? ` · ${selected.value}${selected.unit ? ` ${selected.unit}` : ""}`
                    : ""}
                </p>
              </div>
              <StepTrack step={selected.step} status={selected.status} />
              <ApprovalChip
                state={selected.approvalState}
                step={selected.step}
                chainStatus={selected.status}
              />

              {selected.history.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                    {t("approvals.history")}
                  </p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto border-t border-[var(--rule)] pt-2">
                    {selected.history
                      .slice()
                      .reverse()
                      .map((h, i) => (
                        <li
                          key={`${h.at}-${i}`}
                          className="text-[12px] text-[var(--ink)]"
                        >
                          <span className="font-mono text-[10px] uppercase text-[var(--ink-muted)]">
                            {h.action}
                          </span>{" "}
                          {STEP_LABEL[h.fromStep]} → {STEP_LABEL[h.toStep]}
                          {h.note ? (
                            <span className="block text-[var(--ink-muted)]">
                              {h.note}
                            </span>
                          ) : null}
                          <span className="block font-mono text-[10px] text-[var(--ink-muted)]">
                            {h.at}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {canAct && selected.status !== "locked" && (
                <div className="space-y-2 border-t border-[var(--rule)] pt-3">
                  <label className="flex flex-col gap-1 text-xs text-[var(--ink-muted)]">
                    <span className="label-caps">{t("approvals.note")}</span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      className="w-full rounded-[4px] border border-[var(--rule)] bg-[var(--canvas)] px-2 py-1.5 text-sm text-[var(--ink)]"
                      placeholder={t("approvals.notePlaceholder")}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selected.actions.canAdvance && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void runAction("advance")}
                      >
                        {t("approvals.advance")}
                      </Button>
                    )}
                    {selected.actions.canReturn && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void runAction("return")}
                      >
                        {t("approvals.return")}
                      </Button>
                    )}
                    {selected.actions.canReject && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void runAction("reject")}
                      >
                        {t("approvals.reject")}
                      </Button>
                    )}
                    {selected.actions.publishToLock && (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href="/reports">{t("approvals.goPublish")}</Link>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {selected.entityType === "datapoint" && (
                <Button type="button" size="sm" variant="ghost" asChild>
                  <Link href={`/data?datapoint=${encodeURIComponent(selected.id)}`}>
                    {t("approvals.openDatapoint")}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </PageCard>
      </aside>
    </div>
  );
}
