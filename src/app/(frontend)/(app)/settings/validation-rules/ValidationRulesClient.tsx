"use client";

import { useCallback, useEffect, useState } from "react";

import {
  EmptyState,
  PageCard,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import {
  CROSS_FIELD_OPERATORS,
  DATAPOINT_RULE_FIELDS,
  RULE_TYPES,
  type ApiRule,
  type ApiRuleCondition,
  type AppRuleType,
  type RuleSeverity,
} from "@/lib/data/validation";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  description: string;
  ruleType: AppRuleType;
  field: string;
  field1: string;
  field2: string;
  operator: string;
  min: string;
  max: string;
  pattern: string;
  whenField: string;
  whenValue: string;
  errorMessage: string;
  severity: RuleSeverity;
  enabled: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  ruleType: "range",
  field: "value",
  field1: "value",
  field2: "quality",
  operator: "equal",
  min: "",
  max: "",
  pattern: "",
  whenField: "",
  whenValue: "",
  errorMessage: "",
  severity: "error",
  enabled: true,
});

function formFromRule(rule: ApiRule): FormState {
  return {
    name: rule.name,
    description: rule.description ?? "",
    ruleType: rule.ruleType,
    field: rule.condition.field ?? "value",
    field1: rule.condition.field1 ?? rule.condition.field ?? "value",
    field2: rule.condition.field2 ?? "quality",
    operator: rule.condition.operator ?? "equal",
    min: rule.condition.min !== undefined ? String(rule.condition.min) : "",
    max: rule.condition.max !== undefined ? String(rule.condition.max) : "",
    pattern: rule.condition.pattern ?? "",
    whenField: rule.condition.whenField ?? "",
    whenValue:
      rule.condition.whenValue === null || rule.condition.whenValue === undefined
        ? ""
        : String(rule.condition.whenValue),
    errorMessage: rule.errorMessage ?? "",
    severity: rule.severity,
    enabled: rule.enabled,
  };
}

function conditionFromForm(form: FormState): ApiRuleCondition {
  switch (form.ruleType) {
    case "range": {
      const condition: ApiRuleCondition = { field: form.field };
      if (form.min.trim() !== "") condition.min = Number(form.min);
      if (form.max.trim() !== "") condition.max = Number(form.max);
      return condition;
    }
    case "required": {
      const condition: ApiRuleCondition = { field: form.field };
      if (form.whenField.trim()) {
        condition.whenField = form.whenField.trim();
        condition.whenValue = form.whenValue.trim() || null;
      }
      return condition;
    }
    case "pattern":
      return { field: form.field, pattern: form.pattern };
    case "cross_field":
      return {
        field1: form.field1,
        field2: form.field2,
        operator: form.operator,
      };
  }
}

function ruleTypeLabel(t: AppRuleType): string {
  switch (t) {
    case "range":
      return "Range";
    case "required":
      return "Required";
    case "pattern":
      return "Pattern";
    case "cross_field":
      return "Cross-field";
  }
}

type ApplyResult = {
  validated: number;
  passed: number;
  failed: number;
  truncated?: boolean;
  totalDatapoints?: number;
};

