"use client";

import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, Play, Plus, Trash2 } from "lucide-react";

import { useI18n } from "@/components/i18n/I18nProvider";
import {
  EmptyState,
  PageCard,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import {
  ALERT_ACTIONS,
  ALERT_CONDITION_TYPES,
  ALERT_OPERATORS,
  type AlertAction,
  type AlertCondition,
  type AlertConditionType,
  type AlertOperator,
  type AlertRuleSummary,
} from "@/lib/alerts";
import { cn } from "@/lib/utils";

type Summary = {
  active: number;
  triggered: number;
  muted: number;
  disabled: number;
};

type FormState = {
  name: string;
  enabled: boolean;
  type: AlertConditionType;
  metric: string;
  operator: AlertOperator;
  value: string;
  consecutivePeriods: string;
  percentChange: string;
  secondaryMetric: string;
  secondaryOperator: AlertOperator;
  secondaryValue: string;
  compareToAverage: boolean;
  secondaryCompareToAverage: boolean;
  actions: AlertAction[];
};

const METRIC_OPTIONS = [
  { value: "scope1_emissions", label: "Scope 1 emissions" },
  { value: "scope2_emissions", label: "Scope 2 emissions" },
  { value: "scope3_emissions", label: "Scope 3 emissions" },
  { value: "energy_mwh", label: "Energy (MWh)" },
  { value: "electricity_kwh", label: "Electricity (kWh)" },
] as const;

const emptyForm = (): FormState => ({
  name: "",
  enabled: true,
  type: "threshold",
  metric: "scope1_emissions",
  operator: "gt",
  value: "1000",
  consecutivePeriods: "2",
  percentChange: "20",
  secondaryMetric: "scope2_emissions",
  secondaryOperator: "gt",
  secondaryValue: "500",
  compareToAverage: false,
  secondaryCompareToAverage: false,
  actions: ["notify_user"],
});

function formFromRule(rule: AlertRuleSummary): FormState {
  const c = rule.condition;
  return {
    name: rule.name,
    enabled: rule.enabled,
    type: c.type,
    metric: c.metric,
    operator: c.operator,
    value: String(c.value),
    consecutivePeriods: String(c.consecutivePeriods ?? 2),
    percentChange: String(c.percentChange ?? c.value),
    secondaryMetric: c.secondaryMetric ?? "scope2_emissions",
    secondaryOperator: c.secondaryOperator ?? c.operator,
    secondaryValue: String(c.secondaryValue ?? c.value),
    compareToAverage: c.compareToAverage === true,
    secondaryCompareToAverage: c.secondaryCompareToAverage === true,
    actions: rule.actions.length ? [...rule.actions] : ["notify_user"],
  };
}

function conditionFromForm(form: FormState): AlertCondition {
  const value = Number(form.value);
  const condition: AlertCondition = {
    type: form.type,
    metric: form.metric,
    operator: form.operator,
    value: Number.isFinite(value) ? value : 0,
  };

  if (form.type === "consecutive") {
    const n = Number(form.consecutivePeriods);
    condition.consecutivePeriods = Number.isInteger(n) && n >= 2 ? n : 2;
  }

  if (form.type === "percent_change") {
    const p = Number(form.percentChange);
    condition.percentChange = Number.isFinite(p) ? p : value;
  }

  if (form.type === "cross_metric") {
    condition.secondaryMetric = form.secondaryMetric;
    condition.secondaryOperator = form.secondaryOperator;
    const sv = Number(form.secondaryValue);
    condition.secondaryValue = Number.isFinite(sv) ? sv : value;
    if (form.compareToAverage) condition.compareToAverage = true;
    if (form.secondaryCompareToAverage) {
      condition.secondaryCompareToAverage = true;
    }
  }

  if (form.type === "threshold" && form.compareToAverage) {
    condition.compareToAverage = true;
  }

  return condition;
}

function conditionTypeLabel(t: AlertConditionType): string {
  switch (t) {
    case "threshold":
      return "Threshold";
    case "consecutive":
      return "Consecutive";
    case "percent_change":
      return "Percent change";
    case "cross_metric":
      return "Cross-metric";
  }
}

function statusLabel(s: AlertRuleSummary["status"]): string {
  switch (s) {
    case "active":
      return "Active";
    case "triggered":
      return "Triggered";
    case "muted":
      return "Muted";
    case "disabled":
      return "Disabled";
  }
}

function statusTone(s: AlertRuleSummary["status"]): string {
  switch (s) {
    case "active":
      return "text-[color:var(--signal)]";
    case "triggered":
      return "text-[color:var(--amber)]";
    case "muted":
      return "text-ink-muted";
    case "disabled":
      return "text-ink-muted";
  }
}

export function AlertsClient({
  canEdit,
  canEvaluate,
}: {
  canEdit: boolean;
  canEvaluate: boolean;
}) {
  const { t } = useI18n();
  const [rules, setRules] = useState<AlertRuleSummary[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [filter, setFilter] = useState<"all" | AlertRuleSummary["status"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/alerts");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? t("alerts.errorLoad"));
        setRules([]);
        setSummary(null);
        return;
      }
      const data = (await res.json()) as {
        rules: AlertRuleSummary[];
        summary: Summary;
      };
      setRules(data.rules);
      setSummary(data.summary);
    } catch {
      setError(t("alerts.errorLoad"));
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
    setStatus(null);
    setError(null);
  }

  function openEdit(rule: AlertRuleSummary) {
    setEditingId(rule.id);
    setForm(formFromRule(rule));
    setFormOpen(true);
    setStatus(null);
    setError(null);
  }

  function toggleAction(action: AlertAction) {
    setForm((f) => {
      const has = f.actions.includes(action);
      if (has) {
        const next = f.actions.filter((a) => a !== action);
        return { ...f, actions: next.length ? next : ["notify_user"] };
      }
      return { ...f, actions: [...f.actions, action] };
    });
  }

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const body = {
        name: form.name.trim(),
        enabled: form.enabled,
        condition: conditionFromForm(form),
        actions: form.actions,
      };
      const res = await fetch(
        editingId ? `/api/app/alerts/${editingId}` : "/api/app/alerts",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save alert rule");
        return;
      }
      setFormOpen(false);
      setEditingId(null);
      setStatus(editingId ? "Alert rule updated." : "Alert rule created.");
      await load();
    } catch {
      setError("Could not save alert rule");
    } finally {
      setSaving(false);
    }
  }

  async function remove(rule: AlertRuleSummary) {
    if (!canEdit) return;
    if (!window.confirm(`Delete alert “${rule.name}”?`)) return;
    setBusyId(rule.id);
    setError(null);
    try {
      const res = await fetch(`/api/app/alerts/${rule.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not delete alert rule");
        return;
      }
      setStatus(`Deleted “${rule.name}”.`);
      await load();
    } catch {
      setError("Could not delete alert rule");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleMute(rule: AlertRuleSummary) {
    if (!canEdit) return;
    setBusyId(rule.id);
    setError(null);
    try {
      const muted = rule.status !== "muted";
      const mutedUntil = muted
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const res = await fetch(`/api/app/alerts/${rule.id}/mute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted, mutedUntil }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not update mute");
        return;
      }
      setStatus(muted ? `Muted “${rule.name}” for 7 days.` : `Unmuted “${rule.name}”.`);
      await load();
    } catch {
      setError("Could not update mute");
    } finally {
      setBusyId(null);
    }
  }

  async function runEvaluate() {
    if (!canEvaluate) return;
    setEvaluating(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/app/alerts/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        evaluated?: number;
        triggered?: number;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not evaluate alerts");
        return;
      }
      setStatus(
        `Evaluated ${data.evaluated ?? 0} rules; ${data.triggered ?? 0} triggered.`,
      );
      await load();
    } catch {
      setError("Could not evaluate alerts");
    } finally {
      setEvaluating(false);
    }
  }

  if (loading) return <PageSkeleton />;

  const visible = filter === "all" ? rules : rules.filter((r) => r.status === filter);

  return (
    <div className="space-y-8">
      {status ? <StatusLine tone="ok">{status}</StatusLine> : null}
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Active", summary?.active ?? 0, "active"],
            ["Triggered", summary?.triggered ?? 0, "triggered"],
            ["Muted", summary?.muted ?? 0, "muted"],
            ["Disabled", summary?.disabled ?? 0, "disabled"],
          ] as const
        ).map(([label, count, key]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(filter === key ? "all" : key)}
            className={cn(
              "rounded-[6px] border border-rule bg-surface-1 px-4 py-3 text-left transition-colors",
              filter === key && "border-rule-strong",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {label}
            </p>
            <p className="mt-1 font-data text-[28px] tabular-nums text-ink">{count}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-muted">
          {rules.length} rule{rules.length === 1 ? "" : "s"} · filter{" "}
          {filter === "all" ? "all" : filter}.
        </p>
        <div className="flex flex-wrap gap-2">
          {canEvaluate ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={evaluating}
              onClick={() => void runEvaluate()}
            >
              <Play className="size-3.5" aria-hidden />
              {evaluating ? "Evaluating…" : "Evaluate now"}
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              New rule
            </Button>
          ) : (
            <p className="text-[12px] text-ink-muted">{t("alerts.viewOnly")}</p>
          )}
        </div>
      </div>

      {formOpen ? (
        <PageCard title={editingId ? "Edit alert rule" : "Create alert rule"}>
          <div className="grid max-w-2xl gap-4 md:grid-cols-2">
            <AppField
              label="Name"
              id="alert-name"
              value={form.name}
              disabled={!canEdit || saving}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <AppSelectNative
              label="Condition type"
              id="alert-type"
              value={form.type}
              disabled={!canEdit || saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as AlertConditionType,
                }))
              }
            >
              {ALERT_CONDITION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {conditionTypeLabel(t)}
                </option>
              ))}
            </AppSelectNative>

            <AppSelectNative
              label="Metric"
              id="alert-metric"
              value={form.metric}
              disabled={!canEdit || saving}
              onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))}
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </AppSelectNative>

            <AppSelectNative
              label="Operator"
              id="alert-op"
              value={form.operator}
              disabled={!canEdit || saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operator: e.target.value as AlertOperator,
                }))
              }
            >
              {ALERT_OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </AppSelectNative>

            {form.type !== "percent_change" || !form.compareToAverage ? (
              <AppField
                label={form.type === "percent_change" ? "Fallback value" : "Value"}
                id="alert-value"
                type="number"
                value={form.value}
                disabled={
                  !canEdit ||
                  saving ||
                  (form.type === "threshold" && form.compareToAverage)
                }
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            ) : null}

            {form.type === "consecutive" ? (
              <AppField
                label="Consecutive periods"
                id="alert-consec"
                type="number"
                value={form.consecutivePeriods}
                disabled={!canEdit || saving}
                onChange={(e) =>
                  setForm((f) => ({ ...f, consecutivePeriods: e.target.value }))
                }
              />
            ) : null}

            {form.type === "percent_change" ? (
              <AppField
                label="Percent change threshold"
                id="alert-pct"
                type="number"
                value={form.percentChange}
                disabled={!canEdit || saving}
                onChange={(e) =>
                  setForm((f) => ({ ...f, percentChange: e.target.value }))
                }
              />
            ) : null}

            {form.type === "threshold" || form.type === "cross_metric" ? (
              <label className="flex items-center gap-2 text-[13px] text-ink md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.compareToAverage}
                  disabled={!canEdit || saving}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      compareToAverage: e.target.checked,
                    }))
                  }
                />
                Compare primary metric to its series average
              </label>
            ) : null}

            {form.type === "cross_metric" ? (
              <>
                <AppSelectNative
                  label="Secondary metric"
                  id="alert-sec-metric"
                  value={form.secondaryMetric}
                  disabled={!canEdit || saving}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, secondaryMetric: e.target.value }))
                  }
                >
                  {METRIC_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </AppSelectNative>
                <AppSelectNative
                  label="Secondary operator"
                  id="alert-sec-op"
                  value={form.secondaryOperator}
                  disabled={!canEdit || saving}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      secondaryOperator: e.target.value as AlertOperator,
                    }))
                  }
                >
                  {ALERT_OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </AppSelectNative>
                <AppField
                  label="Secondary value"
                  id="alert-sec-value"
                  type="number"
                  value={form.secondaryValue}
                  disabled={!canEdit || saving || form.secondaryCompareToAverage}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, secondaryValue: e.target.value }))
                  }
                />
                <label className="flex items-center gap-2 text-[13px] text-ink md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.secondaryCompareToAverage}
                    disabled={!canEdit || saving}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        secondaryCompareToAverage: e.target.checked,
                      }))
                    }
                  />
                  Compare secondary metric to its series average
                </label>
              </>
            ) : null}

            <fieldset className="md:col-span-2">
              <legend className="label-caps text-ink-muted">Actions</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {ALERT_ACTIONS.map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 text-[13px] text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={form.actions.includes(action)}
                      disabled={!canEdit || saving}
                      onChange={() => toggleAction(action)}
                    />
                    {action === "notify_user"
                      ? "Notify"
                      : action === "send_email"
                        ? "Email"
                        : "Slack"}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-2 text-[13px] text-ink md:col-span-2">
              <input
                type="checkbox"
                checked={form.enabled}
                disabled={!canEdit || saving}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Enabled
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!canEdit || saving || !form.name.trim()}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Create rule"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </PageCard>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title={t("alerts.emptyTitle")}
          body={
            filter === "all"
              ? t("alerts.emptyHelp")
              : t("alerts.emptyHelpFiltered", { status: filter })
          }
        />
      ) : (
        <ul className="divide-y divide-rule border-t border-rule">
          {visible.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-display text-[17px] text-ink">{rule.name}</h3>
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-[0.08em]",
                      statusTone(rule.status),
                    )}
                  >
                    {statusLabel(rule.status)}
                  </span>
                </div>
                <p className="text-[13px] text-ink-muted">
                  {conditionTypeLabel(rule.condition.type)} ·{" "}
                  <span className="font-data text-ink">{rule.condition.metric}</span>{" "}
                  {rule.condition.operator}{" "}
                  <span className="font-data text-ink">
                    {rule.condition.compareToAverage
                      ? "avg"
                      : rule.condition.type === "percent_change"
                        ? `${rule.condition.percentChange ?? rule.condition.value}%`
                        : rule.condition.value}
                  </span>
                  {rule.condition.type === "cross_metric" &&
                  rule.condition.secondaryMetric
                    ? ` · ${rule.condition.secondaryMetric}`
                    : null}
                </p>
                <p className="text-[12px] text-ink-muted">
                  Actions: {rule.actions.join(", ")} · triggered{" "}
                  <span className="font-data text-ink">{rule.triggeredCount}</span>
                  {rule.lastTriggeredAt ? (
                    <>
                      {" "}
                      · last{" "}
                      <span className="font-data text-ink">
                        {new Date(rule.lastTriggeredAt).toLocaleString()}
                      </span>
                    </>
                  ) : null}
                </p>
                {rule.lastTriggeredMessage ? (
                  <p className="text-[12px] text-ink">{rule.lastTriggeredMessage}</p>
                ) : null}
              </div>
              {canEdit ? (
                <div className="flex flex-shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === rule.id}
                    onClick={() => openEdit(rule)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === rule.id}
                    onClick={() => void toggleMute(rule)}
                  >
                    {rule.status === "muted" ? (
                      <BellRing className="size-3.5" aria-hidden />
                    ) : (
                      <BellOff className="size-3.5" aria-hidden />
                    )}
                    {rule.status === "muted" ? "Unmute" : "Mute 7d"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === rule.id}
                    onClick={() => void remove(rule)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Delete
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
