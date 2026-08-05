"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { Check, Eye, Pencil, Plus, Trash2 } from "lucide-react";

import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RestatementReason =
  | "acquisition"
  | "divestiture"
  | "merger"
  | "methodology_change"
  | "boundary_change"
  | "outsourcing_insourcing"
  | "other";

type RestatementStatus = "draft" | "final";
type InventoryQuality = "measured" | "missing";

type InventorySnapshot = {
  scope1: number | null;
  scope2: number | null;
  scope3: number | null;
  quality: InventoryQuality;
  source?: string | null;
  capturedAt?: string | null;
};

type ScopeDelta = {
  prior: number | null;
  restated: number | null;
  absolute: number | null;
  relative: number | null;
};

type Comparison = {
  scope1: ScopeDelta;
  scope2: ScopeDelta;
  scope3: ScopeDelta;
  total: ScopeDelta;
  quality: InventoryQuality;
  message: string | null;
};

type Restatement = {
  id: string;
  title: string;
  reason: RestatementReason;
  reasonDetail: string;
  methodologyNote: string;
  status: RestatementStatus;
  effectivePeriodId: string;
  effectivePeriodLabel: string | null;
  baseYearPeriodId: string;
  baseYearPeriodLabel: string | null;
  priorInventory: InventorySnapshot;
  restatedInventory: InventorySnapshot;
  disclosureNote: string | null;
  auditNarrative: string | null;
  comparison: Comparison | null;
  finalizedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PeriodOption = { id: string; label: string; status: string | null };

type AppliedBaseYearInventory = {
  inventory: InventorySnapshot;
  source: "restatement" | "snapshot";
  restatementId: string | null;
  appliedAt: string | null;
};

type FormState = {
  title: string;
  reason: RestatementReason;
  reasonDetail: string;
  methodologyNote: string;
  effectivePeriodId: string;
  baseYearPeriodId: string;
  priorScope1: string;
  priorScope2: string;
  priorScope3: string;
  restatedScope1: string;
  restatedScope2: string;
  restatedScope3: string;
};

const REASON_LABELS: Record<RestatementReason, string> = {
  acquisition: "Acquisition",
  divestiture: "Divestiture",
  merger: "Merger",
  methodology_change: "Methodology change",
  boundary_change: "Boundary change",
  outsourcing_insourcing: "Outsourcing / insourcing",
  other: "Other",
};

const REASONS = Object.keys(REASON_LABELS) as RestatementReason[];

function emptyForm(periodId: string): FormState {
  return {
    title: "",
    reason: "boundary_change",
    reasonDetail: "",
    methodologyNote: "",
    effectivePeriodId: periodId,
    baseYearPeriodId: periodId,
    priorScope1: "",
    priorScope2: "",
    priorScope3: "",
    restatedScope1: "",
    restatedScope2: "",
    restatedScope3: "",
  };
}

function scopeToInput(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return String(n);
}

function parseScopeInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatNum(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatPct(relative: number | null): string {
  if (relative === null || !Number.isFinite(relative)) return "—";
  return `${(relative * 100).toLocaleString(undefined, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  })}%`;
}

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", className)}>
      {children}
    </span>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-[color:var(--ink-muted)]"
    >
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-3 py-2 text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--rule-strong)]";

const monoInputClass = `${inputClass} font-[family-name:var(--font-mono)] tabular-nums`;

function inventoryPayload(scope1: string, scope2: string, scope3: string) {
  return {
    scope1: parseScopeInput(scope1),
    scope2: parseScopeInput(scope2),
    scope3: parseScopeInput(scope3),
    source: "manual",
  };
}

function AsOfStat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border-t border-[color:var(--rule)] pt-2">
      <div className="text-[11px] uppercase tracking-wide text-[color:var(--ink-muted)]">
        {label}
      </div>
      <div className="mt-1 text-lg text-[color:var(--ink)]">
        {mono ? <Mono>{value}</Mono> : value}
      </div>
    </div>
  );
}

