"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Plus, Power, Trash2 } from "lucide-react";

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
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_OPERATORS,
  AUTOMATION_TRIGGER_TYPES,
  type AutomationAction,
  type AutomationActionType,
  type AutomationCondition,
  type AutomationOperator,
  type AutomationRunSummary,
  type AutomationSummary,
  type AutomationTriggerType,
} from "@/lib/automations";
import { cn } from "@/lib/utils";

type Summary = {
  enabled: number;
  disabled: number;
  total: number;
};

type ConditionForm = {
  field: string;
  operator: AutomationOperator;
  value: string;
};

type ActionForm = {
  type: AutomationActionType;
  title: string;
  message: string;
  emailTo: string;
  webhookUrl: string;
};

type FormState = {
  name: string;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  cronExpression: string;
  conditions: ConditionForm[];
  actions: ActionForm[];
};

const FIELD_HINTS = [
  { value: "metricKey", label: "metricKey" },
  { value: "status", label: "status" },
  { value: "value", label: "value" },
  { value: "alertRuleId", label: "alertRuleId" },
  { value: "alertRuleName", label: "alertRuleName" },
] as const;

const emptyAction = (): ActionForm => ({
  type: "create_notification",
  title: "",
  message: "",
  emailTo: "",
  webhookUrl: "",
});

const emptyForm = (): FormState => ({
  name: "",
  enabled: true,
  triggerType: "datapoint_approved",
  cronExpression: "0 9 * * 1",
  conditions: [],
  actions: [emptyAction()],
});

function formFromAutomation(a: AutomationSummary): FormState {
  return {
    name: a.name,
    enabled: a.enabled,
    triggerType: a.triggerType,
    cronExpression: a.cronExpression ?? "0 9 * * 1",
    conditions: a.conditions.map((c) => ({
      field: c.field,
      operator: c.operator,
      value: String(c.value),
    })),
    actions: a.actions.map((act) => ({
      type: act.type,
      title: act.title ?? "",
      message: act.message ?? "",
      emailTo: act.emailTo ?? "",
      webhookUrl: act.webhookUrl ?? "",
    })),
  };
}

function payloadFromForm(form: FormState): {
  name: string;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  cronExpression: string | null;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
} {
  const conditions: AutomationCondition[] = form.conditions
    .filter((c) => c.field.trim())
    .map((c) => {
      const num = Number(c.value);
      const value =
        c.operator === "gt" || c.operator === "lt"
          ? Number.isFinite(num)
            ? num
            : c.value
          : c.value;
      return {
        field: c.field.trim(),
        operator: c.operator,
        value,
      };
    });

  const actions: AutomationAction[] = form.actions.map((a) => {
    const action: AutomationAction = { type: a.type };
    if (a.title.trim()) action.title = a.title.trim();
    if (a.message.trim()) action.message = a.message.trim();
    if (a.emailTo.trim()) action.emailTo = a.emailTo.trim();
    if (a.webhookUrl.trim()) action.webhookUrl = a.webhookUrl.trim();
    return action;
  });

  return {
    name: form.name.trim(),
    enabled: form.enabled,
    triggerType: form.triggerType,
    cronExpression:
      form.triggerType === "schedule" ? form.cronExpression.trim() || "0 9 * * 1" : null,
    conditions,
    actions,
  };
}

function triggerLabel(t: AutomationTriggerType): string {
  switch (t) {
    case "datapoint_approved":
      return "Datapoint approved";
    case "alert_triggered":
      return "Alert triggered";
    case "schedule":
      return "Schedule (stub)";
  }
}

function actionLabel(t: AutomationActionType): string {
  switch (t) {
    case "create_notification":
      return "In-app notification";
    case "send_email":
      return "Email";
    case "post_slack":
      return "Slack";
    case "fire_webhook":
      return "Webhook";
  }
}

