"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CategoryMapping,
  CategoryMappingEntry,
} from "@/lib/integrations/accounting";

type Provider = "xero" | "quickbooks" | "wave";
type WizardStep = "connect" | "mapping" | "sync" | "history";

type PeriodOption = { id: string; label: string; status: string };

type DiscoveredAccount = { code: string; name: string };

type ConnectionRow = {
  id: string;
  provider: Provider;
  status: "pending" | "connected" | "failed" | "expired";
  connectionMode: "sandbox" | "live";
  companyName: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastSyncStatus: string | null;
  syncErrorCount: number;
  syncConfig: {
    enableExpenseSync: boolean;
    enableBankFeedSync: boolean;
    enableAutoCateg: boolean;
    syncFrequency: string;
  };
  expenseCategoryMapping: CategoryMapping;
  discoveredAccounts: DiscoveredAccount[];
};

type SyncLog = {
  id: string;
  status: string;
  recordsProcessed: number;
  recordsFailed: number;
  syncDurationMs: number | null;
  errors: Array<{ message?: string | null; recordId?: string | null }>;
  createdAt: string;
};

type StatusMessage = { type: "success" | "error"; text: string };

const PROVIDERS: Array<{ id: Provider; label: string; blurb: string }> = [
  {
    id: "quickbooks",
    label: "QuickBooks Online",
    blurb: "OAuth + realm ID. Sandbox when QB_CLIENT_ID is unset.",
  },
  {
    id: "xero",
    label: "Xero",
    blurb: "OAuth tenant connection. Sandbox when XERO_CLIENT_ID is unset.",
  },
  {
    id: "wave",
    label: "Wave",
    blurb: "OAuth + GraphQL. Sandbox when WAVE_CLIENT_ID is unset.",
  },
];

const LEDGER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "fuel_energy", label: "Fuel & energy" },
  { value: "transportation", label: "Transportation" },
  { value: "services", label: "Services" },
  { value: "facilities", label: "Facilities" },
  { value: "it", label: "IT & software" },
  { value: "waste", label: "Waste" },
  { value: "packaging", label: "Packaging" },
  { value: "raw_materials", label: "Raw materials" },
  { value: "other", label: "Other (unmatched)" },
];

const STEPS: WizardStep[] = ["connect", "mapping", "sync", "history"];

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function providerLabel(id: Provider): string {
  return PROVIDERS.find((p) => p.id === id)?.label || id;
}

