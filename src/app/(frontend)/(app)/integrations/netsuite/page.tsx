"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface NetSuiteConnection {
  id: string;
  status: "pending" | "connected" | "failed" | "expired";
  accountId?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  syncErrorCount?: number;
  syncConfig?: {
    enableGlSync: boolean;
    enableInvoiceSync: boolean;
    enableSpendCalculation: boolean;
    syncFrequency: string;
  };
}

type StatusMessage = { type: "success" | "error"; text: string };

export default function NetSuiteIntegrationPage() {
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<NetSuiteConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [periodId, setPeriodId] = useState("");
  const [actionMessage, setActionMessage] = useState<StatusMessage | null>(null);

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  const paramMessage: StatusMessage | null =
    connected === "true"
      ? { type: "success", text: "NetSuite connected successfully." }
      : error
        ? { type: "error", text: `Connection failed: ${error}` }
        : null;

  const message = actionMessage ?? paramMessage;

  useEffect(() => {
    const fetchConnection = async () => {
      try {
        const res = await fetch("/api/app/integrations/status");
        const data = await res.json();
        if (data.netsuite.length > 0) {
          setConnection(data.netsuite[0]);
        }
      } catch (err) {
        console.error("Failed to fetch connection:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConnection();
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/app/integrations/netsuite/auth", {
        method: "POST",
      });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      setActionMessage({ type: "error", text: "Failed to initiate connection" });
    }
  };

  const handleSync = async () => {
    if (!connection?.id || !periodId) {
      setActionMessage({ type: "error", text: "Please select a reporting period" });
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/app/integrations/netsuite/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id, periodId }),
      });
      const data = await res.json();
      if (data.status === "success" || data.status === "partial") {
        setActionMessage({
          type: "success",
          text: `Sync completed: ${data.recordsProcessed} GL records processed`,
        });
        setConnection((c) => (c ? { ...c, lastSyncAt: new Date().toISOString() } : null));
      } else {
        setActionMessage({ type: "error", text: `Sync failed: ${data.error}` });
      }
    } catch {
      setActionMessage({ type: "error", text: "Failed to start sync" });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <Link href="/integrations" className="text-blue-600 hover:underline">
          ← Back to Integrations
        </Link>
        <h1 className="mt-4 text-3xl font-bold">NetSuite Integration</h1>
        <p className="mt-2 text-gray-600">
          Sync General Ledger data and calculate spend-based emissions
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Connection Status</h2>

        {connection && connection.status === "connected" ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span className="font-medium text-green-700">Connected</span>
            </div>

            {connection.accountId && (
              <p className="text-sm text-gray-600">
                Account: <span className="font-mono">{connection.accountId}</span>
              </p>
            )}

            {connection.connectedAt && (
              <p className="text-sm text-gray-600">
                Connected at: {new Date(connection.connectedAt).toLocaleString()}
              </p>
            )}

            {connection.lastSyncAt && (
              <p className="text-sm text-gray-600">
                Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-gray-600">
              {connection?.status === "failed"
                ? `Connection failed: ${connection.lastSyncStatus}`
                : "Not connected. Click below to authorize NetSuite access."}
            </p>
            <button
              onClick={handleConnect}
              className="mt-4 rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
            >
              Connect to NetSuite
            </button>
          </div>
        )}
      </div>

      {connection?.status === "connected" && (
        <>
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">GL Code Mapping</h2>
            <p className="mt-2 text-sm text-gray-600">
              Map NetSuite GL codes to emissions categories to calculate spend-based
              emissions
            </p>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                Configure GL code mappings in the admin panel to enable automatic
                emissions calculations
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Sync GL Data</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="period" className="block text-sm font-medium">
                  Reporting Period
                </label>
                <input
                  type="text"
                  id="period"
                  placeholder="Period ID (e.g., 2024-Q1)"
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <button
                onClick={handleSync}
                disabled={syncing || !periodId}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {syncing ? "Syncing..." : "Sync GL Data"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Sync Configuration</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="gl"
                  defaultChecked={connection.syncConfig?.enableGlSync}
                  disabled
                />
                <label htmlFor="gl" className="text-sm">
                  Sync General Ledger balances
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="invoices"
                  defaultChecked={connection.syncConfig?.enableInvoiceSync}
                  disabled
                />
                <label htmlFor="invoices" className="text-sm">
                  Sync invoices and purchase orders
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="spend"
                  defaultChecked={connection.syncConfig?.enableSpendCalculation}
                  disabled
                />
                <label htmlFor="spend" className="text-sm">
                  Calculate spend-based emissions
                </label>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium">Sync Frequency</label>
                <p className="mt-1 text-sm text-gray-600">
                  {connection.syncConfig?.syncFrequency || "manual"}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <h3 className="font-semibold text-yellow-900">Requirements</h3>
        <ul className="mt-2 space-y-1 text-sm text-yellow-800">
          <li>• NetSuite account with REST API access enabled</li>
          <li>• OAuth 2.0 configured in NetSuite</li>
          <li>• Admin access to manage integrations in ClearESG</li>
        </ul>
      </div>
    </div>
  );
}
