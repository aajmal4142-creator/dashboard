"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Engine = "postgresql" | "mysql" | "bigquery" | "snowflake" | "databricks";
type WizardStep = "connect" | "map" | "schedule" | "history";

type PeriodOption = { id: string; label: string; status: string };

type ConnectionRow = {
  id: string;
  name: string;
  engine: Engine;
  status: string;
  displayHost: string | null;
  displayDatabase: string | null;
  sourceSchema: string | null;
  sourceTable: string | null;
  fieldMappings: FieldMappings | null;
  incrementalColumn: string | null;
  defaultPeriodId: string | null;
  syncFrequency: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  nextSyncAt: string | null;
  testedAt: string | null;
};

type FieldMappings = {
  columns: Array<{
    source: string;
    target: "metricKey" | "value" | "unit" | "quality" | "externalId" | "supplierId";
  }>;
  defaults?: {
    metricKey?: string;
    quality?: "measured" | "calculated" | "estimated" | "missing";
    unit?: string;
  };
};

type DiscoveredTable = {
  schema: string;
  name: string;
  columns: Array<{ name: string; dataType: string; nullable: boolean }>;
};

type SyncLog = {
  id: string;
  status: string;
  recordsProcessed: number;
  recordsFailed: number;
  syncDurationMs: number | null;
  triggeredBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errors: Array<{ message?: string | null; recordId?: string | null }>;
  createdAt: string;
};