function ComparisonTable({ comparison }: { comparison: Comparison }) {
  const rows: Array<{ label: string; delta: ScopeDelta }> = [
    { label: "Scope 1", delta: comparison.scope1 },
    { label: "Scope 2", delta: comparison.scope2 },
    { label: "Scope 3", delta: comparison.scope3 },
    { label: "Total", delta: comparison.total },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[color:var(--rule)] text-[12px] uppercase tracking-wide text-[color:var(--ink-muted)]">
            <th className="py-2 pr-3 font-medium">Scope</th>
            <th className="py-2 pr-3 font-medium">Prior</th>
            <th className="py-2 pr-3 font-medium">Restated</th>
            <th className="py-2 pr-3 font-medium">Δ absolute</th>
            <th className="py-2 font-medium">Δ relative</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-[color:var(--rule)]">
              <td className="py-2 pr-3 text-[color:var(--ink)]">{row.label}</td>
              <td className="py-2 pr-3">
                <Mono>{formatNum(row.delta.prior)}</Mono>
              </td>
              <td className="py-2 pr-3">
                <Mono>{formatNum(row.delta.restated)}</Mono>
              </td>
              <td className="py-2 pr-3">
                <Mono>{formatNum(row.delta.absolute)}</Mono>
              </td>
              <td className="py-2">
                <Mono>{formatPct(row.delta.relative)}</Mono>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {comparison.message ? (
        <p className="mt-2 text-[13px] text-[color:var(--amber)]">{comparison.message}</p>
      ) : null}
      <p className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
        Quality:{" "}
        <span
          className={
            comparison.quality === "measured"
              ? "text-[color:var(--signal)]"
              : "text-[color:var(--rust)]"
          }
        >
          {comparison.quality}
        </span>
        {" · "}
        values in tCO₂e
      </p>
    </div>
  );
}