export function ValidationRulesClient({ canEdit }: { canEdit: boolean }) {
  const [rules, setRules] = useState<ApiRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [applyBusyId, setApplyBusyId] = useState<string | null>(null);
  const [lastApply, setLastApply] = useState<ApplyResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/validation-rules");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not load validation rules");
        setRules([]);
        return;
      }
      const data = (await res.json()) as { rules: ApiRule[] };
      setRules(data.rules);
    } catch {
      setError("Could not load validation rules");
      setRules([]);
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

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
    setStatus(null);
    setLastApply(null);
  }

  function openEdit(rule: ApiRule) {
    setEditingId(rule.id);
    setForm(formFromRule(rule));
    setFormOpen(true);
    setStatus(null);
    setLastApply(null);
  }

  async function saveRule() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setStatus(null);

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      ruleType: form.ruleType,
      condition: conditionFromForm(form),
      errorMessage: form.errorMessage.trim() || undefined,
      severity: form.severity,
      enabled: form.enabled,
    };

    try {
      const res = await fetch(
        editingId
          ? `/api/app/validation-rules/${editingId}`
          : "/api/app/validation-rules",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        rule?: ApiRule;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not save rule");
        return;
      }
      setStatus(editingId ? "Rule updated." : "Rule created.");
      setFormOpen(false);
      setEditingId(null);
      await load();
    } catch {
      setError("Could not save rule");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(rule: ApiRule) {
    if (!canEdit) return;
    setError(null);
    const res = await fetch(`/api/app/validation-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not update rule");
      return;
    }
    setStatus(rule.enabled ? "Rule disabled." : "Rule enabled.");
    await load();
  }

  async function deleteRule(rule: ApiRule) {
    if (!canEdit) return;
    if (!window.confirm(`Delete rule “${rule.name}”? This cannot be undone.`)) return;
    setError(null);
    const res = await fetch(`/api/app/validation-rules/${rule.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not delete rule");
      return;
    }
    setStatus("Rule deleted.");
    if (editingId === rule.id) {
      setFormOpen(false);
      setEditingId(null);
    }
    await load();
  }

  async function applyRule(rule: ApiRule) {
    setApplyBusyId(rule.id);
    setError(null);
    setLastApply(null);
    try {
      const res = await fetch(`/api/app/validation-rules/${rule.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as ApplyResult & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not apply rule");
        return;
      }
      setLastApply({
        validated: data.validated,
        passed: data.passed,
        failed: data.failed,
        truncated: data.truncated,
        totalDatapoints: data.totalDatapoints,
      });
      setStatus(
        `Applied “${rule.name}”: ${data.passed} passed, ${data.failed} failed of ${data.validated} checked.`,
      );
      await load();
    } catch {
      setError("Could not apply rule");
    } finally {
      setApplyBusyId(null);
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-8">
      {status ? <StatusLine tone="ok">{status}</StatusLine> : null}
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {lastApply ? (
        <p className="text-[12px] text-ink-muted">
          Last apply: <span className="font-data text-ink">{lastApply.passed}</span>{" "}
          passed · <span className="font-data text-ink">{lastApply.failed}</span> failed ·{" "}
          <span className="font-data text-ink">{lastApply.validated}</span> checked
          {lastApply.truncated && lastApply.totalDatapoints
            ? ` (of ${lastApply.totalDatapoints} total)`
            : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-muted">
          {rules.length} rule{rules.length === 1 ? "" : "s"} for this organisation. Error
          severity blocks approval; warnings are advisory.
        </p>
        {canEdit ? (
          <Button type="button" size="sm" onClick={openCreate}>
            New rule
          </Button>
        ) : (
          <p className="text-[12px] text-ink-muted">
            View only — ask an admin to edit rules.
          </p>
        )}
      </div>

      {formOpen ? (
        <PageCard title={editingId ? "Edit rule" : "Create rule"}>
          <div className="grid max-w-2xl gap-4 md:grid-cols-2">
            <AppField
              label="Name"
              id="vr-name"
              value={form.name}
              disabled={!canEdit || saving}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <AppSelectNative
              label="Severity"
              id="vr-severity"
              value={form.severity}
              disabled={!canEdit || saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  severity: e.target.value as RuleSeverity,
                }))
              }
            >
              <option value="error">Error (blocks approval)</option>
              <option value="warning">Warning</option>
            </AppSelectNative>
            <div className="md:col-span-2">
              <AppSelectNative
                label="Rule type"
                id="vr-type"
                value={form.ruleType}
                disabled={!canEdit || saving}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    ruleType: e.target.value as AppRuleType,
                  }))
                }
              >
                {RULE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ruleTypeLabel(t)}
                  </option>
                ))}
              </AppSelectNative>
            </div>
            <label className="flex flex-col gap-1 text-xs text-ink-muted md:col-span-2">
              <span className="label-caps">Description</span>
              <textarea
                id="vr-desc"
                rows={2}
                className="w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 text-sm text-ink"
                value={form.description}
                disabled={!canEdit || saving}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <div className="md:col-span-2">
              <AppField
                label="Custom error message"
                id="vr-msg"
                value={form.errorMessage}
                disabled={!canEdit || saving}
                placeholder="Shown when the rule fails"
                onChange={(e) => setForm((f) => ({ ...f, errorMessage: e.target.value }))}
              />
            </div>

            {form.ruleType === "range" ||
            form.ruleType === "required" ||
            form.ruleType === "pattern" ? (
              <AppSelectNative
                label="Field"
                id="vr-field"
                value={form.field}
                disabled={!canEdit || saving}
                onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))}
              >
                {DATAPOINT_RULE_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </AppSelectNative>
            ) : null}

            {form.ruleType === "range" ? (
              <>
                <AppField
                  label="Minimum"
                  id="vr-min"
                  type="number"
                  className="font-data"
                  value={form.min}
                  disabled={!canEdit || saving}
                  onChange={(e) => setForm((f) => ({ ...f, min: e.target.value }))}
                />
                <AppField
                  label="Maximum"
                  id="vr-max"
                  type="number"
                  className="font-data"
                  value={form.max}
                  disabled={!canEdit || saving}
                  onChange={(e) => setForm((f) => ({ ...f, max: e.target.value }))}
                />
              </>
            ) : null}

            {form.ruleType === "required" ? (
              <>
                <AppSelectNative
                  label="Only when field (optional)"
                  id="vr-when-field"
                  value={form.whenField}
                  disabled={!canEdit || saving}
                  onChange={(e) => setForm((f) => ({ ...f, whenField: e.target.value }))}
                >
                  <option value="">Always required</option>
                  {DATAPOINT_RULE_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </AppSelectNative>
                <AppField
                  label="Equals value"
                  id="vr-when-value"
                  value={form.whenValue}
                  disabled={!canEdit || saving || !form.whenField}
                  placeholder="e.g. measured"
                  onChange={(e) => setForm((f) => ({ ...f, whenValue: e.target.value }))}
                />
              </>
            ) : null}

            {form.ruleType === "pattern" ? (
              <div className="md:col-span-2">
                <AppField
                  label="Regex pattern"
                  id="vr-pattern"
                  className="font-data"
                  value={form.pattern}
                  disabled={!canEdit || saving}
                  placeholder="^[a-z0-9_]+$"
                  onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
                />
              </div>
            ) : null}

            {form.ruleType === "cross_field" ? (
              <>
                <AppSelectNative
                  label="Field A"
                  id="vr-f1"
                  value={form.field1}
                  disabled={!canEdit || saving}
                  onChange={(e) => setForm((f) => ({ ...f, field1: e.target.value }))}
                >
                  {DATAPOINT_RULE_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </AppSelectNative>
                <AppSelectNative
                  label="Operator"
                  id="vr-op"
                  value={form.operator}
                  disabled={!canEdit || saving}
                  onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value }))}
                >
                  {CROSS_FIELD_OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </AppSelectNative>
                <AppSelectNative
                  label="Field B"
                  id="vr-f2"
                  value={form.field2}
                  disabled={!canEdit || saving}
                  onChange={(e) => setForm((f) => ({ ...f, field2: e.target.value }))}
                >
                  {DATAPOINT_RULE_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </AppSelectNative>
              </>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-ink md:col-span-2">
              <input
                type="checkbox"
                checked={form.enabled}
                disabled={!canEdit || saving}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Enabled
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                disabled={saving || !form.name.trim()}
                onClick={() => void saveRule()}
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Create rule"}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
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

      {rules.length === 0 && !formOpen ? (
        <EmptyState
          title="No validation rules"
          body="Create range, required, pattern, or cross-field rules. They run before datapoint approval."
          action={
            canEdit ? (
              <Button type="button" size="sm" onClick={openCreate}>
                New rule
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-rule border-t border-rule">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-ink">{rule.name}</span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.08em]",
                      rule.enabled ? "text-signal" : "text-ink-muted",
                    )}
                  >
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.08em]",
                      rule.severity === "error" ? "text-rust" : "text-amber",
                    )}
                  >
                    {rule.severity}
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    {ruleTypeLabel(rule.ruleType)}
                  </span>
                </div>
                {rule.description ? (
                  <p className="mt-1 text-[13px] text-ink-muted">{rule.description}</p>
                ) : null}
                <p className="mt-1 font-data text-[11px] text-ink-muted">
                  Violations recorded: {rule.violationCount}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  disabled={applyBusyId === rule.id}
                  onClick={() => void applyRule(rule)}
                >
                  {applyBusyId === rule.id ? "Applying…" : "Apply to data"}
                </Button>
                {canEdit ? (
                  <>
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      onClick={() => openEdit(rule)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => void toggleEnabled(rule)}
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      onClick={() => void deleteRule(rule)}
                    >
                      Delete
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
