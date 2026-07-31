"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  EmptyState,
  PageCard,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import {
  CUSTOM_METRIC_CATEGORIES,
  FORMULA_OPERATORS,
  formulaKeys,
  type CustomMetricCategory,
  type CustomMetricSummary,
  type MetricKeyOption,
} from "@/lib/derive";
import { cn } from "@/lib/utils";

type Summary = { enabled: number; disabled: number };

type PeriodOption = { id: string; label: string };

type FormState = {
  label: string;
  description: string;
  unit: string;
  formula: string;
  category: CustomMetricCategory;
  enabled: boolean;
};

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ok";
      value: number;
      values: Record<string, number | null>;
      periodLabel: string | null;
    }
  | {
      status: "error";
      error: string;
      missingKeys: string[];
      values: Record<string, number | null>;
    };

const emptyForm = (): FormState => ({
  label: "",
  description: "",
  unit: "",
  formula: "",
  category: "intensity",
  enabled: true,
});

function formFromMetric(m: CustomMetricSummary): FormState {
  return {
    label: m.label,
    description: m.description,
    unit: m.unit,
    formula: m.formula,
    category: m.category,
    enabled: m.enabled,
  };
}

function categoryLabel(c: CustomMetricCategory): string {
  switch (c) {
    case "intensity":
      return "Intensity";
    case "efficiency":
      return "Efficiency";
    case "ratio":
      return "Ratio";
    case "total":
      return "Total";
    case "other":
      return "Other";
  }
}

