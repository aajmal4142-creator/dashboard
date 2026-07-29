"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface AccountingConnection {
  id: string;
  provider: "xero" | "quickbooks";
  status: "pending" | "connected" | "failed" | "expired";
  connectedAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  syncErrorCount?: number;
  syncConfig?: {
    enableExpenseSync: boolean;
    enableBankFeedSync: boolean;
    enableAutoCateg: boolean;
    syncFrequency: string;
  };
}

type StatusMessage = { type: "success" | "error"; text: string };

export default function AccountingIntegrationPage() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<AccountingConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState("");
  const [actionMessage, setActionMessage] = useState<StatusMessage | null>(null);

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");
  const provider = searchParams.get("provider");

  const paramMessage: StatusMessage | null =
    connected === "true"
      ? {
          type: "success",
          text: `${provider ?? "Accounting"} connected successfully.`,
        }
      : error
        ? { type: "error", text: `Connection failed: ${error}` }
        : null;

  const message = actionMessage ?? paramMessage;

  const xeroConnection = connections.find((c) => c.provider === "xero");
  const qbConnection = connections.find((c) => c.provider === "quickbooks");

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch("/api/app/integrations/status");
        const data = await res.json();
        setConnections(data.accounting || []);
      } catch (err) {
        console.error("Failed to fetch connections:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConnections();
  }, []);

  const handleConnect = async (prov: "xero" | "quickbooks") => {
    try {
      const res = await fetch("/api/app/integrations/accounting/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: prov }),
      });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      setActionMessage({ type: "error", text: "Failed to initiate connection" });
    }
  };

  const handleSync = async (connectionId: string) => {
    if (!periodId) {
      setActionMessage({ type: "error", text: "Please select a reporting period" });
      return;
    }
    setSyncing(connectionId);
    try {
      const res = await fetch("/api/app/integrations/accounting/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, periodId }),
      });
      const data = await res.json();
      if (data.status === "success" || data.status === "partial") {
        setActionMessage({
          type: "success",
          text: `Sync completed: ${data.recordsProcessed} expenses processed`,
        });
        setConnections((conns) =>
          conns.map((c) =>
            c.id === connectionId ? { ...c, lastSyncAt: new Date().toISOString() } : c,
          ),
        );
      } else {
        setActionMessage({ type: "error", text: `Sync failed: ${data.error}` });
      }
    } catch {
      setActionMessage({ type: "error", text: "Failed to start sync" });
    } finally {
      setSyncing(null);
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
        <h1 className="mt-4 text-3xl font-bold">Accounting Integration</h1>
        <p className="mt-2 text-gray-600">
          Connect Xero or QuickBooks to sync expenses and calculate emissions
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

      {/* Xero Connection */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Xero</h2>

        {xeroConnection?.status === "connected" ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span className="font-medium text-green-700">Connected</span>
            </div>

            {xeroConnection.connectedAt && (
              <p className="text-sm text-gray-600">
                Connected at: {new Date(xeroConnection.connectedAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-gray-600">
              {xeroConnection?.status === "failed"
                ? `Connection failed: ${xeroConnection.lastSyncStatus}`
                : "Not connected. Click below to authorize Xero access."}
            </p>
            <button
              onClick={() => handleConnect("xero")}
              className="mt-4 rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
            >
              Connect to Xero
            </button>
          </div>
        )}
      </div>

      {/* QuickBooks Connection */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">QuickBooks Online</h2>

        {qbConnection?.status === "connected" ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span className="font-medium text-green-700">Connected</span>
            </div>

            {qbConnection.connectedAt && (
              <p className="text-sm text-gray-600">
                Connected at: {new Date(qbConnection.connectedAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-gray-600">
              {qbConnection?.status === "failed"
                ? `Connection failed: ${qbConnection.lastSyncStatus}`
                : "Not connected. Click below to authorize QuickBooks access."}
            </p>
            <button
              onClick={() => handleConnect("quickbooks")}
              className="mt-4 rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
            >
              Connect to QuickBooks
            </button>
          </div>
        )}
      </div>

      {connections.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Sync Expenses</h2>
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

            <div className="space-y-2">
              {connections.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => handleSync(conn.id)}
                  disabled={syncing === conn.id || !periodId}
                  className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {syncing === conn.id
                    ? `Syncing ${conn.provider}...`
                    : `Sync Expenses from ${conn.provider}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {connections.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Sync Configuration</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="expenses" defaultChecked disabled />
              <label htmlFor="expenses" className="text-sm">
                Sync expense data
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bankfeed"
                defaultChecked={connections[0]?.syncConfig?.enableBankFeedSync || false}
                disabled
              />
              <label htmlFor="bankfeed" className="text-sm">
                Sync bank feeds for utility bills (Xero only)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autocat"
                defaultChecked={connections[0]?.syncConfig?.enableAutoCateg}
                disabled
              />
              <label htmlFor="autocat" className="text-sm">
                Auto-categorize expenses by GL code
              </label>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium">Sync Frequency</label>
              <p className="mt-1 text-sm text-gray-600">
                {connections[0]?.syncConfig?.syncFrequency || "manual"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <h3 className="font-semibold text-yellow-900">Requirements</h3>
        <ul className="mt-2 space-y-1 text-sm text-yellow-800">
          <li>• Xero or QuickBooks Online account with API access</li>
          <li>• OAuth 2.0 configured for the accounting platform</li>
          <li>• Admin access to manage integrations in ClearESG</li>
          <li>• Expense categories mapped to GL codes</li>
        </ul>
      </div>
    </div>
  );
}