const STEPS: WizardStep[] = ["connect", "map", "schedule", "history"];
const TARGETS = [
  "metricKey",
  "value",
  "unit",
  "quality",
  "externalId",
  "supplierId",
] as const;

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DatabaseWizardClient({
  canManage,
  periods,
}: {
  canManage: boolean;
  periods: PeriodOption[];
}) {
  const [step, setStep] = useState<WizardStep>("connect");
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tables, setTables] = useState<DiscoveredTable[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Connect form
  const [engine, setEngine] = useState<Engine>("postgresql");
  const [name, setName] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [ssl, setSsl] = useState(true);
  const [schema, setSchema] = useState("public");
  const [projectId, setProjectId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [sfAccount, setSfAccount] = useState("");
  const [sfWarehouse, setSfWarehouse] = useState("");
  const [sfRole, setSfRole] = useState("");
  const [dbWarehouseId, setDbWarehouseId] = useState("");
  const [dbCatalog, setDbCatalog] = useState("");
  const [dbToken, setDbToken] = useState("");

  // Mapping form
  const [sourceTable, setSourceTable] = useState("");
  const [sourceSchema, setSourceSchema] = useState("");
  const [defaultMetricKey, setDefaultMetricKey] = useState("");
  const [defaultUnit, setDefaultUnit] = useState("tCO2e");
  const [mapColumns, setMapColumns] = useState<FieldMappings["columns"]>([
    { source: "value", target: "value" },
  ]);
  const [incrementalColumn, setIncrementalColumn] = useState("");
  const [defaultPeriodId, setDefaultPeriodId] = useState(periods[0]?.id ?? "");
  const [syncFrequency, setSyncFrequency] = useState("manual");

  const selected = connections.find((c) => c.id === selectedId) ?? null;

  const loadConnections = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/database/connections");
        const data = (await res.json()) as {
          connections?: ConnectionRow[];
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Failed to load connections");
          return;
        }
        setConnections(data.connections ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load connections");
      }
    });
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      loadConnections();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadConnections]);

  function applyEngineDefaults(next: Engine) {
    setEngine(next);
    if (next === "postgresql") {
      setPort("5432");
      setSchema("public");
    } else if (next === "mysql") {
      setPort("3306");
      setSchema("");
    } else if (next === "snowflake") {
      setSchema("PUBLIC");
    } else if (next === "databricks") {
      setSchema("default");
      setHost("");
    }
  }

  function credentialPayload(): Record<string, unknown> {
    if (engine === "bigquery") {
      return {
        engine,
        projectId,
        datasetId,
        serviceAccountJson,
      };
    }
    if (engine === "snowflake") {
      return {
        engine,
        account: sfAccount,
        warehouse: sfWarehouse,
        database,
        schema: schema || "PUBLIC",
        user,
        passwordOrToken: password,
        role: sfRole || undefined,
      };
    }
    if (engine === "databricks") {
      return {
        engine,
        host,
        warehouseId: dbWarehouseId,
        token: dbToken || password,
        catalog: dbCatalog || undefined,
        schema: schema || "default",
      };
    }
    return {
      engine,
      host,
      port: Number(port),
      database,
      user,
      password,
      ssl,
      schema: schema || undefined,
    };
  }

  function testConnection() {
    startTransition(async () => {
      setError(null);
      setStatusMsg(null);
      try {
        const res = await fetch("/api/app/database/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentialPayload()),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Connection test failed");
          return;
        }
        setStatusMsg(data.message ?? "Connection succeeded");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection test failed");
      }
    });
  }

  function saveConnection() {
    startTransition(async () => {
      setError(null);
      setStatusMsg(null);
      try {
        const res = await fetch("/api/app/database/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name || `${engine} connection`,
            ...credentialPayload(),
            sourceSchema: schema || undefined,
            syncFrequency: "manual",
            defaultPeriodId: defaultPeriodId || undefined,
          }),
        });
        const data = (await res.json()) as {
          connection?: ConnectionRow;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Save failed");
          return;
        }
        setPassword("");
        setServiceAccountJson("");
        setDbToken("");
        setStatusMsg("Connection saved. Credentials encrypted at rest.");
        if (data.connection) {
          setSelectedId(data.connection.id);
          setSourceSchema(data.connection.sourceSchema ?? "");
          setConnections((prev) => [
            data.connection!,
            ...prev.filter((c) => c.id !== data.connection!.id),
          ]);
          setStep("map");
        }
        loadConnections();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function discoverTables(connectionId: string) {
    startTransition(async () => {
      setError(null);
      try {
        const q = sourceSchema ? `?schema=${encodeURIComponent(sourceSchema)}` : "";
        const res = await fetch(
          `/api/app/database/connections/${connectionId}/tables${q}`,
        );
        const data = (await res.json()) as {
          tables?: DiscoveredTable[];
          error?: string;
          hint?: string;
        };
        if (!res.ok) {
          setError([data.error, data.hint].filter(Boolean).join(" — "));
          return;
        }
        setTables(data.tables ?? []);
        setStatusMsg(`Discovered ${data.tables?.length ?? 0} tables`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Discovery failed");
      }
    });
  }

  function saveMapping() {
    if (!selectedId) return;
    startTransition(async () => {
      setError(null);
      setStatusMsg(null);
      const fieldMappings: FieldMappings = {
        columns: mapColumns.filter((c) => c.source.trim()),
        defaults: {
          metricKey: defaultMetricKey || undefined,
          unit: defaultUnit || undefined,
          quality: "measured",
        },
      };
      try {
        const res = await fetch(`/api/app/database/connections/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceTable: sourceTable || undefined,
            sourceSchema: sourceSchema || undefined,
            fieldMappings,
            incrementalColumn: incrementalColumn || null,
            defaultPeriodId: defaultPeriodId || null,
          }),
        });
        const data = (await res.json()) as {
          connection?: ConnectionRow;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Failed to save mapping");
          return;
        }
        setStatusMsg("Mapping saved");
        if (data.connection) {
          setConnections((prev) =>
            prev.map((c) => (c.id === data.connection!.id ? data.connection! : c)),
          );
        }
        setStep("schedule");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save mapping");
      }
    });
  }

  function saveSchedule() {
    if (!selectedId) return;
    startTransition(async () => {
      setError(null);
      setStatusMsg(null);
      try {
        const res = await fetch(`/api/app/database/connections/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ syncFrequency }),
        });
        const data = (await res.json()) as {
          connection?: ConnectionRow;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Failed to save schedule");
          return;
        }
        setStatusMsg("Schedule saved");
        if (data.connection) {
          setConnections((prev) =>
            prev.map((c) => (c.id === data.connection!.id ? data.connection! : c)),
          );
        }
        setStep("history");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save schedule");
      }
    });
  }

  function runSync() {
    if (!selectedId) return;
    startTransition(async () => {
      setError(null);
      setStatusMsg(null);
      try {
        const res = await fetch(`/api/app/database/connections/${selectedId}/sync`, {
          method: "POST",
        });
        const data = (await res.json()) as {
          status?: string;
          message?: string;
          error?: string;
          recordsProcessed?: number;
          recordsFailed?: number;
        };
        if (!res.ok && res.status !== 207) {
          setError(data.error ?? data.message ?? "Sync failed");
          return;
        }
        setStatusMsg(
          data.message ??
            `Sync ${data.status}: ${data.recordsProcessed ?? 0} processed, ${data.recordsFailed ?? 0} failed`,
        );
        loadLogs(selectedId);
        loadConnections();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sync failed");
      }
    });
  }

  function loadLogs(connectionId: string) {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/app/database/connections/${connectionId}/logs?limit=20`,
        );
        const data = (await res.json()) as { logs?: SyncLog[]; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load sync history");
          return;
        }
        setLogs(data.logs ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sync history");
      }
    });
  }

  function selectConnection(c: ConnectionRow) {
    setSelectedId(c.id);
    setSourceTable(c.sourceTable ?? "");
    setSourceSchema(c.sourceSchema ?? "");
    setIncrementalColumn(c.incrementalColumn ?? "");
    setDefaultPeriodId(c.defaultPeriodId ?? periods[0]?.id ?? "");
    setSyncFrequency(c.syncFrequency || "manual");
    if (c.fieldMappings?.columns?.length) {
      setMapColumns(c.fieldMappings.columns);
      setDefaultMetricKey(c.fieldMappings.defaults?.metricKey ?? "");
      setDefaultUnit(c.fieldMappings.defaults?.unit ?? "tCO2e");
    }
    setStep("map");
  }

  const selectedTable = tables.find(
    (t) => t.name === sourceTable && (!sourceSchema || t.schema === sourceSchema),
  );

  return (
    <div className="space-y-8">
      <nav
        className="flex flex-wrap gap-2 border-b border-rule pb-3"
        aria-label="Wizard steps"
      >
        {STEPS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={cn(
              "px-3 py-1.5 text-sm capitalize",
              step === s
                ? "border-b-2 border-accent text-ink"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {s}
          </button>
        ))}
      </nav>

      {error && (
        <div
          className="border border-rust bg-surface-1 px-4 py-3 text-sm text-ink"
          role="alert"
        >
          {error}
        </div>
      )}
      {statusMsg && (
        <div className="border border-rule bg-surface-1 px-4 py-3 text-sm text-ink-muted">
          {statusMsg}
        </div>
      )}

      {connections.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-ink">Saved connections</h2>
          <div className="title-rule mt-2" />
          <ul className="mt-4 divide-y divide-rule border border-rule">
            {connections.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
                  selectedId === c.id && "bg-surface-2",
                )}
              >
                <div>
                  <p className="text-sm text-ink">{c.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-ink-muted">
                    {c.engine} · {c.displayHost}/{c.displayDatabase} · {c.status}
                    {c.lastSyncAt ? ` · last sync ${formatTs(c.lastSyncAt)}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectConnection(c)}
                >
                  Configure
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "connect" && (
        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Connect</h2>
          <div className="title-rule mt-2" />
          {!canManage && (
            <p className="text-sm text-ink-muted">
              Admin role required to create or update database connections.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-ink-muted">Engine</span>
              <select
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-ink"
                value={engine}
                disabled={!canManage || pending}
                onChange={(e) => applyEngineDefaults(e.target.value as Engine)}
              >
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="bigquery">Google BigQuery</option>
                <option value="snowflake">Snowflake</option>
                <option value="databricks">Databricks</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">Name</span>
              <input
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-ink"
                value={name}
                disabled={!canManage || pending}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production warehouse"
              />
            </label>
          </div>

          {engine === "bigquery" ? (
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="text-ink-muted">GCP project id</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={projectId}
                  disabled={!canManage || pending}
                  onChange={(e) => setProjectId(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Dataset id</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={datasetId}
                  disabled={!canManage || pending}
                  onChange={(e) => setDatasetId(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Service account JSON</span>
                <textarea
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-xs text-ink"
                  rows={6}
                  value={serviceAccountJson}
                  disabled={!canManage || pending}
                  onChange={(e) => setServiceAccountJson(e.target.value)}
                  placeholder='{"type":"service_account",...}'
                  autoComplete="off"
                />
              </label>
            </div>
          ) : engine === "snowflake" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-ink-muted">Account</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={sfAccount}
                  disabled={!canManage || pending}
                  onChange={(e) => setSfAccount(e.target.value)}
                  placeholder="xy12345.us-east-1"
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Warehouse</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={sfWarehouse}
                  disabled={!canManage || pending}
                  onChange={(e) => setSfWarehouse(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Database</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={database}
                  disabled={!canManage || pending}
                  onChange={(e) => setDatabase(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Schema</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={schema}
                  disabled={!canManage || pending}
                  onChange={(e) => setSchema(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">User</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-ink"
                  value={user}
                  disabled={!canManage || pending}
                  onChange={(e) => setUser(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Password or token</span>
                <input
                  type="password"
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-ink"
                  value={password}
                  disabled={!canManage || pending}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-ink-muted">Role (optional)</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={sfRole}
                  disabled={!canManage || pending}
                  onChange={(e) => setSfRole(e.target.value)}
                />
              </label>
            </div>
          ) : engine === "databricks" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="text-ink-muted">Workspace host</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={host}
                  disabled={!canManage || pending}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="adb-….azuredatabricks.net"
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">SQL warehouse id</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={dbWarehouseId}
                  disabled={!canManage || pending}
                  onChange={(e) => setDbWarehouseId(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Personal access token</span>
                <input
                  type="password"
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-ink"
                  value={dbToken}
                  disabled={!canManage || pending}
                  onChange={(e) => setDbToken(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Catalog (optional)</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={dbCatalog}
                  disabled={!canManage || pending}
                  onChange={(e) => setDbCatalog(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Schema</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={schema}
                  disabled={!canManage || pending}
                  onChange={(e) => setSchema(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-ink-muted">Host</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={host}
                  disabled={!canManage || pending}
                  onChange={(e) => setHost(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Port</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={port}
                  disabled={!canManage || pending}
                  onChange={(e) => setPort(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Database</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={database}
                  disabled={!canManage || pending}
                  onChange={(e) => setDatabase(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Schema (optional)</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={schema}
                  disabled={!canManage || pending}
                  onChange={(e) => setSchema(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">User</span>
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={user}
                  disabled={!canManage || pending}
                  onChange={(e) => setUser(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Password</span>
                <input
                  type="password"
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                  value={password}
                  disabled={!canManage || pending}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={ssl}
                  disabled={!canManage || pending}
                  onChange={(e) => setSsl(e.target.checked)}
                />
                Require SSL/TLS
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canManage || pending}
              onClick={testConnection}
            >
              Test connection
            </Button>
            <Button
              type="button"
              disabled={!canManage || pending}
              onClick={saveConnection}
            >
              Test and save
            </Button>
          </div>
        </section>
      )}

      {step === "map" && (
        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Field mapping</h2>
          <div className="title-rule mt-2" />
          {!selectedId ? (
            <p className="text-sm text-ink-muted">Save or select a connection first.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canManage || pending}
                  onClick={() => discoverTables(selectedId)}
                >
                  Discover tables
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-ink-muted">Source schema</span>
                  <input
                    className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                    value={sourceSchema}
                    disabled={!canManage || pending}
                    onChange={(e) => setSourceSchema(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-ink-muted">Source table</span>
                  <select
                    className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                    value={sourceTable}
                    disabled={!canManage || pending}
                    onChange={(e) => {
                      setSourceTable(e.target.value);
                      const t = tables.find((x) => x.name === e.target.value);
                      if (t) setSourceSchema(t.schema);
                    }}
                  >
                    <option value="">Select table</option>
                    {tables.map((t) => (
                      <option key={`${t.schema}.${t.name}`} value={t.name}>
                        {t.schema}.{t.name}
                      </option>
                    ))}
                    {sourceTable && !tables.some((t) => t.name === sourceTable) && (
                      <option value={sourceTable}>{sourceTable}</option>
                    )}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-ink-muted">Default metric key</span>
                  <input
                    className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                    value={defaultMetricKey}
                    disabled={!canManage || pending}
                    onChange={(e) => setDefaultMetricKey(e.target.value)}
                    placeholder="scope1.stationary_combustion"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-ink-muted">Default unit</span>
                  <input
                    className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                    value={defaultUnit}
                    disabled={!canManage || pending}
                    onChange={(e) => setDefaultUnit(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-ink-muted">Reporting period</span>
                  <select
                    className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-ink"
                    value={defaultPeriodId}
                    disabled={!canManage || pending}
                    onChange={(e) => setDefaultPeriodId(e.target.value)}
                  >
                    <option value="">Select open period</option>
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-ink-muted">Incremental column (optional)</span>
                  <input
                    className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-ink"
                    value={incrementalColumn}
                    disabled={!canManage || pending}
                    onChange={(e) => setIncrementalColumn(e.target.value)}
                    placeholder="updated_at"
                    list="db-columns"
                  />
                </label>
              </div>

              {selectedTable && (
                <datalist id="db-columns">
                  {selectedTable.columns.map((c) => (
                    <option key={c.name} value={c.name} />
                  ))}
                </datalist>
              )}

              <div className="space-y-2">
                <p className="text-sm text-ink-muted">Column → datapoint field</p>
                {mapColumns.map((row, i) => (
                  <div key={i} className="flex flex-wrap gap-2">
                    <input
                      className="min-w-[8rem] flex-1 border border-rule bg-surface-1 px-3 py-2 font-mono text-sm text-ink"
                      value={row.source}
                      list="db-columns"
                      disabled={!canManage || pending}
                      onChange={(e) => {
                        const next = [...mapColumns];
                        next[i] = { ...next[i], source: e.target.value };
                        setMapColumns(next);
                      }}
                      placeholder="source column"
                    />
                    <select
                      className="border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                      value={row.target}
                      disabled={!canManage || pending}
                      onChange={(e) => {
                        const next = [...mapColumns];
                        next[i] = {
                          ...next[i],
                          target: e.target.value as (typeof TARGETS)[number],
                        };
                        setMapColumns(next);
                      }}
                    >
                      {TARGETS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canManage || pending || mapColumns.length <= 1}
                      onClick={() => setMapColumns(mapColumns.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canManage || pending}
                  onClick={() =>
                    setMapColumns([...mapColumns, { source: "", target: "metricKey" }])
                  }
                >
                  Add mapping
                </Button>
              </div>

              <Button
                type="button"
                disabled={!canManage || pending}
                onClick={saveMapping}
              >
                Save mapping
              </Button>
            </>
          )}
        </section>
      )}

      {step === "schedule" && (
        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Schedule</h2>
          <div className="title-rule mt-2" />
          {!selectedId ? (
            <p className="text-sm text-ink-muted">Select a connection first.</p>
          ) : (
            <>
              <label className="block max-w-sm text-sm">
                <span className="text-ink-muted">Sync frequency</span>
                <select
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-ink"
                  value={syncFrequency}
                  disabled={!canManage || pending}
                  onChange={(e) => setSyncFrequency(e.target.value)}
                >
                  <option value="manual">Manual only</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
              <p className="text-sm text-ink-muted">
                Scheduled runs use{" "}
                <span className="font-mono">/api/cron/database-sync</span> (hourly cron).
                nextSyncAt on the connection gates due work.
              </p>
              {selected?.nextSyncAt && (
                <p className="font-mono text-sm text-ink-muted">
                  Next sync: {formatTs(selected.nextSyncAt)}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={!canManage || pending}
                  onClick={saveSchedule}
                >
                  Save schedule
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canManage || pending}
                  onClick={runSync}
                >
                  Run sync now
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {step === "history" && (
        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Sync history</h2>
          <div className="title-rule mt-2" />
          {!selectedId ? (
            <p className="text-sm text-ink-muted">Select a connection first.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => loadLogs(selectedId)}
                >
                  Refresh
                </Button>
                <Button type="button" disabled={!canManage || pending} onClick={runSync}>
                  Run sync now
                </Button>
              </div>
              {selected?.lastError && (
                <p className="border border-rust bg-surface-1 px-4 py-3 text-sm text-ink">
                  Last error: {selected.lastError}
                </p>
              )}
              {logs.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No sync runs yet. Trigger a sync from Schedule or here.
                </p>
              ) : (
                <ul className="divide-y divide-rule border border-rule">
                  {logs.map((log) => (
                    <li key={log.id} className="px-4 py-3">
                      <p className="text-sm text-ink">
                        <span className="capitalize">{log.status}</span>
                        {" · "}
                        <span className="font-mono">
                          {log.recordsProcessed} ok / {log.recordsFailed} failed
                        </span>
                        {log.syncDurationMs != null && (
                          <span className="font-mono text-ink-muted">
                            {" "}
                            · {log.syncDurationMs} ms
                          </span>
                        )}
                      </p>
                      <p className="mt-1 font-mono text-xs text-ink-muted">
                        {formatTs(log.startedAt ?? log.createdAt)} ·{" "}
                        {log.triggeredBy ?? "—"}
                      </p>
                      {log.errors?.[0]?.message && (
                        <p className="mt-1 text-xs text-rust">{log.errors[0].message}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