export function RestatementsClient({ orgName }: { orgName: string }) {
  const [restatements, setRestatements] = useState<Restatement[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(""));
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [asOfPeriodId, setAsOfPeriodId] = useState("");
  const [asOfResult, setAsOfResult] = useState<AppliedBaseYearInventory | null>(null);
  const [asOfError, setAsOfError] = useState<string | null>(null);
  const [asOfLoading, setAsOfLoading] = useState(false);

  const selected = restatements.find((r) => r.id === selectedId) ?? null;

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/compliance/ghg/restatements");
        const json = (await res.json()) as {
          restatements?: Restatement[];
          periods?: PeriodOption[];
          error?: string;
        };
        if (!res.ok) {
          setError(json.error ?? "Could not load restatements");
          return;
        }
        setRestatements(json.restatements ?? []);
        setPeriods(json.periods ?? []);
      } catch {
        setError("Network error loading restatements. Retry.");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!asOfPeriodId && periods.length > 0) {
      const id = window.setTimeout(() => setAsOfPeriodId(periods[0]!.id), 0);
      return () => window.clearTimeout(id);
    }
  }, [periods, asOfPeriodId]);

  function loadAsOf(periodId: string) {
    if (!periodId) return;
    startTransition(async () => {
      setAsOfError(null);
      setAsOfLoading(true);
      try {
        const res = await fetch(
          `/api/app/compliance/ghg/restatements/as-of?baseYearPeriodId=${encodeURIComponent(periodId)}`,
        );
        const json = (await res.json()) as {
          applied?: AppliedBaseYearInventory;
          error?: string;
        };
        if (!res.ok || !json.applied) {
          setAsOfError(json.error ?? "Could not load as-of base year");
          setAsOfResult(null);
          return;
        }
        setAsOfResult(json.applied);
      } catch {
        setAsOfError("Network error loading as-of base year. Retry.");
        setAsOfResult(null);
      } finally {
        setAsOfLoading(false);
      }
    });
  }

  useEffect(() => {
    if (asOfPeriodId) loadAsOf(asOfPeriodId);
  }, [asOfPeriodId]);

  function openCreate() {
    const defaultPeriod = periods[0]?.id ?? "";
    setEditingId(null);
    setForm(emptyForm(defaultPeriod));
    setFormError(null);
    setActionMsg(null);
    setFormOpen(true);
  }

  function openEdit(r: Restatement) {
    if (r.status === "final") {
      setSelectedId(r.id);
      setFormOpen(false);
      return;
    }
    setEditingId(r.id);
    setSelectedId(r.id);
    setForm({
      title: r.title,
      reason: r.reason,
      reasonDetail: r.reasonDetail,
      methodologyNote: r.methodologyNote,
      effectivePeriodId: r.effectivePeriodId,
      baseYearPeriodId: r.baseYearPeriodId,
      priorScope1: scopeToInput(r.priorInventory.scope1),
      priorScope2: scopeToInput(r.priorInventory.scope2),
      priorScope3: scopeToInput(r.priorInventory.scope3),
      restatedScope1: scopeToInput(r.restatedInventory.scope1),
      restatedScope2: scopeToInput(r.restatedInventory.scope2),
      restatedScope3: scopeToInput(r.restatedInventory.scope3),
    });
    setFormError(null);
    setActionMsg(null);
    setFormOpen(true);
  }

  function submitForm() {
    setFormError(null);
    startTransition(async () => {
      try {
        const payload = {
          title: form.title.trim(),
          reason: form.reason,
          reasonDetail: form.reasonDetail.trim(),
          methodologyNote: form.methodologyNote.trim(),
          effectivePeriodId: form.effectivePeriodId,
          baseYearPeriodId: form.baseYearPeriodId,
          priorInventory: inventoryPayload(
            form.priorScope1,
            form.priorScope2,
            form.priorScope3,
          ),
          restatedInventory: inventoryPayload(
            form.restatedScope1,
            form.restatedScope2,
            form.restatedScope3,
          ),
        };

        const url = editingId
          ? `/api/app/compliance/ghg/restatements/${editingId}`
          : "/api/app/compliance/ghg/restatements";
        const res = await fetch(url, {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as {
          restatement?: Restatement;
          error?: string;
        };
        if (!res.ok) {
          setFormError(json.error ?? "Could not save restatement");
          return;
        }
        setFormOpen(false);
        setActionMsg(editingId ? "Draft updated." : "Draft created.");
        if (json.restatement) setSelectedId(json.restatement.id);
        load();
      } catch {
        setFormError("Network error saving restatement. Retry.");
      }
    });
  }

  function finalize(id: string) {
    setActionMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/app/compliance/ghg/restatements/${id}/finalize`, {
          method: "POST",
        });
        const json = (await res.json()) as {
          restatement?: Restatement;
          error?: string;
        };
        if (!res.ok) {
          setError(json.error ?? "Could not finalise restatement");
          return;
        }
        setFormOpen(false);
        setActionMsg("Restatement finalised. Disclosure note is ready.");
        if (json.restatement) setSelectedId(json.restatement.id);
        load();
      } catch {
        setError("Network error finalising restatement. Retry.");
      }
    });
  }

  function remove(id: string) {
    setActionMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/app/compliance/ghg/restatements/${id}`, {
          method: "DELETE",
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not delete draft");
          return;
        }
        if (selectedId === id) setSelectedId(null);
        setActionMsg("Draft deleted.");
        load();
      } catch {
        setError("Network error deleting draft. Retry.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--ink-muted)]">
          Organisation: <span className="text-[color:var(--ink)]">{orgName}</span>
        </p>
        <Button type="button" size="sm" onClick={openCreate} disabled={pending}>
          <Plus className="mr-1.5 size-4" aria-hidden />
          New draft
        </Button>
      </div>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {actionMsg ? <StatusLine tone="ok">{actionMsg}</StatusLine> : null}
      {pending && !restatements.length && !error ? (
        <StatusLine>Loading restatements…</StatusLine>
      ) : null}

      <section className="space-y-3 border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4 rounded-[6px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
              As-of base year
            </h2>
            <p className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
              The figures currently applied for this base-year period — the latest final
              restatement when one exists, otherwise the published snapshot.
            </p>
          </div>
          <div>
            <FieldLabel htmlFor="rst-asof-period">Base-year period</FieldLabel>
            <select
              id="rst-asof-period"
              className={inputClass}
              value={asOfPeriodId}
              onChange={(e) => setAsOfPeriodId(e.target.value)}
            >
              <option value="">Select period</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {asOfError ? <StatusLine tone="error">{asOfError}</StatusLine> : null}
        {asOfLoading && !asOfResult ? <StatusLine>Loading…</StatusLine> : null}

        {asOfResult ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AsOfStat label="Scope 1" value={formatNum(asOfResult.inventory.scope1)} />
            <AsOfStat label="Scope 2" value={formatNum(asOfResult.inventory.scope2)} />
            <AsOfStat label="Scope 3" value={formatNum(asOfResult.inventory.scope3)} />
            <AsOfStat
              label="Source"
              value={
                asOfResult.source === "restatement" ? "Final restatement" : "Snapshot"
              }
              mono={false}
            />
          </div>
        ) : null}
        {asOfResult ? (
          <p className="text-[12px] text-[color:var(--ink-muted)]">
            Quality:{" "}
            <span
              className={
                asOfResult.inventory.quality === "measured"
                  ? "text-[color:var(--signal)]"
                  : "text-[color:var(--rust)]"
              }
            >
              {asOfResult.inventory.quality}
            </span>
            {asOfResult.appliedAt ? (
              <>
                {" · "}applied <Mono>{asOfResult.appliedAt}</Mono>
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      {formOpen ? (
        <section className="space-y-4 border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4 rounded-[6px]">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
            {editingId ? "Edit draft" : "Create draft"}
          </h2>
          {formError ? <StatusLine tone="error">{formError}</StatusLine> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel htmlFor="rst-title">Title</FieldLabel>
              <input
                id="rst-title"
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel htmlFor="rst-reason">Reason</FieldLabel>
              <select
                id="rst-reason"
                className={inputClass}
                value={form.reason}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    reason: e.target.value as RestatementReason,
                  }))
                }
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="rst-effective">Effective period</FieldLabel>
              <select
                id="rst-effective"
                className={inputClass}
                value={form.effectivePeriodId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effectivePeriodId: e.target.value }))
                }
              >
                <option value="">Select period</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="rst-base">Base-year period</FieldLabel>
              <select
                id="rst-base"
                className={inputClass}
                value={form.baseYearPeriodId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, baseYearPeriodId: e.target.value }))
                }
              >
                <option value="">Select period</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <FieldLabel htmlFor="rst-detail">Reason detail</FieldLabel>
              <textarea
                id="rst-detail"
                rows={3}
                className={inputClass}
                value={form.reasonDetail}
                onChange={(e) => setForm((f) => ({ ...f, reasonDetail: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel htmlFor="rst-method">Methodology note</FieldLabel>
              <textarea
                id="rst-method"
                rows={3}
                className={inputClass}
                value={form.methodologyNote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, methodologyNote: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 border-t border-[color:var(--rule)] pt-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[13px] font-medium text-[color:var(--ink)]">
                Prior inventory (tCO₂e)
              </p>
              <p className="mb-3 text-[12px] text-[color:var(--ink-muted)]">
                Leave blank when unknown. On create, empty fields are filled from a
                published report when available.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["priorScope1", "S1", form.priorScope1],
                    ["priorScope2", "S2", form.priorScope2],
                    ["priorScope3", "S3", form.priorScope3],
                  ] as const
                ).map(([key, label, value]) => (
                  <div key={key}>
                    <FieldLabel htmlFor={`rst-${key}`}>{label}</FieldLabel>
                    <input
                      id={`rst-${key}`}
                      className={monoInputClass}
                      inputMode="decimal"
                      value={value}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-[color:var(--ink)]">
                Restated inventory (tCO₂e)
              </p>
              <p className="mb-3 text-[12px] text-[color:var(--ink-muted)]">
                Enter recalculated base-year totals after the structural change.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["restatedScope1", "S1", form.restatedScope1],
                    ["restatedScope2", "S2", form.restatedScope2],
                    ["restatedScope3", "S3", form.restatedScope3],
                  ] as const
                ).map(([key, label, value]) => (
                  <div key={key}>
                    <FieldLabel htmlFor={`rst-${key}`}>{label}</FieldLabel>
                    <input
                      id={`rst-${key}`}
                      className={monoInputClass}
                      inputMode="decimal"
                      value={value}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={submitForm} disabled={pending}>
              {editingId ? "Save draft" : "Create draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      {!pending && !error && restatements.length === 0 ? (
        <EmptyState
          title="No restatements yet"
          body="Create a draft when an acquisition, divestiture, merger, boundary change, or methodology change requires recalculating the base year."
          action={
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 size-4" aria-hidden />
              New draft
            </Button>
          }
        />
      ) : null}

      {restatements.length > 0 ? (
        <section className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--rule)] text-[12px] uppercase tracking-wide text-[color:var(--ink-muted)]">
                <th className="py-2 pr-3 font-medium">Title</th>
                <th className="py-2 pr-3 font-medium">Reason</th>
                <th className="py-2 pr-3 font-medium">Base year</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {restatements.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b border-[color:var(--rule)]",
                    selectedId === r.id && "bg-[color:var(--surface-2)]",
                  )}
                >
                  <td className="py-2.5 pr-3 text-[color:var(--ink)]">{r.title}</td>
                  <td className="py-2.5 pr-3 text-[color:var(--ink-muted)]">
                    {REASON_LABELS[r.reason]}
                  </td>
                  <td className="py-2.5 pr-3 text-[color:var(--ink-muted)]">
                    {r.baseYearPeriodLabel ?? r.baseYearPeriodId}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={
                        r.status === "final"
                          ? "text-[color:var(--signal)]"
                          : "text-[color:var(--amber)]"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedId(r.id)}
                        aria-label={`View ${r.title}`}
                      >
                        <Eye className="size-4" />
                      </Button>
                      {r.status === "draft" ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(r)}
                            aria-label={`Edit ${r.title}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => finalize(r.id)}
                            disabled={pending}
                            aria-label={`Finalise ${r.title}`}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(r.id)}
                            disabled={pending}
                            aria-label={`Delete ${r.title}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {selected ? (
        <section className="space-y-4 border-t border-[color:var(--rule)] pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
                {selected.title}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
                {REASON_LABELS[selected.reason]} · base year{" "}
                {selected.baseYearPeriodLabel ?? selected.baseYearPeriodId} · effective{" "}
                {selected.effectivePeriodLabel ?? selected.effectivePeriodId}
              </p>
            </div>
            {selected.status === "draft" ? (
              <Button
                type="button"
                size="sm"
                onClick={() => finalize(selected.id)}
                disabled={pending}
              >
                <Check className="mr-1.5 size-4" aria-hidden />
                Finalise
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[13px] font-medium text-[color:var(--ink)]">
                Reason detail
              </h3>
              <p className="whitespace-pre-wrap text-sm text-[color:var(--ink-muted)]">
                {selected.reasonDetail}
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-[13px] font-medium text-[color:var(--ink)]">
                Methodology
              </h3>
              <p className="whitespace-pre-wrap text-sm text-[color:var(--ink-muted)]">
                {selected.methodologyNote}
              </p>
            </div>
          </div>

          {selected.comparison ? (
            <div>
              <h3 className="mb-2 text-[13px] font-medium text-[color:var(--ink)]">
                Inventory comparison
              </h3>
              <ComparisonTable comparison={selected.comparison} />
            </div>
          ) : null}

          {selected.auditNarrative ? (
            <div>
              <h3 className="mb-1 text-[13px] font-medium text-[color:var(--ink)]">
                Audit narrative
              </h3>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-3 font-[family-name:var(--font-mono)] text-[12px] text-[color:var(--ink-muted)]">
                {selected.auditNarrative}
              </pre>
            </div>
          ) : null}

          {selected.disclosureNote ? (
            <div>
              <h3 className="mb-1 text-[13px] font-medium text-[color:var(--ink)]">
                Disclosure note
              </h3>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-3 font-[family-name:var(--font-mono)] text-[12px] text-[color:var(--ink)]">
                {selected.disclosureNote}
              </pre>
              {selected.finalizedAt ? (
                <p className="mt-2 text-[12px] text-[color:var(--ink-muted)]">
                  Finalised <Mono>{selected.finalizedAt}</Mono>
                </p>
              ) : null}
            </div>
          ) : selected.status === "draft" ? (
            <StatusLine>
              Disclosure note is generated when you finalise this draft.
            </StatusLine>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
