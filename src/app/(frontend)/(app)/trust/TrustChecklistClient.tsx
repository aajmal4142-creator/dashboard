"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { EmptyState, PageSkeleton, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import type {
  ChecklistItemState,
  ChecklistProgress,
  TrustChecklistControl,
  TrustControlStatus,
} from "@/lib/trust";
import type { TrustChecklistSnapshot } from "@/lib/trust/loadChecklist";

type ChecklistPayload = TrustChecklistSnapshot & {
  canEdit: boolean;
};

const STATUS_OPTIONS: TrustControlStatus[] = [
  "not_started",
  "in_progress",
  "implemented",
  "not_applicable",
];

function statusLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  status: TrustControlStatus,
): string {
  return t(`trust.checklist.statuses.${status}`);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function TrustChecklistClient(props: {
  initial: ChecklistPayload | null;
  initialError?: string | null;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<ChecklistPayload | null>(props.initial);
  const [loadError, setLoadError] = useState<string | null>(props.initialError ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null,
  );

  async function retry() {
    setRefreshing(true);
    setLoadError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/app/trust/checklist");
      const json = (await res.json()) as ChecklistPayload & { error?: string };
      if (!res.ok) {
        setLoadError(json.error || t("trust.checklist.error"));
        setData(null);
        return;
      }
      setData({
        controls: json.controls,
        items: json.items,
        progress: json.progress,
        eventCount: json.eventCount,
        canEdit: json.canEdit,
      });
    } catch {
      setLoadError(t("trust.checklist.error"));
      setData(null);
    } finally {
      setRefreshing(false);
    }
  }

  function statusFor(controlId: string): TrustControlStatus {
    return data?.items.find((i) => i.controlId === controlId)?.status ?? "not_started";
  }

  function updateStatus(controlId: string, status: TrustControlStatus) {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/app/trust/checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ controlId, status }),
        });
        const json = (await res.json()) as {
          items?: ChecklistItemState[];
          progress?: ChecklistProgress;
          error?: string;
        };
        if (!res.ok) {
          setMessage({
            tone: "error",
            text: json.error || t("trust.checklist.saveError"),
          });
          return;
        }
        setData((prev) =>
          prev && json.items && json.progress
            ? {
                ...prev,
                items: json.items,
                progress: json.progress,
                eventCount: prev.eventCount + 1,
              }
            : prev,
        );
        setMessage({ tone: "ok", text: t("trust.checklist.saved") });
      } catch {
        setMessage({ tone: "error", text: t("trust.checklist.saveError") });
      }
    });
  }

  if (refreshing) {
    return (
      <div aria-busy="true" aria-label={t("trust.checklist.loading")}>
        <PageSkeleton rows={5} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <EmptyState
          title={t("trust.checklist.errorTitle")}
          body={loadError}
          action={
            <Button type="button" variant="outline" onClick={() => void retry()}>
              {t("trust.checklist.retry")}
            </Button>
          }
        />
      </div>
    );
  }

  if (!data || data.controls.length === 0) {
    return (
      <EmptyState
        title={t("trust.checklist.emptyTitle")}
        body={t("trust.checklist.emptyBody")}
      />
    );
  }

  const { progress } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t("trust.checklist.progressLabel")}
          </p>
          <p className="mt-1 font-data text-2xl text-ink tabular-nums">
            {formatPercent(progress.percentComplete)}
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {t("trust.checklist.progressDetail", {
              implemented: String(progress.implemented),
              applicable: String(progress.total - progress.notApplicable),
            })}
          </p>
        </div>
        <p className="font-data text-[12px] text-ink-muted tabular-nums">
          {t("trust.checklist.eventCount", { count: String(data.eventCount) })}
        </p>
      </div>

      {!data.canEdit ? (
        <p className="text-[13px] text-ink-muted">{t("trust.checklist.readOnly")}</p>
      ) : null}

      <ul className="divide-y divide-rule border-t border-rule">
        {data.controls.map((control: TrustChecklistControl) => {
          const status = statusFor(control.id);
          return (
            <li
              key={control.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 max-w-[66ch]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {control.category}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-ink">{control.title}</p>
                <p className="mt-1 text-[13px] text-ink-muted">{control.description}</p>
              </div>
              <div className="shrink-0">
                {data.canEdit ? (
                  <label className="block text-[11px] text-ink-muted">
                    <span className="sr-only">{control.title}</span>
                    <select
                      className="mt-1 min-w-[10rem] rounded-[4px] border border-rule bg-surface-1 px-2 py-1.5 text-[13px] text-ink focus-visible:outline-accent"
                      value={status}
                      disabled={pending}
                      onChange={(e) =>
                        updateStatus(control.id, e.target.value as TrustControlStatus)
                      }
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {statusLabel(t, opt)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="inline-block rounded-[2px] border border-rule px-2 py-1 text-[12px] text-ink">
                    {statusLabel(t, status)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {message ? (
        <StatusLine tone={message.tone === "ok" ? "ok" : "error"}>
          {message.text}
        </StatusLine>
      ) : null}
    </div>
  );
}
