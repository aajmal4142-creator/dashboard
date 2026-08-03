"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import {
  EmptyState,
  PageCard,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import type { FactorAdminRow } from "@/lib/factors";
import { cn } from "@/lib/utils";

type Summary = {
  custom: number;
  active: number;
  deactivated: number;
  global: number;
};

type FormState = {
  key: string;
  value: string;
  unit: string;
  source: string;
  year: string;
  geography: string;
  scope: "1" | "2" | "3";
};

const emptyForm = (): FormState => ({
  key: "",
  value: "",
  unit: "",
  source: "",
  year: String(new Date().getFullYear()),
  geography: "",
  scope: "1",
});

function Mono({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-mono)] tabular-nums slashed-zero",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FactorsClient({ canEdit }: { canEdit: boolean }) {
  const [factors, setFactors] = useState<FactorAdminRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [includeGlobal, setIncludeGlobal] = useState(true);
  const [ownershipFilter, setOwnershipFilter] = useState<"all" | "custom" | "global">(
    "custom",
  );
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (includeGlobal) params.set("includeGlobal", "1");
      if (debouncedQuery) params.set("q", debouncedQuery);
      const res = await fetch(`/api/app/factors?${params.toString()}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not load emission factors");
        setFactors([]);
        setSummary(null);
        return;
      }
      const data = (await res.json()) as {
        factors: FactorAdminRow[];
        summary: Summary;
        notice?: string;
      };
      setFactors(data.factors);
      setSummary(data.summary);
      setNotice(data.notice ?? null);
    } catch {
      setError("Could not load emission factors");
      setFactors([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, includeGlobal]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => {
    if (ownershipFilter === "all") return factors;
    return factors.filter((f) => f.ownership === ownershipFilter);
  }, [factors, ownershipFilter]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const valueNum = Number(form.value);
      const yearNum = Number(form.year);
      const res = await fetch("/api/app/factors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: form.key.trim(),
          value: valueNum,
          unit: form.unit.trim(),
          source: form.source.trim(),
          year: yearNum,
          geography: form.geography.trim() || undefined,
          scope: form.scope,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        notice?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not create factor");
        return;
      }
      setStatus(data.notice ?? "Custom factor created.");
      setForm(emptyForm());
      setFormOpen(false);
      await load();
    } catch {
      setError("Could not create factor");
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate(id: string) {
    if (!canEdit) return;
    setBusyId(id);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch(`/api/app/factors/${id}/deactivate`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        notice?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not deactivate factor");
        return;
      }
      setStatus(data.notice ?? "Factor deactivated.");
      await load();
    } catch {
      setError("Could not deactivate factor");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && factors.length === 0) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-8">
      <PageCard>
        <p className="text-sm text-ink-muted">
          {notice ??
            "Missing factors still throw in calc or surface as quality missing. This admin does not invent default values."}
        </p>
        {summary ? (
          <p className="mt-3 text-sm text-ink-muted">
            Custom <Mono>{summary.custom}</Mono>
            {" · "}
            Active <Mono>{summary.active}</Mono>
            {" · "}
            Deactivated <Mono>{summary.deactivated}</Mono>
            {includeGlobal ? (
              <>
                {" · "}
                Global <Mono>{summary.global}</Mono>
              </>
            ) : null}
          </p>
        ) : null}
        {!canEdit ? (
          <p className="mt-3 text-sm text-ink-muted">
            View only — ask an owner or admin to create or deactivate custom factors.
          </p>
        ) : null}
      </PageCard>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <AppField
            label="Search"
            id="factor-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="key, unit, region, source…"
          />
        </div>
        <div className="w-40">
          <AppSelectNative
            label="Show"
            id="factor-ownership"
            value={ownershipFilter}
            onChange={(e) =>
              setOwnershipFilter(e.target.value as "all" | "custom" | "global")
            }
          >
            <option value="custom">Custom only</option>
            <option value="global">Global seeds</option>
            <option value="all">All</option>
          </AppSelectNative>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={includeGlobal}
            onChange={(e) => setIncludeGlobal(e.target.checked)}
            className="accent-[color:var(--accent)]"
          />
          Load global registry
        </label>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            className="mb-0.5"
            onClick={() => {
              setFormOpen((open) => !open);
              setStatus(null);
              setError(null);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {formOpen ? "Close form" : "New custom factor"}
          </Button>
        ) : null}
      </div>

      {status ? <StatusLine tone="ok">{status}</StatusLine> : null}
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      {formOpen && canEdit ? (
        <PageCard>
          <h2 className="font-display text-lg text-ink">Create custom factor</h2>
          <div className="title-rule mt-2" />
          <p className="mt-2 text-sm text-ink-muted">
            Registers an organisation-owned row. Calc still refuses silent defaults when a
            key is missing.
          </p>
          <form onSubmit={onCreate} className="mt-6 grid gap-4 sm:grid-cols-2">
            <AppField
              label="Key"
              id="factor-key"
              required
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="e.g. diesel_blend"
              className="font-[family-name:var(--font-mono)]"
            />
            <AppField
              label="Value"
              id="factor-value"
              required
              inputMode="decimal"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="e.g. 2.51233"
              className="font-[family-name:var(--font-mono)] tabular-nums"
            />
            <AppField
              label="Unit"
              id="factor-unit"
              required
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              placeholder="e.g. kgCO2e/L"
              className="font-[family-name:var(--font-mono)]"
            />
            <AppField
              label="Source citation"
              id="factor-source"
              required
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              placeholder="e.g. Supplier LCA 2024"
            />
            <AppField
              label="Year"
              id="factor-year"
              required
              inputMode="numeric"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              className="font-[family-name:var(--font-mono)] tabular-nums"
            />
            <AppField
              label="Geography (optional)"
              id="factor-geo"
              value={form.geography}
              onChange={(e) => setForm((f) => ({ ...f, geography: e.target.value }))}
              placeholder="ISO alpha-2 or blank → GLOBAL"
              className="font-[family-name:var(--font-mono)]"
            />
            <AppSelectNative
              label="Scope"
              id="factor-scope"
              value={form.scope}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  scope: e.target.value as "1" | "2" | "3",
                }))
              }
            >
              <option value="1">Scope 1</option>
              <option value="2">Scope 2</option>
              <option value="3">Scope 3</option>
            </AppSelectNative>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create factor"}
              </Button>
            </div>
          </form>
        </PageCard>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title={
            ownershipFilter === "custom"
              ? "No custom emission factors"
              : "No factors match"
          }
          body={
            ownershipFilter === "custom"
              ? "Create an organisation factor with key, value, unit, source, and year. Global seeds stay read-only."
              : "Adjust search or filters."
          }
        />
      ) : (
        <div className="overflow-x-auto border-t border-rule">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-ink-muted">
                <th className="py-2 pr-3 font-medium">Key</th>
                <th className="py-2 pr-3 font-medium">Value</th>
                <th className="py-2 pr-3 font-medium">Unit</th>
                <th className="py-2 pr-3 font-medium">Year</th>
                <th className="py-2 pr-3 font-medium">Region</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Ownership</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-rule text-ink">
                  <td className="py-2.5 pr-3">
                    <Mono>{row.key}</Mono>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Mono>{row.value}</Mono>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Mono>{row.unit}</Mono>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Mono>{row.publicationYear}</Mono>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Mono>{row.region}</Mono>
                  </td>
                  <td
                    className="max-w-[12rem] truncate py-2.5 pr-3"
                    title={row.sourceCitation}
                  >
                    {row.source}
                  </td>
                  <td className="py-2.5 pr-3 capitalize text-ink-muted">
                    {row.ownership}
                  </td>
                  <td className="py-2.5 pr-3 capitalize text-ink-muted">{row.status}</td>
                  <td className="py-2.5 text-right">
                    {canEdit && row.ownership === "custom" && row.status === "active" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() => void onDeactivate(row.id)}
                      >
                        {busyId === row.id ? "…" : "Deactivate"}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
