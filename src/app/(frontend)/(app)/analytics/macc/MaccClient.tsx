"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Quality = "measured" | "missing";

type Category =
  | "energy_efficiency"
  | "renewable_electricity"
  | "process_fuel"
  | "fleet_transport"
  | "nature_offsets"
  | "other";

type Lever = {
  id: string;
  name: string;
  category: Category | null;
  annualAbatementTco2e: number | null;
  capex: number | null;
  opexPerYear: number | null;
  lifetimeYears: number | null;
  notes: string | null;
  active: boolean;
};

type LeverCost = {
  id: string;
  name: string;
  category: Category | null;
  annualAbatementTco2e: number | null;
  costPerTco2e: number | null;
  annualisedCost: number | null;
  quality: Quality;
  message: string | null;
};

type CurvePoint = {
  id: string;
  name: string;
  category: Category | null;
  abatementStart: number;
  abatementEnd: number;
  annualAbatementTco2e: number;
  costPerTco2e: number;
};

type RoiRow = {
  id: string;
  lifetimeRoi: number | null;
  paybackYears: number | null;
  annualNetBenefit: number | null;
  lifetimeNetBenefit: number | null;
  quality: Quality;
  message: string | null;
};

type MaccPayload = {
  levers: LeverCost[];
  ranked: LeverCost[];
  curve: CurvePoint[];
  totalAnnualAbatementTco2e: number | null;
  totalAnnualisedCost: number | null;
  weightedAverageCostPerTco2e: number | null;
  measuredCount: number;
  missingCount: number;
  quality: Quality;
  message: string | null;
  roi: RoiRow[] | null;
};

type FormState = {
  name: string;
  category: Category | "";
  annualAbatementTco2e: string;
  capex: string;
  opexPerYear: string;
  lifetimeYears: string;
  notes: string;
  active: boolean;
};

const CATEGORY_LABELS: Record<Category, string> = {
  energy_efficiency: "Energy efficiency",
  renewable_electricity: "Renewable electricity",
  process_fuel: "Process / fuel switch",
  fleet_transport: "Fleet / transport",
  nature_offsets: "Nature / offsets (memo)",
  other: "Other",
};

const emptyForm = (): FormState => ({
  name: "",
  category: "",
  annualAbatementTco2e: "",
  capex: "",
  opexPerYear: "",
  lifetimeYears: "10",
  notes: "",
  active: true,
});

function formatNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatPct(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", className)}>
      {children}
    </span>
  );
}