function statusTone(status: AutomationSummary["lastRunStatus"]): string {
  switch (status) {
    case "success":
      return "text-[color:var(--signal)]";
    case "partial":
      return "text-[color:var(--amber)]";
    case "failed":
      return "text-[color:var(--rust)]";
    case "skipped":
      return "text-ink-muted";
    default:
      return "text-ink-muted";
  }
}

export function AutomationsClient({
  canEdit,
  canRun,
}: {
  canEdit: boolean;
  canRun: boolean;
}) {
  const { t } = useI18n();
  const [automations, setAutomations] = useState<AutomationSummary[]>([]);
  const [runs, setRuns] = useState<AutomationRunSummary[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, runsRes] = await Promise.all([
        fetch("/api/app/automations"),
        fetch("/api/app/automations/runs?limit=30"),
      ]);
      if (!listRes.ok) {
        const data = (await listRes.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? t("automations.errorLoad"));
        setAutomations([]);
        setSummary(null);
        return;
      }
      const listData = (await listRes.json()) as {
        automations: AutomationSummary[];
        summary: Summary;
      };
      setAutomations(listData.automations ?? []);
      setSummary(listData.summary ?? null);

      if (runsRes.ok) {
        const runsData = (await runsRes.json()) as {
          runs: AutomationRunSummary[];
        };
        setRuns(runsData.runs ?? []);
      } else {
        setRuns([]);
      }
    } catch {
      setError(t("automations.errorLoad"));
      setAutomations([]);
      setRuns([]);
      setSummary(null);
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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
    setStatus(null);
  };

  const openEdit = (a: AutomationSummary) => {
    setEditingId(a.id);
    setForm(formFromAutomation(a));
    setFormOpen(true);
    setStatus(null);
  };

  const save = async () => {
    if (!canEdit) return;
    const payload = payloadFromForm(form);
    if (!payload.name) {
      setError("Name is required.");
      return;
    }
    if (payload.actions.length === 0) {
      setError("At least one action is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const url = editingId
        ? `/api/app/automations/${editingId}`
        : "/api/app/automations";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setFormOpen(false);
      setStatus(editingId ? "Automation updated." : "Automation created.");
      await load();
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (a: AutomationSummary) => {
    if (!canEdit) return;
    setBusyId(a.id);
    setError(null);
    try {
      const res = await fetch(`/api/app/automations/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !a.enabled }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not update");
        return;
      }
      setStatus(a.enabled ? "Automation disabled." : "Automation enabled.");
      await load();
    } catch {
      setError("Could not update");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (a: AutomationSummary) => {
    if (!canEdit) return;
    if (!window.confirm(`Delete automation “${a.name}”?`)) return;
    setBusyId(a.id);
    setError(null);
    try {
      const res = await fetch(`/api/app/automations/${a.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Delete failed");
        return;
      }
      setStatus("Automation deleted.");
      await load();
    } catch {
      setError("Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const testOne = async (a: AutomationSummary) => {
    if (!canEdit) return;
    setBusyId(a.id);
    setError(null);
    try {
      const res = await fetch(`/api/app/automations/${a.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        matched?: number;
        results?: Array<{ matched: boolean; reason: string }>;
      };
      if (!res.ok) {
        setError(data.error ?? "Test failed");
        return;
      }
      const first = data.results?.[0];
      setStatus(
        first
          ? `Test: ${first.matched ? "matched" : "no match"} — ${first.reason}`
          : `Test complete. Matched ${data.matched ?? 0}.`,
      );
    } catch {
      setError("Test failed");
    } finally {
      setBusyId(null);
    }
  };

  const runSchedule = async () => {
    if (!canRun) return;
    setScheduleBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/automations/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        matched?: number;
        evaluated?: number;
      };
      if (!res.ok) {
        setError(data.error ?? "Schedule run failed");
        return;
      }
      setStatus(
        `Schedule stub: evaluated ${data.evaluated ?? 0}, matched ${data.matched ?? 0}.`,
      );
      await load();
    } catch {
      setError("Schedule run failed");
    } finally {
      setScheduleBusy(false);
    }
  };

  const filtered = automations.filter((a) => {
    if (filter === "enabled") return a.enabled;
    if (filter === "disabled") return !a.enabled;
    return true;
  });

  if (loading) {
    return <PageSkeleton rows={4} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
          <span>
            Enabled{" "}
            <span className="font-mono text-ink tabular-nums">
              {summary?.enabled ?? 0}
            </span>
          </span>
          <span>
            Disabled{" "}
            <span className="font-mono text-ink tabular-nums">
              {summary?.disabled ?? 0}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRun ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={scheduleBusy}
              onClick={() => void runSchedule()}
            >
              <Play className="size-3.5" aria-hidden />
              Run schedule stub
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              New automation
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {status ? <StatusLine tone="ok">{status}</StatusLine> : null}

      <div className="flex flex-wrap gap-2 text-sm">
        {(["all", "enabled", "disabled"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={cn(
              "border-b border-transparent px-1 pb-0.5 capitalize text-ink-muted",
              filter === f && "border-[color:var(--accent)] text-ink",
            )}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {formOpen && canEdit ? (
        <PageCard title={editingId ? "Edit automation" : "New automation"}>
          <div className="flex flex-col gap-4">
            <AppField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Notify on Scope 1 approval"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <AppSelectNative
                label="Trigger"
                value={form.triggerType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    triggerType: e.target.value as AutomationTriggerType,
                  }))
                }
              >
                {AUTOMATION_TRIGGER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {triggerLabel(t)}
                  </option>
                ))}
              </AppSelectNative>
              <label className="flex items-end gap-2 pb-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="size-4 accent-[color:var(--accent)]"
                />
                Enabled
              </label>
            </div>

            {form.triggerType === "schedule" ? (
              <AppField
                label="Cron expression (stub — not evaluated yet)"
                value={form.cronExpression}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cronExpression: e.target.value }))
                }
                placeholder="0 9 * * 1"
                className="font-mono"
              />
            ) : null}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Conditions (AND)</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      conditions: [
                        ...f.conditions,
                        { field: "metricKey", operator: "eq", value: "" },
                      ],
                    }))
                  }
                >
                  Add condition
                </Button>
              </div>
              {form.conditions.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No conditions — matches all events of this trigger.
                </p>
              ) : (
                form.conditions.map((c, i) => (
                  <div
                    key={i}
                    className="grid gap-2 border-t border-[color:var(--rule)] pt-3 sm:grid-cols-[1fr_auto_1fr_auto]"
                  >
                    <AppSelectNative
                      label="Field"
                      value={c.field}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.conditions];
                          next[i] = { ...c, field: e.target.value };
                          return { ...f, conditions: next };
                        })
                      }
                    >
                      {FIELD_HINTS.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.label}
                        </option>
                      ))}
                    </AppSelectNative>
                    <AppSelectNative
                      label="Op"
                      value={c.operator}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.conditions];
                          next[i] = {
                            ...c,
                            operator: e.target.value as AutomationOperator,
                          };
                          return { ...f, conditions: next };
                        })
                      }
                    >
                      {AUTOMATION_OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </AppSelectNative>
                    <AppField
                      label="Value"
                      value={c.value}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.conditions];
                          next[i] = { ...c, value: e.target.value };
                          return { ...f, conditions: next };
                        })
                      }
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-end"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          conditions: f.conditions.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Actions</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      actions: [...f.actions, emptyAction()],
                    }))
                  }
                >
                  Add action
                </Button>
              </div>
              {form.actions.map((a, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 border-t border-[color:var(--rule)] pt-3"
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <AppSelectNative
                      label="Action"
                      value={a.type}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.actions];
                          next[i] = {
                            ...a,
                            type: e.target.value as AutomationActionType,
                          };
                          return { ...f, actions: next };
                        })
                      }
                    >
                      {AUTOMATION_ACTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {actionLabel(t)}
                        </option>
                      ))}
                    </AppSelectNative>
                    {form.actions.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-end"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            actions: f.actions.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <AppField
                    label="Title (optional)"
                    value={a.title}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.actions];
                        next[i] = { ...a, title: e.target.value };
                        return { ...f, actions: next };
                      })
                    }
                  />
                  <AppField
                    label="Message (optional)"
                    value={a.message}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.actions];
                        next[i] = { ...a, message: e.target.value };
                        return { ...f, actions: next };
                      })
                    }
                  />
                  {a.type === "send_email" ? (
                    <AppField
                      label="Email to (blank = org members)"
                      value={a.emailTo}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.actions];
                          next[i] = { ...a, emailTo: e.target.value };
                          return { ...f, actions: next };
                        })
                      }
                      placeholder="ops@example.com"
                    />
                  ) : null}
                  {a.type === "fire_webhook" ? (
                    <AppField
                      label="Webhook URL"
                      value={a.webhookUrl}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.actions];
                          next[i] = { ...a, webhookUrl: e.target.value };
                          return { ...f, actions: next };
                        })
                      }
                      placeholder="https://example.com/hooks/clearesg"
                      className="font-mono"
                    />
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : editingId ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </PageCard>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={t("automations.emptyTitle")}
          body={
            canEdit
              ? t("automations.emptyHelp")
              : "No automations for this organisation yet."
          }
          action={
            canEdit ? (
              <Button type="button" size="sm" onClick={openCreate}>
                New automation
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-[color:var(--rule)] border-y border-[color:var(--rule)]">
          {filtered.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <button
                    type="button"
                    className="text-left font-[family-name:var(--font-display)] text-lg text-ink hover:text-[color:var(--accent)]"
                    onClick={() => (canEdit ? openEdit(a) : undefined)}
                    disabled={!canEdit}
                  >
                    {a.name}
                  </button>
                  <span
                    className={cn(
                      "text-xs uppercase tracking-wide",
                      a.enabled ? "text-[color:var(--signal)]" : "text-ink-muted",
                    )}
                  >
                    {a.enabled ? "On" : "Off"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {triggerLabel(a.triggerType)}
                  {a.conditions.length > 0
                    ? ` · ${a.conditions.length} condition(s)`
                    : " · all events"}
                  {" · "}
                  {a.actions.map((act) => actionLabel(act.type)).join(", ")}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Runs <span className="font-mono tabular-nums">{a.runCount}</span>
                  {a.lastRunAt ? (
                    <>
                      {" · last "}
                      <span className="font-mono tabular-nums">
                        {new Date(a.lastRunAt).toLocaleString()}
                      </span>
                      {a.lastRunStatus ? (
                        <span className={cn(" ml-1", statusTone(a.lastRunStatus))}>
                          {a.lastRunStatus}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    " · never run"
                  )}
                </p>
              </div>
              {canEdit ? (
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => void toggleEnabled(a)}
                    aria-label={a.enabled ? "Disable" : "Enable"}
                  >
                    <Power className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => void testOne(a)}
                  >
                    Test
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => openEdit(a)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => void remove(a)}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <PageCard title="Recent runs">
        {runs.length === 0 ? (
          <p className="text-sm text-ink-muted">No runs logged yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--rule)]">
            {runs.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
              >
                <span className="text-ink">
                  {r.automationName ?? r.automationId}
                  <span className="text-ink-muted">
                    {" · "}
                    {triggerLabel(r.triggerType)}
                  </span>
                </span>
                <span className="font-mono text-xs text-ink-muted tabular-nums">
                  <span className={statusTone(r.status)}>{r.status}</span>
                  {" · "}
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PageCard>
    </div>
  );
}