export function CustomMetricsClient({ canEdit }: { canEdit: boolean }) {
  const [metrics, setMetrics] = useState<CustomMetricSummary[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [availableKeys, setAvailableKeys] = useState<MetricKeyOption[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [keyFilter, setKeyFilter] = useState("");
  const [sampleMode, setSampleMode] = useState<"sample" | "period">("sample");
  const [periodId, setPeriodId] = useState("");
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });

  const referencedKeys = useMemo(() => formulaKeys(form.formula), [form.formula]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/derived-metrics");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not load custom metrics");
        setMetrics([]);
        setSummary(null);
        return;
      }
      const data = (await res.json()) as {
        metrics: CustomMetricSummary[];
        summary: Summary;
        availableKeys: MetricKeyOption[];
        periods: PeriodOption[];
      };
      setMetrics(data.metrics);
      setSummary(data.summary);
      setAvailableKeys(data.availableKeys ?? []);
      setPeriods(data.periods ?? []);
      setPeriodId((current) => current || data.periods?.[0]?.id || "");
    } catch {
      setError("Could not load custom metrics");
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSampleValues((prev) => {
        const next = { ...prev };
        for (const k of referencedKeys) {
          if (next[k] === undefined) next[k] = "";
        }
        return next;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [referencedKeys]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
    setStatus(null);
    setError(null);
    setPreview({ status: "idle" });
    setSampleValues({});
  }

  function openEdit(metric: CustomMetricSummary) {
    setEditingId(metric.id);
    setForm(formFromMetric(metric));
    setFormOpen(true);
    setStatus(null);
    setError(null);
    setPreview({ status: "idle" });
    const samples: Record<string, string> = {};
    for (const k of metric.inputKeys) samples[k] = "";
    setSampleValues(samples);
  }

  function insertToken(token: string) {
    setForm((f) => ({
      ...f,
      formula: f.formula ? `${f.formula.trimEnd()} ${token}` : token,
    }));
    setPreview({ status: "idle" });
  }

  async function runPreview() {
    if (!form.formula.trim()) {
      setPreview({
        status: "error",
        error: "Enter a formula to preview.",
        missingKeys: [],
        values: {},
      });
      return;
    }

    setPreview({ status: "loading" });
    try {
      const body: {
        formula: string;
        periodId?: string;
        sampleValues?: Record<string, number>;
      } = { formula: form.formula.trim() };

      if (sampleMode === "period" && periodId) {
        body.periodId = periodId;
      } else {
        const sample: Record<string, number> = {};
        for (const k of referencedKeys) {
          const raw = sampleValues[k]?.trim() ?? "";
          if (raw === "") continue;
          const n = Number(raw);
          if (!Number.isFinite(n)) {
            setPreview({
              status: "error",
              error: `Sample value for ${k} must be a number.`,
              missingKeys: [],
              values: {},
            });
            return;
          }
          sample[k] = n;
        }
        body.sampleValues = sample;
      }

      const res = await fetch("/api/app/derived-metrics/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        value?: number;
        error?: string;
        missingKeys?: string[];
        values?: Record<string, number | null>;
        periodLabel?: string | null;
      };

      if (!res.ok) {
        setPreview({
          status: "error",
          error: data.error ?? "Preview failed.",
          missingKeys: [],
          values: {},
        });
        return;
      }

      if (data.ok && typeof data.value === "number") {
        setPreview({
          status: "ok",
          value: data.value,
          values: data.values ?? {},
          periodLabel: data.periodLabel ?? null,
        });
        return;
      }

      setPreview({
        status: "error",
        error: data.error ?? "Could not evaluate formula.",
        missingKeys: data.missingKeys ?? [],
        values: data.values ?? {},
      });
    } catch {
      setPreview({
        status: "error",
        error: "Could not reach preview endpoint.",
        missingKeys: [],
        values: {},
      });
    }
  }

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const url = editingId
        ? `/api/app/derived-metrics/${editingId}`
        : "/api/app/derived-metrics";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label,
          description: form.description,
          unit: form.unit,
          formula: form.formula,
          category: form.category,
          enabled: form.enabled,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save metric");
        return;
      }
      setStatus(editingId ? "Metric updated." : "Metric created.");
      setFormOpen(false);
      setEditingId(null);
      await load();
    } catch {
      setError("Could not save metric");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(metric: CustomMetricSummary) {
    if (!canEdit) return;
    setBusyId(metric.id);
    setError(null);
    try {
      const res = await fetch(`/api/app/derived-metrics/${metric.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !metric.enabled }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not update metric");
        return;
      }
      setStatus(metric.enabled ? "Metric disabled." : "Metric enabled.");
      await load();
    } catch {
      setError("Could not update metric");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(metric: CustomMetricSummary) {
    if (!canEdit) return;
    if (!window.confirm(`Delete custom metric “${metric.label}”?`)) return;
    setBusyId(metric.id);
    setError(null);
    try {
      const res = await fetch(`/api/app/derived-metrics/${metric.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not delete metric");
        return;
      }
      setStatus("Metric deleted.");
      if (editingId === metric.id) {
        setFormOpen(false);
        setEditingId(null);
      }
      await load();
    } catch {
      setError("Could not delete metric");
    } finally {
      setBusyId(null);
    }
  }

  const filteredKeys = useMemo(() => {
    const q = keyFilter.trim().toLowerCase();
    if (!q) return availableKeys.slice(0, 40);
    return availableKeys
      .filter((k) => k.key.toLowerCase().includes(q) || k.label.toLowerCase().includes(q))
      .slice(0, 40);
  }, [availableKeys, keyFilter]);

  if (loading) {
    return <PageSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {status ? <StatusLine tone="ok">{status}</StatusLine> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-ink-muted">
          {summary ? (
            <>
              <span className="font-data text-ink">{summary.enabled}</span> enabled
              <span className="mx-2 text-rule-strong">·</span>
              <span className="font-data text-ink">{summary.disabled}</span> disabled
            </>
          ) : (
            "Custom derived metrics for this organisation"
          )}
        </div>
        {canEdit ? (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-3.5" aria-hidden />
            New metric
          </Button>
        ) : (
          <p className="text-xs text-ink-muted">View only — ask an admin to edit.</p>
        )}
      </div>

      {formOpen ? (
        <PageCard className="space-y-6">
          <div>
            <h2 className="font-display text-lg text-ink">
              {editingId ? "Edit custom metric" : "Define metric"}
            </h2>
            <div className="title-rule mt-2" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AppField
              label="Name"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              disabled={!canEdit || saving}
              required
            />
            <AppField
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              disabled={!canEdit || saving}
              placeholder="kg CO2e / employee"
              required
            />
            <AppSelectNative
              label="Category"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as CustomMetricCategory,
                }))
              }
              disabled={!canEdit || saving}
            >
              {CUSTOM_METRIC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </AppSelectNative>
            <label className="flex items-end gap-2 pb-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                disabled={!canEdit || saving}
                className="size-4"
              />
              Enabled
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            <span className="label-caps">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              disabled={!canEdit || saving}
              rows={2}
              required
              className="w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <div className="space-y-3 border-t border-rule pt-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
              Build formula
            </h3>
            <AppField
              label="Formula"
              value={form.formula}
              onChange={(e) => {
                setForm((f) => ({ ...f, formula: e.target.value }));
                setPreview({ status: "idle" });
              }}
              disabled={!canEdit || saving}
              placeholder="(electricity_kwh) / employees_total"
              className="font-data"
              required
            />

            <div className="flex flex-wrap gap-1.5">
              {FORMULA_OPERATORS.map((op) => (
                <button
                  key={op}
                  type="button"
                  disabled={!canEdit || saving}
                  onClick={() => insertToken(op)}
                  className="min-w-8 rounded-[4px] border border-rule bg-surface-1 px-2 py-1 font-data text-sm text-ink hover:border-rule-strong disabled:opacity-50"
                >
                  {op}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-muted">
                Available metric keys
              </label>
              <input
                type="search"
                value={keyFilter}
                onChange={(e) => setKeyFilter(e.target.value)}
                placeholder="Filter keys…"
                className="mb-2 w-full max-w-sm rounded-[4px] border border-rule bg-surface-1 px-2 py-1.5 text-sm text-ink"
              />
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-[6px] border border-rule bg-surface-2 p-2">
                {filteredKeys.length === 0 ? (
                  <p className="text-xs text-ink-muted">No keys match.</p>
                ) : (
                  filteredKeys.map((k) => (
                    <button
                      key={k.key}
                      type="button"
                      disabled={!canEdit || saving}
                      title={`${k.label}${k.unit ? ` (${k.unit})` : ""}`}
                      onClick={() => insertToken(k.key)}
                      className="rounded-[2px] border border-rule bg-canvas px-2 py-0.5 font-data text-[11px] text-ink hover:border-accent disabled:opacity-50"
                    >
                      {k.key}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-rule pt-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
              Preview
            </h3>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2 text-ink">
                <input
                  type="radio"
                  name="preview-mode"
                  checked={sampleMode === "sample"}
                  onChange={() => setSampleMode("sample")}
                />
                Sample values
              </label>
              <label className="flex items-center gap-2 text-ink">
                <input
                  type="radio"
                  name="preview-mode"
                  checked={sampleMode === "period"}
                  onChange={() => setSampleMode("period")}
                />
                Period data
              </label>
            </div>

            {sampleMode === "period" ? (
              <AppSelectNative
                label="Reporting period"
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                {periods.length === 0 ? (
                  <option value="">No periods available</option>
                ) : (
                  periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))
                )}
              </AppSelectNative>
            ) : referencedKeys.length === 0 ? (
              <p className="text-xs text-ink-muted">
                Add metric keys to the formula to enter sample values.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {referencedKeys.map((k) => (
                  <AppField
                    key={k}
                    label={k}
                    value={sampleValues[k] ?? ""}
                    onChange={(e) =>
                      setSampleValues((s) => ({ ...s, [k]: e.target.value }))
                    }
                    className="font-data"
                    inputMode="decimal"
                  />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void runPreview()}
                disabled={preview.status === "loading"}
              >
                {preview.status === "loading" ? "Calculating…" : "Preview calculation"}
              </Button>
              {preview.status === "ok" ? (
                <p className="text-sm text-ink">
                  Result{" "}
                  <span className="font-data text-signal">
                    {preview.value.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}
                  </span>
                  {form.unit ? (
                    <span className="text-ink-muted"> {form.unit}</span>
                  ) : null}
                  {preview.periodLabel ? (
                    <span className="ml-2 text-xs text-ink-muted">
                      ({preview.periodLabel})
                    </span>
                  ) : null}
                </p>
              ) : null}
              {preview.status === "error" ? (
                <p className="text-sm text-rust">{preview.error}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Save metric"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </PageCard>
      ) : null}

      {metrics.length === 0 && !formOpen ? (
        <EmptyState
          title="No custom metrics yet"
          body={
            canEdit
              ? "Create a derived metric such as electricity per employee using keys from your metrics catalogue."
              : "When an admin defines custom formulas, they will appear here."
          }
          action={
            canEdit ? (
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="size-3.5" aria-hidden />
                New metric
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {metrics.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-start justify-between gap-3 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <button
                    type="button"
                    className="text-left font-display text-base text-ink hover:text-accent"
                    onClick={() => openEdit(m)}
                  >
                    {m.label}
                  </button>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.08em]",
                      m.enabled ? "text-signal" : "text-ink-muted",
                    )}
                  >
                    {m.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                    {categoryLabel(m.category)}
                  </span>
                </div>
                <p className="mt-1 font-data text-xs text-ink-muted">{m.key}</p>
                <p className="mt-1 font-data text-sm text-ink">{m.formula}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {m.unit}
                  {m.inputKeys.length > 0 ? ` · inputs: ${m.inputKeys.join(", ")}` : null}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(m)}
                >
                  {canEdit ? "Edit" : "View"}
                </Button>
                {canEdit ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === m.id}
                      onClick={() => void toggleEnabled(m)}
                    >
                      {m.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === m.id}
                      onClick={() => void remove(m)}
                      aria-label={`Delete ${m.label}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
