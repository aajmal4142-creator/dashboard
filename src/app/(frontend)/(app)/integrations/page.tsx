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
    return <div className="p-8 text-ink-muted">Loading integrations...</div>;
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Data Integrations
        </h1>
        <p className="mt-2 text-ink-muted">
          Upload data via CSV, webhooks, or the manual data portal
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">CSV Import</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Upload emissions data via CSV files
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm text-ink-muted">Supports scope 1, 2, and 3 emissions</p>
          </div>

          <Link
            href="/data"
            className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Upload CSV
          </Link>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Webhooks</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Real-time data updates via webhooks
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm text-ink-muted">Set up custom webhook endpoints</p>
          </div>

          <Link
            href="/integrations/webhooks"
            className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Configure
          </Link>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Manual Portal</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Enter data directly in the dashboard
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm text-ink-muted">Forms for manual data entry</p>
          </div>

          <Link
            href="/data"
            className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Enter Data
          </Link>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold text-ink">Accounting Software</h2>
        <p className="mt-2 mb-4 text-sm text-ink-muted">
          Connect QuickBooks, Xero, or Wave for automated spend-based emissions (sandbox
          OAuth when client secrets are unset)
        </p>

        {status?.accounting.length ? (
          <div className="space-y-4">
            {status.accounting.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between border-t border-rule pt-4"
              >
                <div>
                  <p className="font-semibold capitalize text-ink">{acc.provider}</p>
                  <p className="text-sm text-ink-muted">
                    Status:{" "}
                    <span
                      className={
                        acc.status === "connected" ? "text-signal" : "text-amber"
                      }
                    >
                      {acc.status}
                    </span>
                  </p>
                </div>
                <Link
                  href="/integrations/accounting"
                  className="rounded-md bg-surface-2 px-4 py-2 text-sm font-medium text-ink hover:bg-accent-quiet"
                >
                  Manage
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No accounting integrations configured</p>
        )}

        <Link
          href="/integrations/accounting"
          className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
        >
          Add Connection
        </Link>
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold text-ink">IoT / meters</h2>
        <p className="mt-2 mb-4 text-sm text-ink-muted">
          Real-time meter ingest with device API keys, multi-gateway hubs, online status,
          and 24-hour charts. Credentials encrypted at rest.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/iot"
            className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Open IoT dashboard
          </Link>
          <Link
            href="/integrations/iot/gateways"
            className="inline-block rounded-md bg-surface-2 px-4 py-2 text-sm font-medium text-ink hover:bg-accent-quiet"
          >
            Manage gateways
          </Link>
          <Link
            href="/integrations/iot/devices"
            className="inline-block rounded-md bg-surface-2 px-4 py-2 text-sm font-medium text-ink hover:bg-accent-quiet"
          >
            Device assignment
          </Link>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold text-ink">Database connectors</h2>
        <p className="mt-2 mb-4 text-sm text-ink-muted">
          PostgreSQL, MySQL, and BigQuery with encrypted credentials, field mapping, and
          scheduled sync into datapoints
        </p>
        <Link
          href="/database"
          className="mt-2 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
        >
          Open database connectors
        </Link>
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold text-ink">Recent Sync Activity</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Integration sync logs are available in the admin panel under Integration Sync
          Logs
        </p>
      </div>
    </div>
  );
}
