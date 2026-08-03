"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { EvidencePackDownloadButton } from "@/components/assurance/EvidencePackDownloadButton";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import type { AssuranceLevel } from "@/lib/assurance/types";
import type {
  AssurancePathwayDefinition,
  PathwayCoverage,
} from "@/lib/assurance/pathways";
import { cn } from "@/lib/utils";

type PeriodOption = {
  id: string;
  label: string;
  status: string | null;
};

type EngagementRow = {
  id: string;
  status: string;
  scope: string;
  assuranceLevel: AssuranceLevel;
  provider: { name: string; email: string };
  reportingPeriod: string | { id: string; label?: string };
  pathwayCoverage?: PathwayCoverage;
  requestedAt: string;
};

type PathwayDetail = {
  level: AssuranceLevel;
  pathway: AssurancePathwayDefinition;
  completedIds: string[];
  coverage: PathwayCoverage;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      engagements: EngagementRow[];
      periods: PeriodOption[];
    };

function periodLabel(
  period: EngagementRow["reportingPeriod"],
  periods: PeriodOption[],
): string {
  if (typeof period === "object" && period?.label) return period.label;
  const id = typeof period === "object" ? period.id : period;
  return periods.find((p) => p.id === id)?.label ?? id;
}

export function AssuranceEngagementsClient({
  canWrite,
  eyebrow,
  title,
  help,
}: {
  canWrite: boolean;
  eyebrow: string;
  title: string;
  help: string;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PathwayDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [pending, startTransition] = useTransition();

  const [providerName, setProviderName] = useState("");
  const [providerEmail, setProviderEmail] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [newLevel, setNewLevel] = useState<AssuranceLevel>("limited");
  const [scope, setScope] = useState<"scope1" | "scope2" | "scope3" | "all">("all");

  const loadList = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/app/assurance/engagements");
        const data = (await res.json()) as {
          engagements?: EngagementRow[];
          periods?: PeriodOption[];
          error?: string;
        };
        if (!res.ok) {
          setState({
            kind: "error",
            message: data.error ?? t("assuranceEngagements.errorLoad"),
          });
          return;
        }
        const engagements = data.engagements ?? [];
        const periods = data.periods ?? [];
        setState({ kind: "ok", engagements, periods });
        setPeriodId((prev) => prev || periods[0]?.id || "");
        setSelectedId((prev) => prev || engagements[0]?.id || null);
      } catch {
        setState({ kind: "error", message: t("assuranceEngagements.errorLoad") });
      }
    });
  }, [t]);

  const loadPathway = useCallback(
    (id: string) => {
      startTransition(async () => {
        setDetailError(null);
        try {
          const res = await fetch(`/api/app/assurance/engagements/${id}/pathway`);
          const data = (await res.json()) as PathwayDetail & { error?: string };
          if (!res.ok) {
            setDetail(null);
            setDetailError(data.error ?? t("assuranceEngagements.errorPathway"));
            return;
          }
          setDetail({
            level: data.level,
            pathway: data.pathway,
            completedIds: data.completedIds,
            coverage: data.coverage,
          });
        } catch {
          setDetail(null);
          setDetailError(t("assuranceEngagements.errorPathway"));
        }
      });
    },
    [t],
  );

  useEffect(() => {
    const id = window.setTimeout(() => loadList(), 0);
    return () => window.clearTimeout(id);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      const id = window.setTimeout(() => setDetail(null), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => loadPathway(selectedId), 0);
    return () => window.clearTimeout(id);
  }, [selectedId, loadPathway]);

  function patchPathway(body: Record<string, unknown>) {
    if (!selectedId || !canWrite) return;
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch(`/api/app/assurance/engagements/${selectedId}/pathway`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as PathwayDetail & { error?: string };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? t("assuranceEngagements.errorSave"));
          return;
        }
        setDetail({
          level: data.level,
          pathway: data.pathway,
          completedIds: data.completedIds,
          coverage: data.coverage,
        });
        setTone("ok");
        setMessage(t("assuranceEngagements.saved"));
        loadList();
      } catch {
        setTone("error");
        setMessage(t("assuranceEngagements.errorSave"));
      }
    });
  }

  function createEngagement() {
    if (!canWrite) return;
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/app/assurance/engagements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportingPeriod: periodId,
            assuranceLevel: newLevel,
            scope,
            provider: { name: providerName, email: providerEmail },
          }),
        });
        const data = (await res.json()) as {
          engagement?: EngagementRow;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? t("assuranceEngagements.errorCreate"));
          return;
        }
        setTone("ok");
        setMessage(t("assuranceEngagements.created"));
        setProviderName("");
        setProviderEmail("");
        if (data.engagement?.id) setSelectedId(data.engagement.id);
        loadList();
      } catch {
        setTone("error");
        setMessage(t("assuranceEngagements.errorCreate"));
      }
    });
  }

  const completedSet = new Set(detail?.completedIds ?? []);
  const selected =
    state.kind === "ok"
      ? (state.engagements.find((e) => e.id === selectedId) ?? null)
      : null;
  const selectedPeriodId = selected
    ? typeof selected.reportingPeriod === "string"
      ? selected.reportingPeriod
      : selected.reportingPeriod.id
    : null;

  return (
    <PageFrame
      eyebrow={eyebrow}
      title={title}
      help={help}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/assurance">{t("assuranceEngagements.linkRoom")}</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/assurance-partners">
              {t("assuranceEngagements.linkPartners")}
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {message ? <StatusLine tone={tone}>{message}</StatusLine> : null}
        {!canWrite ? (
          <StatusLine tone="neutral">{t("assuranceEngagements.viewOnly")}</StatusLine>
        ) : null}

        {state.kind === "loading" ? <PageSkeleton /> : null}
        {state.kind === "error" ? (
          <EmptyState
            title={t("assuranceEngagements.errorLoad")}
            body={state.message}
            action={
              <Button type="button" size="sm" onClick={loadList}>
                {t("assuranceEngagements.retry")}
              </Button>
            }
          />
        ) : null}

        {state.kind === "ok" ? (
          <>
            {canWrite ? (
              <PageCard title={t("assuranceEngagements.createTitle")}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="block text-[12px] text-ink-muted">
                    {t("assuranceEngagements.fieldPeriod")}
                    <select
                      value={periodId}
                      onChange={(e) => setPeriodId(e.target.value)}
                      className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
                    >
                      {state.periods.length === 0 ? (
                        <option value="">{t("assuranceEngagements.noPeriods")}</option>
                      ) : (
                        state.periods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="block text-[12px] text-ink-muted">
                    {t("assuranceEngagements.fieldLevel")}
                    <select
                      value={newLevel}
                      onChange={(e) => setNewLevel(e.target.value as AssuranceLevel)}
                      className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
                    >
                      <option value="limited">
                        {t("assuranceEngagements.levelLimited")}
                      </option>
                      <option value="reasonable">
                        {t("assuranceEngagements.levelReasonable")}
                      </option>
                    </select>
                  </label>
                  <label className="block text-[12px] text-ink-muted">
                    {t("assuranceEngagements.fieldScope")}
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value as typeof scope)}
                      className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
                    >
                      <option value="all">All</option>
                      <option value="scope1">Scope 1</option>
                      <option value="scope2">Scope 2</option>
                      <option value="scope3">Scope 3</option>
                    </select>
                  </label>
                  <label className="block text-[12px] text-ink-muted">
                    {t("assuranceEngagements.fieldProvider")}
                    <input
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
                    />
                  </label>
                  <label className="block text-[12px] text-ink-muted">
                    {t("assuranceEngagements.fieldEmail")}
                    <input
                      type="email"
                      value={providerEmail}
                      onChange={(e) => setProviderEmail(e.target.value)}
                      className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
                    />
                  </label>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        pending ||
                        !periodId ||
                        !providerName.trim() ||
                        !providerEmail.trim()
                      }
                      onClick={createEngagement}
                    >
                      {t("assuranceEngagements.createSubmit")}
                    </Button>
                  </div>
                </div>
              </PageCard>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <PageCard title={t("assuranceEngagements.listTitle")}>
                {state.engagements.length === 0 ? (
                  <EmptyState
                    title={t("assuranceEngagements.emptyTitle")}
                    body={t("assuranceEngagements.emptyHelp")}
                  />
                ) : (
                  <ul className="divide-y divide-rule">
                    {state.engagements.map((eng) => {
                      const pct = eng.pathwayCoverage?.percent ?? 0;
                      const active = eng.id === selectedId;
                      return (
                        <li key={eng.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(eng.id)}
                            className={cn(
                              "flex w-full flex-col gap-1 px-1 py-3 text-left transition-colors",
                              active ? "bg-surface-2" : "hover:bg-surface-2/60",
                            )}
                          >
                            <span className="text-[13px] font-medium text-ink">
                              {eng.provider.name}
                            </span>
                            <span className="text-[12px] text-ink-muted">
                              {periodLabel(eng.reportingPeriod, state.periods)} ·{" "}
                              {eng.assuranceLevel === "reasonable"
                                ? t("assuranceEngagements.levelReasonable")
                                : t("assuranceEngagements.levelLimited")}{" "}
                              · {eng.status}
                            </span>
                            <span className="font-data text-[12px] tabular-nums text-ink">
                              {pct}%
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </PageCard>

              <PageCard title={t("assuranceEngagements.pathwayTitle")}>
                {!selectedId ? (
                  <p className="text-[13px] text-ink-muted">
                    {t("assuranceEngagements.selectHelp")}
                  </p>
                ) : detailError ? (
                  <EmptyState
                    title={t("assuranceEngagements.errorPathway")}
                    body={detailError}
                    action={
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => loadPathway(selectedId)}
                      >
                        {t("assuranceEngagements.retry")}
                      </Button>
                    }
                  />
                ) : !detail ? (
                  <PageSkeleton />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
                      <label className="block text-[12px] text-ink-muted">
                        {t("assuranceEngagements.fieldLevel")}
                        <select
                          value={detail.level}
                          disabled={!canWrite || pending}
                          onChange={(e) =>
                            patchPathway({
                              assuranceLevel: e.target.value as AssuranceLevel,
                            })
                          }
                          className="mt-1 block min-w-40 border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong disabled:opacity-60"
                        >
                          <option value="limited">
                            {t("assuranceEngagements.levelLimited")}
                          </option>
                          <option value="reasonable">
                            {t("assuranceEngagements.levelReasonable")}
                          </option>
                        </select>
                      </label>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                          {t("assuranceEngagements.progress")}
                        </p>
                        <p className="font-data text-2xl tabular-nums text-ink">
                          {detail.coverage.percent}%
                        </p>
                        <p className="font-data text-[12px] tabular-nums text-ink-muted">
                          {detail.coverage.completed}/{detail.coverage.total}
                        </p>
                        {selectedPeriodId ? (
                          <div className="mt-2">
                            <EvidencePackDownloadButton
                              periodId={selectedPeriodId}
                              assuranceLevel={detail.level}
                              appearance="link"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className="h-1.5 overflow-hidden rounded-xs bg-surface-2"
                      role="progressbar"
                      aria-valuenow={detail.coverage.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t("assuranceEngagements.progress")}
                    >
                      <div
                        className="h-full bg-accent transition-[width]"
                        style={{ width: `${detail.coverage.percent}%` }}
                      />
                    </div>

                    <p className="text-[13px] text-ink-muted">{detail.pathway.summary}</p>
                    <p className="text-[12px] text-ink-muted">
                      {detail.pathway.depthNotes}
                    </p>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
                        {t("assuranceEngagements.evidenceMatrix")}
                      </p>
                      <p className="mt-1 font-data text-[12px] text-ink-muted">
                        {detail.pathway.requiredEvidenceTypes.join(" · ")}
                      </p>
                    </div>

                    <ul className="space-y-3">
                      {detail.pathway.checkpoints.map((cp) => {
                        const done = completedSet.has(cp.id);
                        return (
                          <li
                            key={cp.id}
                            className="border-t border-rule pt-3 first:border-t-0 first:pt-0"
                          >
                            <label className="flex cursor-pointer gap-3">
                              <input
                                type="checkbox"
                                className="mt-1 size-4 accent-accent"
                                checked={done}
                                disabled={!canWrite || pending}
                                onChange={(e) =>
                                  patchPathway({
                                    mark: {
                                      checkpointId: cp.id,
                                      completed: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-baseline gap-2">
                                  <span className="text-[13px] font-medium text-ink">
                                    {cp.label}
                                  </span>
                                  {!cp.required ? (
                                    <span className="rounded-xs border border-rule px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                                      {t("assuranceEngagements.optional")}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-1 block text-[12px] text-ink-muted">
                                  {cp.depthNote}
                                </span>
                                <span className="mt-1 block font-data text-[11px] text-ink-muted">
                                  {cp.evidenceTypes.join(", ")}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </PageCard>
            </div>
          </>
        ) : null}
      </div>
    </PageFrame>
  );
}
