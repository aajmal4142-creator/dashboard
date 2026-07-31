"use client";

import { ArrowDown, ArrowUp, LayoutDashboard, Plus, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import {
  EmptyState,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import {
  appendWidget,
  isWidgetType,
  moveWidget,
  newWidgetDraft,
  removeWidget,
  WIDGET_TYPES,
  type DashboardLayoutSummary,
  type DashboardWidget,
  type WidgetType,
} from "@/lib/dashboards";
import type { WidgetDataPayload } from "@/lib/dashboards/widgetDataTypes";

type RoleDefaults = {
  name: string;
  widgets: DashboardWidget[];
  role: string;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "forbidden"; message: string }
  | {
      kind: "ready";
      layouts: DashboardLayoutSummary[];
      roleDefaults: RoleDefaults;
    };

const METRIC_OPTIONS = [
  { value: "scope1_total", label: "Scope 1 total" },
  { value: "scope2_total", label: "Scope 2 total" },
  { value: "scope3_total", label: "Scope 3 total" },
  { value: "scope2_intensity", label: "Scope 2 intensity" },
  { value: "emissions_trend", label: "Emissions trend" },
  { value: "emissions_by_scope", label: "Emissions by scope" },
  { value: "top_suppliers", label: "Top suppliers" },
  { value: "recent_datapoints", label: "Recent datapoints" },
  { value: "pending_approvals", label: "Pending approvals" },
  { value: "alerts_today", label: "Alerts today" },
] as const;

function widgetTypeLabel(type: WidgetType): string {
  if (type === "chart") return "Chart";
  if (type === "metric") return "Metric";
  if (type === "table") return "Table";
  return "List";
}

function WidgetPreview({ widget }: { widget: DashboardWidget }) {
  const { t } = useI18n();
  const colSpan =
    widget.size.w >= 12
      ? "col-span-12"
      : widget.size.w >= 6
        ? "col-span-12 sm:col-span-6"
        : "col-span-12 sm:col-span-6 lg:col-span-3";

  const [live, setLive] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; data: WidgetDataPayload }
  >({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      metric: widget.config.metric,
      timeRange: widget.config.timeRange,
    });
    void fetch(`/api/app/dashboards/widget-data?${params}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `Widget data failed (${res.status})`);
        }
        return res.json() as Promise<{ data: WidgetDataPayload }>;
      })
      .then((body) => setLive({ kind: "ready", data: body.data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLive({
          kind: "error",
          message: err instanceof Error ? err.message : "Could not load widget data.",
        });
      });
    return () => controller.abort();
  }, [widget.config.metric, widget.config.timeRange, widget.id]);

  const data = live.kind === "ready" ? live.data : null;
  const chartMax =
    data?.kind === "chart"
      ? Math.max(1, ...data.points.map((p) => Math.abs(p.value)))
      : 1;

  return (
    <article
      className={`rounded-[6px] border border-rule bg-surface-1 p-4 ${colSpan}`}
      style={{ minHeight: `${widget.size.h * 28}px` }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-rule pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {widgetTypeLabel(widget.type)}
          </p>
          <h3 className="mt-1 text-[15px] font-semibold text-ink">{widget.title}</h3>
        </div>
        <span className="font-data text-[11px] text-ink-muted">
          {widget.config.timeRange}
        </span>
      </div>

      {live.kind === "loading" ? (
        <p className="mt-4 text-[13px] text-ink-muted">{t("dashboards.loadingWidget")}</p>
      ) : null}
      {live.kind === "error" ? (
        <p className="mt-4 text-[13px] text-rust">{live.message}</p>
      ) : null}

      {data?.kind === "metric" ? (
        <div className="mt-4">
          <p className="font-data text-[28px] tabular-nums text-ink">
            {data.value == null
              ? "—"
              : new Intl.NumberFormat("en-GB", {
                  maximumFractionDigits: 2,
                }).format(data.value)}
          </p>
          {data.unit || data.label ? (
            <p className="mt-1 text-[11px] text-ink-muted">
              {[data.label, data.unit].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {data?.kind === "chart" ? (
        data.points.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-muted">{t("dashboards.noSeries")}</p>
        ) : (
          <div className="mt-4 flex h-24 items-end gap-1 border-b border-rule pb-1">
            {data.points.map((p, i) => (
              <div
                key={`${p.label}-${i}`}
                className="flex-1 bg-accent-quiet"
                style={{
                  height: `${Math.max(4, (Math.abs(p.value) / chartMax) * 100)}%`,
                }}
                title={`${p.label}: ${p.value}`}
                aria-label={`${p.label} ${p.value}`}
              />
            ))}
          </div>
        )
      ) : null}

      {data?.kind === "table" || data?.kind === "list" ? (
        data.rows.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-muted">{t("dashboards.noRows")}</p>
        ) : data.kind === "table" ? (
          <ul className="mt-3 space-y-2 text-[13px] text-ink-muted">
            {data.rows.map((row, i) => (
              <li
                key={`${row.title}-${i}`}
                className="flex justify-between gap-2 border-b border-rule pb-1"
              >
                <span className="min-w-0 truncate text-ink">
                  {row.title}
                  {row.subtitle ? (
                    <span className="block truncate text-[11px] text-ink-muted">
                      {row.subtitle}
                    </span>
                  ) : null}
                </span>
                {row.value ? (
                  <span className="shrink-0 font-data text-ink">{row.value}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-[13px] text-ink">
            {data.rows.map((row, i) => (
              <li key={`${row.title}-${i}`}>
                {row.title}
                {row.value ? (
                  <span className="ml-2 font-data text-ink-muted">{row.value}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )
      ) : null}

      {!data && live.kind === "ready" ? (
        <p className="mt-4 text-[13px] text-ink-muted">No data.</p>
      ) : null}

      <p className="mt-3 text-[11px] text-ink-muted">
        Metric <span className="font-data text-ink">{widget.config.metric}</span>
      </p>
    </article>
  );
}

export function DashboardsClient() {
  const { t } = useI18n();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[]>([]);
  const [draftName, setDraftName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    tone: "neutral" | "error" | "ok";
    message: string;
  } | null>(null);
  const [addType, setAddType] = useState<WidgetType>("metric");
  const [addMetric, setAddMetric] = useState<string>("scope1_total");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/app/dashboards");
      if (res.status === 403) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setState({
          kind: "forbidden",
          message: data.error ?? t("dashboards.forbiddenBody"),
        });
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setState({
          kind: "error",
          message: data.error ?? t("dashboards.errorLoad"),
        });
        return;
      }
      const data = (await res.json()) as {
        layouts: DashboardLayoutSummary[];
        roleDefaults: RoleDefaults;
      };
      setState({
        kind: "ready",
        layouts: data.layouts,
        roleDefaults: data.roleDefaults,
      });
      const preferred = data.layouts.find((l) => l.isDefault) ?? data.layouts[0] ?? null;
      setActiveId(preferred?.id ?? null);
      setDraftWidgets(preferred?.widgets ?? []);
      setDraftName(preferred?.name ?? "");
      setEditing(false);
    } catch {
      setState({
        kind: "error",
        message: t("dashboards.connectionError"),
      });
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const active =
    state.kind === "ready"
      ? (state.layouts.find((l) => l.id === activeId) ?? null)
      : null;

  function selectLayout(layout: DashboardLayoutSummary) {
    setActiveId(layout.id);
    setDraftWidgets(layout.widgets);
    setDraftName(layout.name);
    setEditing(false);
    setStatus(null);
  }

  async function createFromRoleDefault() {
    if (state.kind !== "ready") return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/app/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromRoleDefault: true, isDefault: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        layout?: DashboardLayoutSummary;
      };
      if (!res.ok || !data.layout) {
        setStatus({
          tone: "error",
          message: data.error ?? "Could not create layout.",
        });
        return;
      }
      await load();
      setActiveId(data.layout.id);
      setDraftWidgets(data.layout.widgets);
      setDraftName(data.layout.name);
      setStatus({ tone: "ok", message: "Layout created from role default." });
    } finally {
      setBusy(false);
    }
  }

  async function createBlank() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/app/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Custom layout",
          widgets: [],
          isDefault: false,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        layout?: DashboardLayoutSummary;
      };
      if (!res.ok || !data.layout) {
        setStatus({
          tone: "error",
          message: data.error ?? "Could not create layout.",
        });
        return;
      }
      await load();
      setActiveId(data.layout.id);
      setDraftWidgets([]);
      setDraftName(data.layout.name);
      setEditing(true);
      setStatus({ tone: "ok", message: "Blank layout created." });
    } finally {
      setBusy(false);
    }
  }

  async function saveLayout() {
    if (!activeId) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/app/dashboards/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName, widgets: draftWidgets }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        layout?: DashboardLayoutSummary;
      };
      if (!res.ok || !data.layout) {
        setStatus({
          tone: "error",
          message: data.error ?? "Could not save layout.",
        });
        return;
      }
      await load();
      setActiveId(data.layout.id);
      setDraftWidgets(data.layout.widgets);
      setDraftName(data.layout.name);
      setEditing(false);
      setStatus({ tone: "ok", message: "Layout saved." });
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(id: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/app/dashboards/${id}/default`, {
        method: "PATCH",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus({
          tone: "error",
          message: data.error ?? "Could not set default.",
        });
        return;
      }
      await load();
      setActiveId(id);
      setStatus({ tone: "ok", message: "Default layout updated." });
    } finally {
      setBusy(false);
    }
  }

  async function deleteLayout(id: string) {
    if (!window.confirm("Delete this dashboard layout?")) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/app/dashboards/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus({
          tone: "error",
          message: data.error ?? "Could not delete layout.",
        });
        return;
      }
      await load();
      setStatus({ tone: "ok", message: "Layout deleted." });
    } finally {
      setBusy(false);
    }
  }

  function addWidget() {
    const label = METRIC_OPTIONS.find((m) => m.value === addMetric)?.label ?? addMetric;
    const draft = newWidgetDraft(addType, label, addMetric);
    setDraftWidgets((prev) => appendWidget(prev, draft));
    setEditing(true);
  }

  return (
    <PageFrame
      eyebrow={t("dashboards.eyebrow")}
      title={t("dashboards.title")}
      help={t("dashboards.help")}
      actions={
        state.kind === "ready" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void createBlank()}
            >
              <Plus className="size-3.5" />
              New blank
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void createFromRoleDefault()}
            >
              <LayoutDashboard className="size-3.5" />
              From role default
            </Button>
          </div>
        ) : null
      }
    >
      {state.kind === "loading" ? <PageSkeleton rows={6} /> : null}

      {state.kind === "forbidden" ? (
        <EmptyState title={t("dashboards.forbiddenTitle")} body={state.message} />
      ) : null}

      {state.kind === "error" ? (
        <EmptyState
          title={t("dashboards.loadErrorTitle")}
          body={state.message}
          action={
            <Button type="button" onClick={() => void load()}>
              {t("dashboards.retry")}
            </Button>
          }
        />
      ) : null}

      {state.kind === "ready" && state.layouts.length === 0 ? (
        <EmptyState
          title={t("dashboards.emptyTitle")}
          body={t("dashboards.emptyHelp", {
            role: state.roleDefaults.role,
            name: state.roleDefaults.name,
            count: state.roleDefaults.widgets.length,
          })}
          action={
            <Button
              type="button"
              disabled={busy}
              onClick={() => void createFromRoleDefault()}
            >
              Create {state.roleDefaults.name}
            </Button>
          }
        />
      ) : null}

      {state.kind === "ready" && state.layouts.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="space-y-3 lg:col-span-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Saved layouts
            </p>
            <ul className="divide-y divide-rule border border-rule bg-surface-1">
              {state.layouts.map((layout) => {
                const selected = layout.id === activeId;
                return (
                  <li key={layout.id}>
                    <button
                      type="button"
                      className={`flex w-full items-start justify-between gap-2 px-3 py-3 text-left text-[13px] transition-colors hover:bg-surface-2 ${
                        selected ? "bg-surface-2" : ""
                      }`}
                      onClick={() => selectLayout(layout)}
                    >
                      <span>
                        <span className="block font-semibold text-ink">
                          {layout.name}
                        </span>
                        <span className="mt-0.5 block font-data text-[11px] text-ink-muted">
                          {layout.widgets.length} widgets
                        </span>
                      </span>
                      {layout.isDefault ? (
                        <Star
                          className="mt-0.5 size-3.5 shrink-0 text-accent"
                          aria-label="Default"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-[12px] text-ink-muted">
              Role default seed:{" "}
              <span className="text-ink">{state.roleDefaults.name}</span> (
              {state.roleDefaults.role})
            </p>
          </aside>

          <section className="min-w-0 space-y-4 lg:col-span-9">
            {active ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                          Layout name
                        </span>
                        <input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="mt-1 w-full max-w-md border border-rule bg-surface-1 px-3 py-2 text-[14px] text-ink outline-none focus:border-rule-strong"
                        />
                      </label>
                    ) : (
                      <h2 className="text-[20px] font-semibold text-ink">
                        {active.name}
                        {active.isDefault ? (
                          <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
                            Default
                          </span>
                        ) : null}
                      </h2>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!active.isDefault ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void setDefault(active.id)}
                      >
                        <Star className="size-3.5" />
                        Set default
                      </Button>
                    ) : null}
                    {editing ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setDraftWidgets(active.widgets);
                            setDraftName(active.name);
                            setEditing(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => void saveLayout()}
                        >
                          Save layout
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => setEditing(true)}
                      >
                        Customise
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void deleteLayout(active.id)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>

                {editing ? (
                  <div className="flex flex-wrap items-end gap-3 rounded-[6px] border border-dashed border-rule bg-surface-1 p-3">
                    <label className="text-[12px] text-ink-muted">
                      Type
                      <select
                        value={addType}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isWidgetType(v)) setAddType(v);
                        }}
                        className="mt-1 block border border-rule bg-canvas px-2 py-1.5 text-[13px] text-ink"
                      >
                        {WIDGET_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {widgetTypeLabel(t)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[12px] text-ink-muted">
                      Metric
                      <select
                        value={addMetric}
                        onChange={(e) => setAddMetric(e.target.value)}
                        className="mt-1 block border border-rule bg-canvas px-2 py-1.5 text-[13px] text-ink"
                      >
                        {METRIC_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="button" size="sm" onClick={addWidget}>
                      <Plus className="size-3.5" />
                      Add widget
                    </Button>
                  </div>
                ) : null}

                {draftWidgets.length === 0 ? (
                  <EmptyState
                    title="No widgets"
                    body="Add a chart, metric, table, or list widget, then save the layout."
                  />
                ) : (
                  <div className="space-y-3">
                    {editing ? (
                      draftWidgets.map((widget, index) => (
                        <div
                          key={widget.id}
                          className="flex flex-wrap items-stretch gap-2"
                        >
                          <div className="flex flex-col gap-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon-xs"
                              aria-label="Move up"
                              disabled={index === 0}
                              onClick={() =>
                                setDraftWidgets((prev) =>
                                  moveWidget(prev, widget.id, "up"),
                                )
                              }
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon-xs"
                              aria-label="Move down"
                              disabled={index === draftWidgets.length - 1}
                              onClick={() =>
                                setDraftWidgets((prev) =>
                                  moveWidget(prev, widget.id, "down"),
                                )
                              }
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Remove widget"
                              onClick={() =>
                                setDraftWidgets((prev) => removeWidget(prev, widget.id))
                              }
                            >
                              <Trash2 className="text-rust" />
                            </Button>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="grid grid-cols-12 gap-3">
                              <WidgetPreview
                                key={`${widget.id}:${widget.config.metric}:${widget.config.timeRange}`}
                                widget={widget}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="grid grid-cols-12 gap-3">
                        {draftWidgets.map((widget) => (
                          <WidgetPreview
                            key={`${widget.id}:${widget.config.metric}:${widget.config.timeRange}`}
                            widget={widget}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                title="Select a layout"
                body="Choose a saved layout from the list, or create one from your role default."
              />
            )}
          </section>
        </div>
      ) : null}

      {status ? <StatusLine tone={status.tone}>{status.message}</StatusLine> : null}
    </PageFrame>
  );
}
