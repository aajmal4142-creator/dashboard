"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CreditType = "avoidance" | "removal" | "mixed" | "other";
type CreditStatus = "held" | "retired";

type Credit = {
  id: string;
  label: string | null;
  creditType: CreditType;
  volumeTco2e: number;
  vintageYear: number;
  status: CreditStatus;
  registryName: string;
  serial: string | null;
  periodId: string | null;
  periodLabel: string | null;
  retiredAt: string | null;
  notes: string | null;
};

type PeriodOption = { id: string; label: string; status: string };

type ResidualPosition = {
  grossInventoryTco2e: number | null;
  reductionsTco2e: number | null;
  retiredOffsetsTco2e: number;
  heldOffsetsTco2e: number;
  residualTco2e: number | null;
  quality: "measured" | "missing";
  message: string | null;
  ledger: {
    lineCount: number;
    totalVolumeTco2e: number;
    heldVolumeTco2e: number;
    retiredVolumeTco2e: number;
    quality: "measured" | "missing";
    message: string | null;
  };
};

type SummaryPayload = {
  periodId: string | null;
  periodLabel: string | null;
  credits: Credit[];
  position: ResidualPosition;
  periods: PeriodOption[];
};

type FormState = {
  label: string;
  creditType: CreditType;
  volumeTco2e: string;
  vintageYear: string;
  status: CreditStatus;
  registryName: string;
  serial: string;
  periodId: string;
  retiredAt: string;
  notes: string;
};

const TYPE_LABELS: Record<CreditType, string> = {
  avoidance: "Avoidance",
  removal: "Removal",
  mixed: "Mixed",
  other: "Other",
};

function emptyForm(periodId: string, year: number): FormState {
  return {
    label: "",
    creditType: "avoidance",
    volumeTco2e: "",
    vintageYear: String(year),
    status: "held",
    registryName: "",
    serial: "",
    periodId,
    retiredAt: "",
    notes: "",
  };
}

function formatNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", className)}>
      {children}
    </span>
  );
}

function statusClass(status: CreditStatus): string {
  if (status === "retired") return "text-[color:var(--signal)]";
  return "text-[color:var(--ink-muted)]";
}

