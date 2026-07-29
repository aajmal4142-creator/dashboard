"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface SalesforceConnection {
  id: string;
  status: "pending" | "connected" | "failed" | "expired";
  instanceUrl?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  syncErrorCount?: number;
  syncConfig?: {
    enableAccountSync: boolean;
    enableContactSync: boolean;
    enableMetricsWrite: boolean;
    syncFrequency: string;
  };
}

type StatusMessage = { type: "success" | "error"; text: string };

export default function SalesforceIntegrationPage() {
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<SalesforceConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionMessage, setActionMessage] = useState<StatusMessage | null>(null);

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  const paramMessage: StatusMessage | null =
    connected === "true"
      ? { type: "success", text: "Salesforce connected successfully." }
      : error
        ? { type: "error", text: `Connection failed: ${error}` }
        : null;

  const message = actionMessage ?? paramMessage;

  useEffect(() => {
    const fetchConnection = async () => {
      try {
        const res = await fetch("/api/app/integrations/status");
        const data = await res.json();
        if (data.salesforce.length > 0) {
          setConnection(data.salesforce[0]);
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
      const res = await fetch("/api/app/integrations/salesforce/auth", {
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
    if (!connection?.id) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/app/integrations/salesforce/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setActionMessage({
          type: "success",
          text: `Sync completed: ${data.recordsProcessed} records processed`,
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
        <h1 className="mt-4 text-3xl font-bold">Salesforce Integration</h1>
        <p className="mt-2 text-gray-600">
          Sync accounts, contacts, and ESG metrics with Salesforce
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

            {connection.instanceUrl && (
              <p className="text-sm text-gray-600">
                Instance: <span className="font-mono">{connection.instanceUrl}</span>
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

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-gray-600">
              {connection?.status === "failed"
                ? `Connection failed: ${connection.lastSyncStatus}`
                : "Not connected. Click below to authorize Salesforce access."}
            </p>
            <button
              onClick={handleConnect}
              className="mt-4 rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
            >
              Connect to Salesforce
            </button>
          </div>
        )}
      </div>

      {connection?.status === "connected" && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Sync Configuration</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="accounts"
                defaultChecked={connection.syncConfig?.enableAccountSync}
                disabled
              />
              <label htmlFor="accounts" className="text-sm">
                Sync Salesforce Accounts as supplier organizations
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="contacts"
                defaultChecked={connection.syncConfig?.enableContactSync}
                disabled
              />
              <label htmlFor="contacts" className="text-sm">
                Sync contact data to ClearESG teams
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="metrics"
                defaultChecked={connection.syncConfig?.enableMetricsWrite}
                disabled
              />
              <label htmlFor="metrics" className="text-sm">
                Write ESG metrics back to Salesforce records
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
      )}

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <h3 className="font-semibold text-yellow-900">Requirements</h3>
        <ul className="mt-2 space-y-1 text-sm text-yellow-800">
          <li>• Salesforce account with API access enabled</li>
          <li>• Connected App created with OAuth scopes: api, refresh_token</li>
          <li>• Admin access to manage integrations in ClearESG</li>
        </ul>
      </div>
    </div>
  );
}
