"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface IntegrationStatus {
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
        <h1 className="text-3xl font-bold">Data Integrations</h1>
        <p className="mt-2 text-gray-600">
          Upload data via CSV, webhooks, or the manual data portal
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* CSV Import Card */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">CSV Import</h2>
              <p className="mt-1 text-sm text-gray-600">
                Upload emissions data via CSV files
              </p>
            </div>
            <div className="text-3xl">📁</div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-600">Supports scope 1, 2, and 3 emissions</p>
          </div>

          <button className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Upload CSV
          </button>
        </div>

        {/* Webhooks Card */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Webhooks</h2>
              <p className="mt-1 text-sm text-gray-600">
                Real-time data updates via webhooks
              </p>
            </div>
            <div className="text-3xl">🔄</div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-600">Set up custom webhook endpoints</p>
          </div>

          <button className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Configure
          </button>
        </div>

        {/* Manual Portal Card */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Manual Portal</h2>
              <p className="mt-1 text-sm text-gray-600">
                Enter data directly in the dashboard
              </p>
            </div>
            <div className="text-3xl">✋</div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-600">Forms for manual data entry</p>
          </div>

          <button className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Enter Data
          </button>
        </div>
      </div>

      {/* Accounting Integrations Section */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Accounting Software</h2>
        <p className="mt-2 text-sm text-gray-600 mb-4">
          Connect Xero or QuickBooks for automated spend-based emissions calculations
        </p>

        {status?.accounting.length ? (
          <div className="space-y-4">
            {status.accounting.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between border-t pt-4"
              >
                <div>
                  <p className="font-semibold capitalize">{acc.provider}</p>
                  <p className="text-sm text-gray-600">
                    Status:{" "}
                    <span
                      className={
                        acc.status === "connected" ? "text-green-600" : "text-yellow-600"
                      }
                    >
                      {acc.status}
                    </span>
                  </p>
                </div>
                <button className="rounded bg-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-300">
                  Manage
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No accounting integrations configured</p>
        )}

        <Link
          href="/integrations/accounting"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Connection
        </Link>
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
