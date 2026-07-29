"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface IntegrationStatus {
  salesforce: Array<{ id: string; status: string; lastSyncAt?: string }>;
  netsuite: Array<{ id: string; status: string; lastSyncAt?: string }>;
  accounting: Array<{
    id: string;
    provider: string;
    status: string;
    lastSyncAt?: string;
  }>;
}

export default function IntegrationsPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/app/integrations/status");
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error("Failed to fetch integration status:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, []);

  if (loading) {
    return <div className="p-8">Loading integrations...</div>;
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Enterprise Integrations</h1>
        <p className="mt-2 text-gray-600">
          Connect ClearESG with Salesforce, NetSuite, and accounting systems
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Salesforce Card */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Salesforce</h2>
              <p className="mt-1 text-sm text-gray-600">
                Sync accounts, contacts, and ESG metrics
              </p>
            </div>
            <div className="text-3xl">☁️</div>
          </div>

          <div className="mt-4 space-y-2">
            {status?.salesforce.length ? (
              <>
                <p className="text-sm">
                  Status:{" "}
                  <span
                    className={`font-semibold ${
                      status.salesforce[0].status === "connected"
                        ? "text-green-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {status.salesforce[0].status}
                  </span>
                </p>
                {status.salesforce[0].lastSyncAt && (
                  <p className="text-xs text-gray-500">
                    Last sync:{" "}
                    {new Date(status.salesforce[0].lastSyncAt).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Not connected</p>
            )}
          </div>

          <Link
            href="/integrations/salesforce"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Configure
          </Link>
        </div>

        {/* NetSuite Card */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">NetSuite</h2>
              <p className="mt-1 text-sm text-gray-600">
                Sync GL balances and calculate spend-based emissions
              </p>
            </div>
            <div className="text-3xl">📊</div>
          </div>

          <div className="mt-4 space-y-2">
            {status?.netsuite.length ? (
              <>
                <p className="text-sm">
                  Status:{" "}
                  <span
                    className={`font-semibold ${
                      status.netsuite[0].status === "connected"
                        ? "text-green-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {status.netsuite[0].status}
                  </span>
                </p>
                {status.netsuite[0].lastSyncAt && (
                  <p className="text-xs text-gray-500">
                    Last sync: {new Date(status.netsuite[0].lastSyncAt).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Not connected</p>
            )}
          </div>

          <Link
            href="/integrations/netsuite"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Configure
          </Link>
        </div>

        {/* Accounting Card */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Accounting</h2>
              <p className="mt-1 text-sm text-gray-600">
                Connect Xero or QuickBooks for expense syncing
              </p>
            </div>
            <div className="text-3xl">💰</div>
          </div>

          <div className="mt-4 space-y-2">
            {status?.accounting.length ? (
              <>
                <p className="text-sm">
                  Providers:{" "}
                  <span className="font-semibold">
                    {status.accounting.map((a) => a.provider).join(", ")}
                  </span>
                </p>
                {status.accounting[0].lastSyncAt && (
                  <p className="text-xs text-gray-500">
                    Last sync:{" "}
                    {new Date(status.accounting[0].lastSyncAt).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Not connected</p>
            )}
          </div>

          <Link
            href="/integrations/accounting"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Configure
          </Link>
        </div>
      </div>

      {/* Sync Logs Section */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Recent Sync Activity</h2>
        <p className="mt-2 text-sm text-gray-600">
          Integration sync logs are available in the admin panel under Integration Sync
          Logs
        </p>
      </div>
    </div>
  );
}
