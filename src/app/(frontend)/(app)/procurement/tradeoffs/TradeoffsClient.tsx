"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Quality = "measured" | "missing";

type OptionDraft = {
  id: string;
  name: string;
  cost: string;
  tco2e: string;
  factorTco2ePerUnit: string;
  quantity: string;
  leadDays: string;
};

type ScoredOption = {
  id: string;
  name: string;
  cost: number | null;
  tco2e: number | null;
  leadDays: number | null;
  carbonSource: "direct" | "factor_x_qty" | null;
  quality: Quality;
  message: string | null;
  costNorm: number | null;
  carbonNorm: number | null;
  leadNorm: number | null;
  weightedScore: number | null;
  rank: number | null;
};

type ParetoPoint = {
  id: string;
  name: string;
  cost: number;
  tco2e: number;
  leadDays: number | null;
};

type Comparison = {
  ranked: {
    options: ScoredOption[];
    ranked: ScoredOption[];
    weights: { cost: number; carbon: number; lead: number };
    measuredCount: number;
    missingCount: number;
    quality: Quality;
    message: string | null;
  };
  pareto: {
    frontier: ParetoPoint[];
    dominated: ParetoPoint[];
    includeLead: boolean;
    quality: Quality;
    message: string | null;
  };
};

type SavedItem = {
  scenario: {
    id: string;
    name: string;
    notes: string | null;
    weights: { cost: number; carbon: number; lead: number };
    options: Array<{
      optionId: string;
      name: string;
      cost: number | null;
      tco2e: number | null;
      factorTco2ePerUnit: number | null;
      quantity: number | null;
      leadDays: number | null;
    }>;
    updatedAt: string;
  };
  comparison: Comparison;
};