export function AccountingClient(props: {
  canManage: boolean;
  periods: PeriodOption[];
  initialConnections: ConnectionRow[];
}) {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState(props.initialConnections);
  const [selectedId, setSelectedId] = useState<string | null>(
    props.initialConnections.find((c) => c.status === "connected")?.id ||
      props.initialConnections[0]?.id ||
      null,
  );
  const [step, setStep] = useState<WizardStep>("connect");
  const [periodId, setPeriodId] = useState(props.periods[0]?.id || "");
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [pending, startTransition] = useTransition();
  const [draftMapping, setDraftMapping] = useState<CategoryMapping>(() => {
    const initialId =
      props.initialConnections.find((c) => c.status === "connected")?.id ||
      props.initialConnections[0]?.id ||
      null;
    const conn = props.initialConnections.find((c) => c.id === initialId);
    return conn ? { ...conn.expenseCategoryMapping } : {};
  });

  const selected = connections.find((c) => c.id === selectedId) || null;

  function selectConnection(id: string | null, rows: ConnectionRow[] = connections) {
    setSelectedId(id);
    const conn = id ? rows.find((c) => c.id === id) : null;
    setDraftMapping(conn ? { ...conn.expenseCategoryMapping } : {});
  }

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    const provider = searchParams.get("provider");
    const mode = searchParams.get("mode");
    if (connected === "true") {
      void Promise.resolve().then(() => {
        setMessage({
          type: "success",
          text: `${providerLabel((provider as Provider) || "xero")} connected${mode === "sandbox" ? " (sandbox)" : ""}.`,
        });
        void refreshConnections();
      });
    } else if (error) {
      void Promise.resolve().then(() => {
        setMessage({ type: "error", text: `Connection failed: ${error}` });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step === "history" && selectedId) {
      void loadLogs(selectedId);
    }
  }, [step, selectedId]);

  async function refreshConnections() {
    const res = await fetch("/api/app/integrations/status");
    if (!res.ok) return;
    const data = (await res.json()) as { accounting?: ConnectionRow[] };
    if (!data.accounting) return;
    setConnections(data.accounting);
    if (selectedId && !data.accounting.some((c) => c.id === selectedId)) {
      selectConnection(data.accounting[0]?.id ?? null, data.accounting);
    } else if (selectedId) {
      const current = data.accounting.find((c) => c.id === selectedId);
      if (current) {
        setDraftMapping({ ...current.expenseCategoryMapping });
      }
    } else if (data.accounting[0]) {
      selectConnection(data.accounting[0].id, data.accounting);
    }
  }

  async function loadLogs(connectionId: string) {
    const res = await fetch(`/api/app/integrations/accounting/${connectionId}/logs`);
    if (!res.ok) return;
    const data = (await res.json()) as { logs?: SyncLog[] };
    setLogs(data.logs || []);
  }

  function handleConnect(provider: Provider) {
    if (!props.canManage) {
      setMessage({ type: "error", text: "Admin or owner role required to connect." });
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/app/integrations/accounting/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        const data = (await res.json()) as {
          authUrl?: string;
          error?: string;
          mode?: string;
        };
        if (!res.ok || !data.authUrl) {
          setMessage({
            type: "error",
            text: data.error || "Failed to start OAuth",
          });
          return;
        }
        window.location.href = data.authUrl;
      } catch {
        setMessage({ type: "error", text: "Failed to initiate connection" });
      }
    });
  }

  function handleDisconnect(connectionId: string) {
    if (!props.canManage) return;
    startTransition(async () => {
      const res = await fetch(`/api/app/integrations/accounting/${connectionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessage({ type: "error", text: data.error || "Disconnect failed" });
        return;
      }
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      selectConnection(null);
      setMessage({ type: "success", text: "Disconnected. Tokens cleared." });
    });
  }

  function handleSaveMapping() {
    if (!selected || !props.canManage) return;
    startTransition(async () => {
      const res = await fetch(`/api/app/integrations/accounting/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseCategoryMapping: draftMapping }),
      });
      const data = (await res.json()) as {
        error?: string;
        expenseCategoryMapping?: CategoryMapping;
      };
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to save mapping" });
        return;
      }
      setConnections((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                expenseCategoryMapping: data.expenseCategoryMapping || draftMapping,
              }
            : c,
        ),
      );
      setMessage({ type: "success", text: "Category mapping saved." });
    });
  }

  function handleSync() {
    if (!selected || !periodId) {
      setMessage({ type: "error", text: "Select a connection and reporting period." });
      return;
    }
    if (!props.canManage) {
      setMessage({ type: "error", text: "Admin or owner role required to sync." });
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/app/integrations/accounting/${selected.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId }),
      });
      const data = (await res.json()) as {
        status?: string;
        recordsProcessed?: number;
        error?: string;
      };
      if (!res.ok || data.status === "failed") {
        setMessage({
          type: "error",
          text: data.error || "Sync failed",
        });
        return;
      }
      setMessage({
        type: "success",
        text: `Sync ${data.status}: ${data.recordsProcessed ?? 0} spend lines processed.`,
      });
      await refreshConnections();
      setStep("history");
    });
  }

  function updateDraftEntry(code: string, patch: Partial<CategoryMappingEntry>) {
    setDraftMapping((prev) => {
      const current = prev[code] || {
        category: "other" as const,
        scope: "3" as const,
      };
      return {
        ...prev,
        [code]: { ...current, ...patch },
      };
    });
  }

  const mappingRows = selected?.discoveredAccounts?.length
    ? selected.discoveredAccounts
    : Object.keys(draftMapping).map((code) => ({
        code,
        name: draftMapping[code]?.label || code,
      }));

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-signal/40 bg-accent-quiet text-ink"
              : "border-rust/40 bg-surface-2 text-ink",
          )}
        >
          {message.text}
        </div>
      )}

      <nav className="flex flex-wrap gap-2 border-b border-rule pb-3">
        {STEPS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm capitalize",
              step === s
                ? "bg-accent text-on-accent"
                : "text-ink-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {s === "mapping"
              ? "Category mapping"
              : s === "connect"
                ? "Connect"
                : s === "sync"
                  ? "Sync"
                  : "History"}
          </button>
        ))}
      </nav>

      {step === "connect" && (
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {PROVIDERS.map((p) => {
              const existing = connections.find(
                (c) => c.provider === p.id && c.status === "connected",
              );
              return (
                <div key={p.id} className="panel p-5">
                  <h2 className="font-display text-lg text-ink">{p.label}</h2>
                  <p className="mt-2 text-sm text-ink-muted">{p.blurb}</p>
                  {existing ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="h-2 w-2 rounded-full bg-signal" />
                        <span className="text-ink">
                          Connected
                          {existing.connectionMode === "sandbox" ? " · sandbox" : ""}
                        </span>
                      </div>
                      {existing.companyName && (
                        <p className="font-mono text-xs text-ink-muted">
                          {existing.companyName}
                        </p>
                      )}
                      <p className="text-xs text-ink-muted">
                        Connected {formatTs(existing.connectedAt)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            selectConnection(existing.id);
                            setStep("mapping");
                          }}
                        >
                          Manage mapping
                        </Button>
                        {props.canManage && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => handleDisconnect(existing.id)}
                          >
                            Disconnect
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="mt-4"
                      disabled={!props.canManage || pending}
                      onClick={() => handleConnect(p.id)}
                    >
                      Connect {p.label}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {connections.length > 0 && (
            <div className="panel p-5">
              <h3 className="text-sm font-medium text-ink">All connections</h3>
              <ul className="mt-3 divide-y divide-rule">
                {connections.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="text-sm text-ink">
                        {providerLabel(c.provider)}
                        <span className="ml-2 font-mono text-xs text-ink-muted">
                          {c.status}
                        </span>
                      </p>
                      <p className="text-xs text-ink-muted">
                        Last sync {formatTs(c.lastSyncAt)}
                        {c.nextSyncAt ? ` · next ${formatTs(c.nextSyncAt)}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        selectConnection(c.id);
                        setStep("mapping");
                      }}
                    >
                      Select
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-ink-muted">
            <Link href="/integrations" className="text-accent hover:underline">
              ← Back to integrations
            </Link>
          </p>
        </section>
      )}

      {step === "mapping" && (
        <section className="space-y-4">
          {!selected ? (
            <p className="text-sm text-ink-muted">
              Connect a provider first, then map accounts to emissions categories.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-ink">
                    Category mapping — {providerLabel(selected.provider)}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Fuel → Scope 1, Electricity → Scope 2, vendor services → Scope 3.
                    Unmatched accounts fall back to Other.
                  </p>
                </div>
                {props.canManage && (
                  <Button type="button" disabled={pending} onClick={handleSaveMapping}>
                    Save mapping
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto rounded-md border border-rule">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-rule bg-surface-2 text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Account</th>
                      <th className="px-3 py-2 font-medium">Code</th>
                      <th className="px-3 py-2 font-medium">Emissions category</th>
                      <th className="px-3 py-2 font-medium">Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingRows.map((row) => {
                      const entry = draftMapping[row.code] || {
                        category: "other" as const,
                        scope: "3" as const,
                      };
                      return (
                        <tr key={row.code} className="border-b border-rule">
                          <td className="px-3 py-2 text-ink">{row.name}</td>
                          <td className="px-3 py-2 font-mono text-xs text-ink-muted">
                            {row.code}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="w-full rounded-sm border border-rule bg-canvas px-2 py-1.5 text-ink"
                              value={entry.category}
                              disabled={!props.canManage}
                              onChange={(e) =>
                                updateDraftEntry(row.code, {
                                  category: e.target
                                    .value as CategoryMappingEntry["category"],
                                })
                              }
                            >
                              {LEDGER_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="w-full rounded-sm border border-rule bg-canvas px-2 py-1.5 font-mono text-ink"
                              value={entry.scope}
                              disabled={!props.canManage}
                              onChange={(e) =>
                                updateDraftEntry(row.code, {
                                  scope: e.target.value as "1" | "2" | "3",
                                })
                              }
                            >
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {step === "sync" && (
        <section className="panel space-y-4 p-6">
          <h2 className="font-display text-xl text-ink">Sync spend</h2>
          <p className="text-sm text-ink-muted">
            Sync is user-initiated only. Spending is mapped, then written to spend-based
            emissions with source=accounting.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-ink-muted">Connection</span>
              <select
                className="mt-1 w-full rounded-sm border border-rule bg-canvas px-3 py-2 text-ink"
                value={selectedId || ""}
                onChange={(e) => selectConnection(e.target.value || null)}
              >
                <option value="">Select…</option>
                {connections
                  .filter((c) => c.status === "connected")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {providerLabel(c.provider)}
                      {c.companyName ? ` — ${c.companyName}` : ""}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-ink-muted">Reporting period</span>
              <select
                className="mt-1 w-full rounded-sm border border-rule bg-canvas px-3 py-2 text-ink"
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                <option value="">Select…</option>
                {props.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selected && (
            <dl className="grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
              <div>
                Last sync:{" "}
                <span className="font-mono text-ink">
                  {formatTs(selected.lastSyncAt)}
                </span>
              </div>
              <div>
                Next scheduled:{" "}
                <span className="font-mono text-ink">
                  {formatTs(selected.nextSyncAt)}
                </span>
              </div>
              <div>
                Frequency:{" "}
                <span className="text-ink">{selected.syncConfig.syncFrequency}</span>
              </div>
              <div>
                Mode: <span className="text-ink">{selected.connectionMode}</span>
              </div>
            </dl>
          )}

          <Button
            type="button"
            disabled={!props.canManage || pending || !selectedId || !periodId}
            onClick={handleSync}
          >
            {pending ? "Syncing…" : "Sync expenses"}
          </Button>
        </section>
      )}

      {step === "history" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-ink">Sync history</h2>
            {selected && (
              <select
                className="rounded-sm border border-rule bg-canvas px-3 py-1.5 text-sm text-ink"
                value={selectedId || ""}
                onChange={(e) => selectConnection(e.target.value || null)}
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {providerLabel(c.provider)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!selected ? (
            <p className="text-sm text-ink-muted">Select a connection to view logs.</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-ink-muted">No sync runs yet.</p>
          ) : (
            <ul className="divide-y divide-rule rounded-md border border-rule">
              {logs.map((log) => (
                <li key={log.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-ink">
                      <span
                        className={cn(
                          "font-mono text-xs uppercase",
                          log.status === "success"
                            ? "text-signal"
                            : log.status === "partial"
                              ? "text-amber"
                              : "text-rust",
                        )}
                      >
                        {log.status}
                      </span>
                      <span className="ml-3 font-mono text-xs text-ink-muted">
                        {formatTs(log.createdAt)}
                      </span>
                    </p>
                    <p className="font-mono text-xs text-ink-muted">
                      {log.recordsProcessed} processed · {log.recordsFailed} failed
                      {log.syncDurationMs != null ? ` · ${log.syncDurationMs}ms` : ""}
                    </p>
                  </div>
                  {log.errors?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-rust">
                      {log.errors.slice(0, 5).map((err, i) => (
                        <li key={`${log.id}-err-${i}`}>
                          {err.message}
                          {err.recordId ? ` (${err.recordId})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