function MaccChart({ curve }: { curve: CurvePoint[] }) {
  if (curve.length === 0) return null;

  const maxX = Math.max(...curve.map((c) => c.abatementEnd), 1);
  const maxY = Math.max(...curve.map((c) => Math.abs(c.costPerTco2e)), 1);
  const minY = Math.min(0, ...curve.map((c) => c.costPerTco2e));
  const ySpan = Math.max(maxY - minY, 1);

  const W = 640;
  const H = 280;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xScale = (v: number) => padL + (v / maxX) * innerW;
  const yScale = (v: number) => padT + ((maxY - v) / ySpan) * innerH;
  const zeroY = yScale(0);

  const colors = [
    "var(--accent)",
    "var(--cobalt)",
    "var(--signal)",
    "var(--amber)",
    "var(--rust)",
  ];

  return (
    <div className="overflow-x-auto border-t border-[color:var(--rule)] pt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-w-3xl text-[color:var(--ink)]"
        role="img"
        aria-label="Marginal abatement cost curve"
      >
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={H - padB}
          stroke="var(--rule-strong)"
          strokeWidth={1}
        />
        <line
          x1={padL}
          y1={H - padB}
          x2={W - padR}
          y2={H - padB}
          stroke="var(--rule-strong)"
          strokeWidth={1}
        />
        <line
          x1={padL}
          y1={zeroY}
          x2={W - padR}
          y2={zeroY}
          stroke="var(--rule)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {curve.map((bar, i) => {
          const x1 = xScale(bar.abatementStart);
          const x2 = xScale(bar.abatementEnd);
          const y = yScale(bar.costPerTco2e);
          const top = Math.min(y, zeroY);
          const height = Math.max(Math.abs(y - zeroY), 1);
          return (
            <g key={bar.id}>
              <rect
                x={x1 + 1}
                y={top}
                width={Math.max(x2 - x1 - 2, 1)}
                height={height}
                fill={colors[i % colors.length]}
                fillOpacity={0.85}
              />
              <title>
                {bar.name}: {bar.costPerTco2e.toFixed(1)} / tCO₂e ·{" "}
                {bar.annualAbatementTco2e.toFixed(1)} tCO₂e/yr
              </title>
            </g>
          );
        })}
        <text
          x={padL}
          y={H - 12}
          className="fill-[color:var(--ink-muted)]"
          style={{ fontSize: 10 }}
        >
          Cumulative annual abatement (tCO₂e/yr)
        </text>
        <text
          x={12}
          y={padT + 8}
          className="fill-[color:var(--ink-muted)]"
          style={{ fontSize: 10 }}
          transform={`rotate(-90 12 ${padT + 80})`}
        >
          Cost / tCO₂e
        </text>
        <text
          x={W - padR}
          y={H - 12}
          textAnchor="end"
          className="fill-[color:var(--ink)]"
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
        >
          {formatNum(maxX, 0)}
        </text>
        <text
          x={padL - 8}
          y={yScale(maxY) + 4}
          textAnchor="end"
          className="fill-[color:var(--ink)]"
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
        >
          {formatNum(maxY, 0)}
        </text>
      </svg>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--ink-muted)]">
        {curve.map((bar, i) => (
          <li key={bar.id} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ background: colors[i % colors.length] }}
            />
            <span>{bar.name}</span>
            <Mono>
              {formatNum(bar.costPerTco2e)} / t · {formatNum(bar.annualAbatementTco2e)}{" "}
              t/yr
            </Mono>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MaccClient({ orgName }: { orgName: string }) {
  const [levers, setLevers] = useState<Lever[]>([]);
  const [macc, setMacc] = useState<MaccPayload | null>(null);
  const [carbonPrice, setCarbonPrice] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(
    (price?: string) => {
      startTransition(async () => {
        setError(null);
        try {
          const params = new URLSearchParams({ includeInactive: "1" });
          const p = (price ?? carbonPrice).trim();
          if (p) params.set("carbonPrice", p);
          const res = await fetch(`/api/app/analytics/macc?${params.toString()}`);
          const data = (await res.json()) as {
            error?: string;
            levers?: Lever[];
            macc?: MaccPayload;
            canWrite?: boolean;
          };
          if (!res.ok) {
            setError(data.error ?? "Failed to load MACC");
            setLoading(false);
            return;
          }
          setLevers(data.levers ?? []);
          setMacc(data.macc ?? null);
          setCanWrite(Boolean(data.canWrite));
        } catch {
          setError("Failed to load MACC. Check your connection and try again.");
        } finally {
          setLoading(false);
        }
      });
    },
    [carbonPrice],
  );

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(lever: Lever) {
    setEditingId(lever.id);
    setForm({
      name: lever.name,
      category: lever.category ?? "",
      annualAbatementTco2e:
        lever.annualAbatementTco2e !== null ? String(lever.annualAbatementTco2e) : "",
      capex: lever.capex !== null ? String(lever.capex) : "",
      opexPerYear: lever.opexPerYear !== null ? String(lever.opexPerYear) : "",
      lifetimeYears: lever.lifetimeYears !== null ? String(lever.lifetimeYears) : "10",
      notes: lever.notes ?? "",
      active: lever.active,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm() {
    setFormError(null);
    const body = {
      name: form.name.trim(),
      category: form.category || null,
      annualAbatementTco2e: Number(form.annualAbatementTco2e),
      capex: Number(form.capex),
      opexPerYear: Number(form.opexPerYear),
      lifetimeYears: Number(form.lifetimeYears),
      notes: form.notes.trim() || null,
      active: form.active,
    };

    const res = await fetch(
      editingId ? `/api/app/analytics/macc/${editingId}` : "/api/app/analytics/macc",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setFormError(data.error ?? "Save failed");
      return;
    }
    setFormOpen(false);
    load();
  }

  async function removeLever(id: string) {
    const res = await fetch(`/api/app/analytics/macc/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    load();
  }

  const costById = new Map((macc?.levers ?? []).map((l) => [l.id, l]));
  const roiById = new Map((macc?.roi ?? []).map((r) => [r.id, r]));

  if (loading) {
    return <StatusLine>Loading abatement levers…</StatusLine>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-[color:var(--ink-muted)]">
            Organisation <span className="text-[color:var(--ink)]">{orgName}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="text-xs text-[color:var(--ink-muted)]"
              htmlFor="carbon-price"
            >
              Carbon price (for ROI)
            </label>
            <input
              id="carbon-price"
              type="number"
              min={0}
              step="any"
              value={carbonPrice}
              onChange={(e) => setCarbonPrice(e.target.value)}
              placeholder="Optional"
              className="h-8 w-28 rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 font-[family-name:var(--font-mono)] text-sm text-[color:var(--ink)]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => load(carbonPrice)}
            >
              Recompute
            </Button>
          </div>
        </div>
        {canWrite ? (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Add lever
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="border border-[color:var(--rust)] bg-[color:var(--surface-2)] px-3 py-2 text-sm text-[color:var(--rust)]">
          {error}
        </p>
      ) : null}

      {macc ? (
        <div className="space-y-3 border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4 rounded-[6px]">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                Measured levers
              </p>
              <p>
                <Mono>{macc.measuredCount}</Mono>
                {macc.missingCount > 0 ? (
                  <span className="ml-2 text-[color:var(--amber)]">
                    · <Mono>{macc.missingCount}</Mono> missing
                  </span>
                ) : null}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                Total abatement
              </p>
              <p>
                <Mono>{formatNum(macc.totalAnnualAbatementTco2e)}</Mono>{" "}
                <span className="text-[color:var(--ink-muted)]">tCO₂e/yr</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                Weighted avg cost
              </p>
              <p>
                <Mono>{formatNum(macc.weightedAverageCostPerTco2e)}</Mono>{" "}
                <span className="text-[color:var(--ink-muted)]">/ tCO₂e</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                Quality
              </p>
              <p
                className={
                  macc.quality === "missing"
                    ? "text-[color:var(--amber)]"
                    : "text-[color:var(--signal)]"
                }
              >
                {macc.quality}
              </p>
            </div>
          </div>
          {macc.message ? (
            <p className="text-xs text-[color:var(--ink-muted)]">{macc.message}</p>
          ) : null}
          <MaccChart curve={macc.curve} />
        </div>
      ) : null}

      {levers.length === 0 ? (
        <EmptyState
          title="No abatement levers"
          body="Add levers with annual abatement, CAPEX, OPEX/year, and lifetime to build the MACC."
        />
      ) : (
        <div className="overflow-x-auto border border-[color:var(--rule)] rounded-[6px]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[color:var(--rule)] bg-[color:var(--surface-2)] text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Lever</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Abatement</th>
                <th className="px-3 py-2 font-medium">CAPEX</th>
                <th className="px-3 py-2 font-medium">OPEX/yr</th>
                <th className="px-3 py-2 font-medium">Life</th>
                <th className="px-3 py-2 font-medium">Cost/t</th>
                <th className="px-3 py-2 font-medium">Payback</th>
                <th className="px-3 py-2 font-medium">ROI</th>
                {canWrite ? <th className="px-3 py-2 font-medium" /> : null}
              </tr>
            </thead>
            <tbody>
              {levers.map((lever) => {
                const cost = costById.get(lever.id);
                const roi = roiById.get(lever.id);
                return (
                  <tr
                    key={lever.id}
                    className="border-b border-[color:var(--rule)] last:border-0"
                  >
                    <td className="px-3 py-2">
                      <span className="text-[color:var(--ink)]">{lever.name}</span>
                      {!lever.active ? (
                        <span className="ml-2 text-[10px] uppercase text-[color:var(--ink-muted)]">
                          inactive
                        </span>
                      ) : null}
                      {cost?.quality === "missing" && cost.message ? (
                        <p className="mt-0.5 text-[11px] text-[color:var(--amber)]">
                          {cost.message}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[color:var(--ink-muted)]">
                      {lever.category ? CATEGORY_LABELS[lever.category] : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Mono>{formatNum(lever.annualAbatementTco2e)}</Mono>
                    </td>
                    <td className="px-3 py-2">
                      <Mono>{formatNum(lever.capex, 0)}</Mono>
                    </td>
                    <td className="px-3 py-2">
                      <Mono>{formatNum(lever.opexPerYear, 0)}</Mono>
                    </td>
                    <td className="px-3 py-2">
                      <Mono>{formatNum(lever.lifetimeYears, 0)}</Mono>
                    </td>
                    <td className="px-3 py-2">
                      <Mono
                        className={
                          cost?.quality === "missing"
                            ? "text-[color:var(--amber)]"
                            : undefined
                        }
                      >
                        {formatNum(cost?.costPerTco2e ?? null)}
                      </Mono>
                    </td>
                    <td className="px-3 py-2">
                      <Mono>{formatNum(roi?.paybackYears ?? null)}</Mono>
                    </td>
                    <td className="px-3 py-2">
                      <Mono>{formatPct(roi?.lifetimeRoi ?? null)}</Mono>
                    </td>
                    {canWrite ? (
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${lever.name}`}
                            onClick={() => openEdit(lever)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${lever.name}`}
                            onClick={() => void removeLever(lever.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ink)]/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="macc-form-title"
            className="w-full max-w-lg rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4 shadow-lg"
          >
            <h2
              id="macc-form-title"
              className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]"
            >
              {editingId ? "Edit lever" : "Add lever"}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 space-y-1 text-xs text-[color:var(--ink-muted)]">
                Name
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-9 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 text-sm text-[color:var(--ink)]"
                />
              </label>
              <label className="space-y-1 text-xs text-[color:var(--ink-muted)]">
                Category
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      category: e.target.value as Category | "",
                    }))
                  }
                  className="h-9 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 text-sm text-[color:var(--ink)]"
                >
                  <option value="">—</option>
                  {(Object.keys(CATEGORY_LABELS) as Category[]).map((key) => (
                    <option key={key} value={key}>
                      {CATEGORY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-[color:var(--ink-muted)]">
                Lifetime (years)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.lifetimeYears}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lifetimeYears: e.target.value }))
                  }
                  className="h-9 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 font-[family-name:var(--font-mono)] text-sm text-[color:var(--ink)]"
                />
              </label>
              <label className="space-y-1 text-xs text-[color:var(--ink-muted)]">
                Annual abatement (tCO₂e)
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.annualAbatementTco2e}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      annualAbatementTco2e: e.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 font-[family-name:var(--font-mono)] text-sm text-[color:var(--ink)]"
                />
              </label>
              <label className="space-y-1 text-xs text-[color:var(--ink-muted)]">
                CAPEX
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.capex}
                  onChange={(e) => setForm((f) => ({ ...f, capex: e.target.value }))}
                  className="h-9 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 font-[family-name:var(--font-mono)] text-sm text-[color:var(--ink)]"
                />
              </label>
              <label className="space-y-1 text-xs text-[color:var(--ink-muted)]">
                OPEX / year
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.opexPerYear}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, opexPerYear: e.target.value }))
                  }
                  className="h-9 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 font-[family-name:var(--font-mono)] text-sm text-[color:var(--ink)]"
                />
              </label>
              <label className="sm:col-span-2 space-y-1 text-xs text-[color:var(--ink-muted)]">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-[color:var(--ink)]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active on default MACC
              </label>
            </div>
            {formError ? (
              <p className="mt-3 text-sm text-[color:var(--rust)]">{formError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => void submitForm()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