function newId(): string {
  return `opt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyOption(): OptionDraft {
  return {
    id: newId(),
    name: "",
    cost: "",
    tco2e: "",
    factorTco2ePerUnit: "",
    quantity: "",
    leadDays: "",
  };
}

function parseOptional(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatNum(n: number | null | undefined, digits = 2): string {
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

function draftsToPayload(options: OptionDraft[]) {
  return options
    .filter((o) => o.name.trim())
    .map((o) => ({
      id: o.id,
      name: o.name.trim(),
      cost: parseOptional(o.cost),
      tco2e: parseOptional(o.tco2e),
      factorTco2ePerUnit: parseOptional(o.factorTco2ePerUnit),
      quantity: parseOptional(o.quantity),
      leadDays: parseOptional(o.leadDays),
    }));
}

export function TradeoffsClient({ orgName }: { orgName: string }) {
  const [options, setOptions] = useState<OptionDraft[]>([emptyOption(), emptyOption()]);
  const [weightCost, setWeightCost] = useState("1");
  const [weightCarbon, setWeightCarbon] = useState("1");
  const [weightLead, setWeightLead] = useState("0");
  const [scenarioName, setScenarioName] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadSaved = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/procurement/tradeoffs");
      const data = (await res.json()) as {
        scenarios?: SavedItem[];
        canWrite?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load saved comparisons.");
        setSaved([]);
        return;
      }
      setSaved(data.scenarios ?? []);
      setCanWrite(data.canWrite === true);
    } catch {
      setError("Could not load saved comparisons. Check your connection and try again.");
      setSaved([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadSaved();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadSaved]);

  function updateOption(id: string, patch: Partial<OptionDraft>) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function removeOption(id: string) {
    setOptions((prev) => (prev.length <= 1 ? prev : prev.filter((o) => o.id !== id)));
  }

  function runCompute() {
    setError(null);
    setStatus(null);
    const payloadOptions = draftsToPayload(options);
    if (payloadOptions.length === 0) {
      setError("Add at least one named purchase option before ranking.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/app/procurement/tradeoffs/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            options: payloadOptions,
            weights: {
              cost: Number(weightCost) || 0,
              carbon: Number(weightCarbon) || 0,
              lead: Number(weightLead) || 0,
            },
          }),
        });
        const data = (await res.json()) as {
          comparison?: Comparison;
          error?: string;
        };
        if (!res.ok || !data.comparison) {
          setError(data.error ?? "Compute failed.");
          setComparison(null);
          return;
        }
        setComparison(data.comparison);
        setStatus("Ranking updated.");
      } catch {
        setError("Compute failed. Check your connection and try again.");
        setComparison(null);
      }
    });
  }

  function runSave() {
    setError(null);
    setStatus(null);
    if (!canWrite) {
      setError("View-only role cannot save comparisons.");
      return;
    }
    const name = scenarioName.trim();
    if (!name) {
      setError("Enter a name to save this comparison.");
      return;
    }
    const payloadOptions = draftsToPayload(options);
    if (payloadOptions.length === 0) {
      setError("Add at least one named purchase option before saving.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/app/procurement/tradeoffs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            options: payloadOptions,
            weights: {
              cost: Number(weightCost) || 0,
              carbon: Number(weightCarbon) || 0,
              lead: Number(weightLead) || 0,
            },
          }),
        });
        const data = (await res.json()) as {
          comparison?: Comparison;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Could not save comparison.");
          return;
        }
        if (data.comparison) setComparison(data.comparison);
        setStatus(`Saved “${name}”.`);
        setScenarioName("");
        await loadSaved();
      } catch {
        setError("Could not save comparison. Check your connection and try again.");
      }
    });
  }

  function loadScenario(item: SavedItem) {
    const s = item.scenario;
    setScenarioName(s.name);
    setWeightCost(String(s.weights.cost));
    setWeightCarbon(String(s.weights.carbon));
    setWeightLead(String(s.weights.lead));
    setOptions(
      s.options.length > 0
        ? s.options.map((o) => ({
            id: o.optionId,
            name: o.name,
            cost: o.cost === null ? "" : String(o.cost),
            tco2e: o.tco2e === null ? "" : String(o.tco2e),
            factorTco2ePerUnit:
              o.factorTco2ePerUnit === null ? "" : String(o.factorTco2ePerUnit),
            quantity: o.quantity === null ? "" : String(o.quantity),
            leadDays: o.leadDays === null ? "" : String(o.leadDays),
          }))
        : [emptyOption()],
    );
    setComparison(item.comparison);
    setStatus(`Loaded “${s.name}”.`);
    setError(null);
  }

  function deleteScenario(id: string, name: string) {
    if (!canWrite) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/app/procurement/tradeoffs/${id}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not delete comparison.");
          return;
        }
        setStatus(`Deleted “${name}”.`);
        await loadSaved();
      } catch {
        setError("Could not delete comparison. Check your connection and try again.");
      }
    });
  }

  const ranked = comparison?.ranked.ranked ?? [];
  const topTwo = ranked.slice(0, 2);
  const frontierIds = new Set(comparison?.pareto.frontier.map((p) => p.id) ?? []);

  return (
    <div className="space-y-8">
      <p className="text-sm text-[color:var(--ink-muted)]">
        Organisation <span className="text-[color:var(--ink)]">{orgName}</span>
        {" · "}
        <Link
          href="/analytics/macc"
          className="text-[color:var(--accent)] underline-offset-2 hover:underline"
        >
          MACC / abatement levers
        </Link>{" "}
        (read-only link — separate from this modeller)
      </p>

      {loading ? (
        <div className="animate-pulse space-y-3" aria-hidden>
          <div className="h-8 rounded-[4px] bg-[color:var(--surface-2)]" />
          <div className="h-24 rounded-[4px] bg-[color:var(--surface-2)]" />
        </div>
      ) : null}

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {status && !error ? <StatusLine tone="ok">{status}</StatusLine> : null}

      <section className="space-y-4 border-b border-[color:var(--rule)] pb-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
              Purchase options
            </h2>
            <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
              Enter cost and tCO₂e, or factor × quantity when direct carbon is unknown.
              Blank fields stay missing — they are never treated as zero.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOptions((prev) => [...prev, emptyOption()])}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add option
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--rule-strong)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Cost</th>
                <th className="py-2 pr-3 font-medium">tCO₂e</th>
                <th className="py-2 pr-3 font-medium">Factor</th>
                <th className="py-2 pr-3 font-medium">Qty</th>
                <th className="py-2 pr-3 font-medium">Lead days</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {options.map((o) => (
                <tr key={o.id} className="border-b border-[color:var(--rule)]">
                  <td className="py-2 pr-3">
                    <input
                      className="w-full min-w-[8rem] rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                      value={o.name}
                      onChange={(e) => updateOption(o.id, { name: e.target.value })}
                      placeholder="Supplier / SKU"
                      aria-label="Option name"
                    />
                  </td>
                  {(
                    [
                      ["cost", o.cost],
                      ["tco2e", o.tco2e],
                      ["factorTco2ePerUnit", o.factorTco2ePerUnit],
                      ["quantity", o.quantity],
                      ["leadDays", o.leadDays],
                    ] as const
                  ).map(([key, value]) => (
                    <td key={key} className="py-2 pr-3">
                      <input
                        className="w-24 rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => updateOption(o.id, { [key]: e.target.value })}
                        aria-label={key}
                      />
                    </td>
                  ))}
                  <td className="py-2">
                    <button
                      type="button"
                      className="rounded-[4px] p-1.5 text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--rust)]"
                      onClick={() => removeOption(o.id)}
                      aria-label={`Remove ${o.name || "option"}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 border-b border-[color:var(--rule)] pb-8 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
            Weights
          </h2>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Relative importance. Set lead to 0 to ignore lead time. Weights are normalised
            before scoring; lower cost, carbon, and lead score better.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["Cost", weightCost, setWeightCost],
                ["Carbon", weightCarbon, setWeightCarbon],
                ["Lead", weightLead, setWeightLead],
              ] as const
            ).map(([label, value, setter]) => (
              <label key={label} className="block text-sm">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                  {label}
                </span>
                <input
                  className="mt-1 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={runCompute} disabled={pending}>
              Rank options
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
            Save comparison
          </h2>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Persist a named scenario for this organisation. Requires contributor access or
            above.
          </p>
          <label className="block text-sm">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
              Name
            </span>
            <input
              className="mt-1 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Q3 steel coil RFQ"
              disabled={!canWrite}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={runSave}
            disabled={pending || !canWrite}
          >
            Save
          </Button>
        </div>
      </section>

      {!comparison && !loading ? (
        <EmptyState
          title="No ranking yet"
          body="Add options with cost and estimated carbon, set weights, then rank. Incomplete cost or carbon stay missing — never zeroed."
          action={
            <Button type="button" onClick={runCompute} disabled={pending}>
              Rank options
            </Button>
          }
        />
      ) : null}

      {comparison ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
              Ranked results
            </h2>
            <p className="text-sm text-[color:var(--ink-muted)]">
              Measured <Mono>{comparison.ranked.measuredCount}</Mono>
              {" · Missing "}
              <Mono>{comparison.ranked.missingCount}</Mono>
              {" · Weights cost "}
              <Mono>{formatNum(comparison.ranked.weights.cost, 3)}</Mono>
              {" / carbon "}
              <Mono>{formatNum(comparison.ranked.weights.carbon, 3)}</Mono>
              {" / lead "}
              <Mono>{formatNum(comparison.ranked.weights.lead, 3)}</Mono>
            </p>
          </div>
          {comparison.ranked.message ? (
            <StatusLine tone="neutral">{comparison.ranked.message}</StatusLine>
          ) : null}

          {ranked.length === 0 ? (
            <EmptyState
              title="Nothing to rank"
              body="No options have measurable cost and carbon. Fill those fields — blanks are never treated as zero."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--rule-strong)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                    <th className="py-2 pr-3 font-medium">Rank</th>
                    <th className="py-2 pr-3 font-medium">Option</th>
                    <th className="py-2 pr-3 font-medium">Cost</th>
                    <th className="py-2 pr-3 font-medium">tCO₂e</th>
                    <th className="py-2 pr-3 font-medium">Lead</th>
                    <th className="py-2 pr-3 font-medium">Score</th>
                    <th className="py-2 font-medium">Pareto</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.ranked.options
                    .slice()
                    .sort((a, b) => {
                      if (a.rank === null && b.rank === null) {
                        return a.name.localeCompare(b.name);
                      }
                      if (a.rank === null) return 1;
                      if (b.rank === null) return -1;
                      return a.rank - b.rank;
                    })
                    .map((row) => (
                      <tr key={row.id} className="border-b border-[color:var(--rule)]">
                        <td className="py-2.5 pr-3">
                          <Mono>{row.rank ?? "—"}</Mono>
                        </td>
                        <td className="py-2.5 pr-3 text-[color:var(--ink)]">
                          {row.name}
                          {row.quality === "missing" ? (
                            <span className="ml-2 text-[10px] uppercase tracking-[0.06em] text-[color:var(--amber)]">
                              missing
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Mono>{formatNum(row.cost, 0)}</Mono>
                        </td>
                        <td className="py-2.5 pr-3">
                          <Mono>{formatNum(row.tco2e)}</Mono>
                        </td>
                        <td className="py-2.5 pr-3">
                          <Mono>{formatNum(row.leadDays, 0)}</Mono>
                        </td>
                        <td className="py-2.5 pr-3">
                          <Mono>{formatNum(row.weightedScore, 3)}</Mono>
                        </td>
                        <td className="py-2.5 text-[color:var(--ink-muted)]">
                          {frontierIds.has(row.id) ? "Frontier" : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {topTwo.length >= 2 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <p className="md:col-span-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                Top two comparison
              </p>
              {topTwo.map((row) => (
                <div
                  key={row.id}
                  className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--accent)]">
                    Rank <Mono>{row.rank}</Mono>
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
                    {row.name}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-[color:var(--ink-muted)]">Cost</dt>
                      <dd>
                        <Mono>{formatNum(row.cost, 0)}</Mono>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[color:var(--ink-muted)]">tCO₂e</dt>
                      <dd>
                        <Mono>{formatNum(row.tco2e)}</Mono>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[color:var(--ink-muted)]">Lead days</dt>
                      <dd>
                        <Mono>{formatNum(row.leadDays, 0)}</Mono>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[color:var(--ink-muted)]">Score</dt>
                      <dd>
                        <Mono>{formatNum(row.weightedScore, 3)}</Mono>
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          ) : null}

          {comparison.pareto.frontier.length > 0 ? (
            <p className="text-sm text-[color:var(--ink-muted)]">
              Pareto frontier (
              {comparison.pareto.includeLead ? "cost + carbon + lead" : "cost + carbon"}
              ): {comparison.pareto.frontier.map((p) => p.name).join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3 border-t border-[color:var(--rule)] pt-8">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
          Saved comparisons
        </h2>
        {!loading && saved.length === 0 ? (
          <EmptyState
            title="No saved comparisons"
            body="Rank options, then save a named scenario for this organisation."
          />
        ) : null}
        {saved.length > 0 ? (
          <ul className="divide-y divide-[color:var(--rule)] border-t border-b border-[color:var(--rule)]">
            {saved.map((item) => (
              <li
                key={item.scenario.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-[color:var(--ink)]">
                    {item.scenario.name}
                  </p>
                  <p className="text-xs text-[color:var(--ink-muted)]">
                    <Mono>{item.scenario.options.length}</Mono> options · measured{" "}
                    <Mono>{item.comparison.ranked.measuredCount}</Mono>
                    {" · updated "}
                    <Mono>
                      {item.scenario.updatedAt
                        ? new Date(item.scenario.updatedAt).toLocaleDateString()
                        : "—"}
                    </Mono>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => loadScenario(item)}
                  >
                    Load
                  </Button>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteScenario(item.scenario.id, item.scenario.name)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