export function ResidualClient({ orgName }: { orgName: string }) {
  const [periodId, setPeriodId] = useState("");
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [grossInput, setGrossInput] = useState("");
  const [reductionsInput, setReductionsInput] = useState("");
  const [appliedGross, setAppliedGross] = useState("");
  const [appliedReductions, setAppliedReductions] = useState("");
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm("", new Date().getUTCFullYear()),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const params = new URLSearchParams();
        if (periodId) params.set("periodId", periodId);
        if (appliedGross.trim()) params.set("grossInventoryTco2e", appliedGross.trim());
        if (appliedReductions.trim()) {
          params.set("reductionsTco2e", appliedReductions.trim());
        }
        const qs = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/app/compliance/residual/summary${qs}`);
        const json = (await res.json()) as SummaryPayload & { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not load residual ledger");
          return;
        }
        setSummary(json);
        setPeriods(json.periods ?? []);
        if (!periodId && json.periods?.length === 1) {
          setPeriodId(json.periods[0]!.id);
        }
      } catch {
        setError("Network error loading residual ledger. Retry.");
      }
    });
  }, [periodId, appliedGross, appliedReductions]);

  useEffect(() => {
    load();
  }, [load]);

  function applyResidualInputs() {
    setAppliedGross(grossInput.trim());
    setAppliedReductions(reductionsInput.trim());
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(periodId || periods[0]?.id || "", new Date().getUTCFullYear()));
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(c: Credit) {
    setEditingId(c.id);
    setForm({
      label: c.label ?? "",
      creditType: c.creditType,
      volumeTco2e: String(c.volumeTco2e),
      vintageYear: String(c.vintageYear),
      status: c.status,
      registryName: c.registryName,
      serial: c.serial ?? "",
      periodId: c.periodId ?? "",
      retiredAt: c.retiredAt ? c.retiredAt.slice(0, 10) : "",
      notes: c.notes ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm() {
    setFormError(null);
    const volumeTco2e = Number(form.volumeTco2e);
    const vintageYear = Number(form.vintageYear);
    if (!Number.isFinite(volumeTco2e) || volumeTco2e < 0) {
      setFormError("Volume (tCO₂e) must be a non-negative number.");
      return;
    }
    if (!Number.isInteger(vintageYear) || vintageYear < 1990 || vintageYear > 2100) {
      setFormError("Vintage year must be an integer between 1990 and 2100.");
      return;
    }
    if (!form.registryName.trim()) {
      setFormError("Registry name is required (free-text; no paid sync).");
      return;
    }

    const body = {
      label: form.label.trim() || null,
      creditType: form.creditType,
      volumeTco2e,
      vintageYear,
      status: form.status,
      registryName: form.registryName.trim(),
      serial: form.serial.trim() || null,
      periodId: form.periodId.trim() || null,
      retiredAt: form.retiredAt.trim() || null,
      notes: form.notes.trim() || null,
    };

    const url = editingId
      ? `/api/app/compliance/residual/${editingId}`
      : "/api/app/compliance/residual";
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(json.error ?? "Could not save credit lot");
        return;
      }
      setFormOpen(false);
      load();
    } catch {
      setFormError("Network error saving credit lot. Retry.");
    }
  }

  async function removeCredit(id: string) {
    try {
      const res = await fetch(`/api/app/compliance/residual/${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not delete credit lot");
        return;
      }
      load();
    } catch {
      setError("Network error deleting credit lot. Retry.");
    }
  }

  const position = summary?.position;
  const credits = summary?.credits ?? [];

  return (
    <div className="space-y-8">
      <p className="text-xs text-[color:var(--ink-muted)]">
        Organisation: {orgName}. Ledger is user-entered only — ClearESG does not buy,
        sell, or sync credits from registries.
      </p>

      <section className="space-y-3 border-b border-[color:var(--rule)] pb-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs text-[color:var(--ink-muted)]">
            Reporting period
            <select
              className="min-w-[12rem] rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            >
              <option value="">All periods</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[color:var(--ink-muted)]">
            Gross inventory (tCO₂e)
            <input
              type="number"
              min={0}
              step="any"
              className="w-36 rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
              value={grossInput}
              onChange={(e) => setGrossInput(e.target.value)}
              placeholder="Required"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[color:var(--ink-muted)]">
            Reductions (tCO₂e)
            <input
              type="number"
              min={0}
              step="any"
              className="w-36 rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
              value={reductionsInput}
              onChange={(e) => setReductionsInput(e.target.value)}
              placeholder="Required"
            />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={applyResidualInputs}>
            Compute residual
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-1 size-3.5" aria-hidden />
            Add lot
          </Button>
        </div>
        <p className="text-xs text-[color:var(--ink-muted)]">
          Enter inventory and reductions explicitly. Blank fields stay missing — they are
          never assumed to be zero.
        </p>
      </section>

      {error ? (
        <StatusLine tone="error">{error}</StatusLine>
      ) : pending && !summary ? (
        <StatusLine>Loading residual ledger…</StatusLine>
      ) : null}

      {position ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
            Net position
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat
              label="Gross inventory"
              value={formatNum(position.grossInventoryTco2e)}
              unit="tCO₂e"
            />
            <Stat
              label="Reductions"
              value={formatNum(position.reductionsTco2e)}
              unit="tCO₂e"
            />
            <Stat
              label="Retired offsets"
              value={formatNum(position.retiredOffsetsTco2e)}
              unit="tCO₂e"
            />
            <Stat
              label="Held offsets"
              value={formatNum(position.heldOffsetsTco2e)}
              unit="tCO₂e"
            />
            <Stat
              label="Residual"
              value={formatNum(position.residualTco2e)}
              unit="tCO₂e"
              emphasize
            />
          </div>
          <p className="text-xs text-[color:var(--ink-muted)]">
            Quality:{" "}
            <span
              className={
                position.quality === "missing"
                  ? "text-[color:var(--amber)]"
                  : "text-[color:var(--signal)]"
              }
            >
              {position.quality}
            </span>
            {position.message ? ` — ${position.message}` : null}
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4 border-b border-[color:var(--rule)] pb-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
            Offset lots
          </h2>
          <span className="text-xs text-[color:var(--ink-muted)]">
            <Mono>{credits.length}</Mono> line
            {credits.length === 1 ? "" : "s"}
            {pending ? " · refreshing…" : ""}
          </span>
        </div>

        {credits.length === 0 && !error ? (
          <EmptyState
            title="No offset lots"
            body="Add a held or retired credit lot. Only retired volume reduces residual. This is not a marketplace — enter registry names as free text."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--rule-strong)] text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                  <th className="py-2 pr-3 font-medium">Label</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Volume</th>
                  <th className="py-2 pr-3 font-medium">Vintage</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Registry</th>
                  <th className="py-2 pr-3 font-medium">Serial</th>
                  <th className="py-2 pr-3 font-medium">Period</th>
                  <th className="py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {credits.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[color:var(--rule)] text-[color:var(--ink)]"
                  >
                    <td className="py-2.5 pr-3">
                      {c.label ?? (
                        <span className="text-[color:var(--ink-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">{TYPE_LABELS[c.creditType]}</td>
                    <td className="py-2.5 pr-3">
                      <Mono>{formatNum(c.volumeTco2e)}</Mono>
                      <span className="ml-1 text-xs text-[color:var(--ink-muted)]">
                        tCO₂e
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Mono>{c.vintageYear}</Mono>
                    </td>
                    <td className={cn("py-2.5 pr-3", statusClass(c.status))}>
                      {c.status}
                    </td>
                    <td className="py-2.5 pr-3">{c.registryName}</td>
                    <td className="py-2.5 pr-3">
                      {c.serial ? (
                        <Mono className="text-xs">{c.serial}</Mono>
                      ) : (
                        <span className="text-[color:var(--ink-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-[color:var(--ink-muted)]">
                      {c.periodLabel ?? "—"}
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded-[4px] p-1.5 text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
                          aria-label="Edit lot"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-[4px] p-1.5 text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--rust)]"
                          aria-label="Delete lot"
                          onClick={() => void removeCredit(c.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ink)]/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="residual-lot-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-5 shadow-lg">
            <h3
              id="residual-lot-title"
              className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]"
            >
              {editingId ? "Edit offset lot" : "Add offset lot"}
            </h3>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              User-entered only. Not a REC/GO energy certificate. No registry API sync.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Label (optional)" className="sm:col-span-2">
                <input
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </Field>
              <Field label="Type">
                <select
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm"
                  value={form.creditType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      creditType: e.target.value as CreditType,
                    }))
                  }
                >
                  {(Object.keys(TYPE_LABELS) as CreditType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as CreditStatus,
                    }))
                  }
                >
                  <option value="held">Held</option>
                  <option value="retired">Retired</option>
                </select>
              </Field>
              <Field label="Volume (tCO₂e)">
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums"
                  value={form.volumeTco2e}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, volumeTco2e: e.target.value }))
                  }
                />
              </Field>
              <Field label="Vintage year">
                <input
                  type="number"
                  min={1990}
                  max={2100}
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums"
                  value={form.vintageYear}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vintageYear: e.target.value }))
                  }
                />
              </Field>
              <Field label="Registry name" className="sm:col-span-2">
                <input
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm"
                  value={form.registryName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, registryName: e.target.value }))
                  }
                  placeholder="e.g. Verra VCS, Gold Standard"
                />
              </Field>
              <Field label="Serial (optional)">
                <input
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm"
                  value={form.serial}
                  onChange={(e) => setForm((f) => ({ ...f, serial: e.target.value }))}
                />
              </Field>
              <Field label="Retired date (optional)">
                <input
                  type="date"
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm"
                  value={form.retiredAt}
                  onChange={(e) => setForm((f) => ({ ...f, retiredAt: e.target.value }))}
                />
              </Field>
              <Field label="Period (optional)" className="sm:col-span-2">
                <select
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm"
                  value={form.periodId}
                  onChange={(e) => setForm((f) => ({ ...f, periodId: e.target.value }))}
                >
                  <option value="">None</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <textarea
                  rows={2}
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </Field>
            </div>

            {formError ? (
              <p className="mt-3 text-sm text-[color:var(--rust)]">{formError}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => void submitForm()}>
                {editingId ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  emphasize,
}: {
  label: string;
  value: string;
  unit: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-t border-[color:var(--rule)] pt-2",
        emphasize && "border-[color:var(--rule-strong)]",
      )}
    >
      <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-[family-name:var(--font-mono)] text-2xl tabular-nums text-[color:var(--ink)]",
          emphasize && "text-[color:var(--accent)]",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-[color:var(--ink-muted)]">{unit}</div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex flex-col gap-1 text-xs text-[color:var(--ink-muted)]",
        className,
      )}
    >
      {label}
      {children}
    </label>
  );
}
