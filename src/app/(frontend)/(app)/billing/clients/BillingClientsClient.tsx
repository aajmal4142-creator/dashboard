"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { type ClientUsageRow, type ClientsUsageRollup } from "@/lib/consultant";
import { cn } from "@/lib/utils";

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function Mono({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("font-mono tabular-nums", className)}>{children}</span>;
}

export function BillingClientsClient({ consultancyName }: { consultancyName: string }) {
  const [rollup, setRollup] = useState<ClientsUsageRollup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/billing/clients/usage");
      const body = (await res.json()) as { rollup?: ClientsUsageRollup; error?: string };
      if (!res.ok || !body.rollup) {
        setError(body.error ?? "Could not load client billing rollup");
        setRollup(null);
        return;
      }
      setRollup(body.rollup);
    } catch {
      setError("Could not reach the client billing API");
      setRollup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      startTransition(() => {
        void load();
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function downloadCsv() {
    const res = await fetch("/api/app/billing/clients/usage?format=csv");
    if (!res.ok) {
      setStatusMsg({ tone: "error", text: "Could not download CSV." });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "client-billing-rollup.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generateInvoice(client: ClientUsageRow) {
    setBusyId(client.id);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/app/billing/clients/${client.id}/invoice`, {
        method: "POST",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatusMsg({
          tone: "error",
          text: body.error ?? `Could not generate an invoice for ${client.name}.`,
        });
        return;
      }
      setStatusMsg({
        tone: "ok",
        text: `Draft invoice created for ${client.name}. Review it under Billing → Invoices.`,
      });
    } catch {
      setStatusMsg({ tone: "error", text: "Network error generating invoice." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageFrame
      eyebrow="Billing"
      title="Client billing"
      help="Per-client seats and usage across every organisation this consultancy manages. Generate a draft invoice when a client has a subscription, or export the rollup as CSV."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
          <button
            type="button"
            onClick={() => void downloadCsv()}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule px-3 text-[13px] text-ink hover:border-rule-strong"
          >
            Export CSV
          </button>
          <Link
            href="/billing/invoices"
            className="inline-flex h-8 items-center rounded-[4px] border border-rule px-3 text-[13px] text-ink hover:border-rule-strong"
          >
            Invoices
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}
        {statusMsg ? (
          <StatusLine tone={statusMsg.tone}>{statusMsg.text}</StatusLine>
        ) : null}
        {loading ? <PageSkeleton /> : null}

        {!loading && rollup && rollup.clients.length === 0 ? (
          <EmptyState
            title="No client organisations yet"
            body="Invite a client from Command Centre to see their seats and usage here."
          />
        ) : null}

        {rollup && rollup.clients.length > 0 ? (
          <>
            <div className="grid gap-4 border-b border-rule pb-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Clients
                </p>
                <p className="mt-1 text-2xl text-ink">
                  <Mono>{rollup.totals.clientCount}</Mono>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  With subscription
                </p>
                <p className="mt-1 text-2xl text-ink">
                  <Mono>{rollup.totals.clientsWithSubscription}</Mono>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Paid seats
                </p>
                <p className="mt-1 text-2xl text-ink">
                  <Mono>{rollup.totals.totalSeatsPaid}</Mono>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Active members
                </p>
                <p className="mt-1 text-2xl text-ink">
                  <Mono>{rollup.totals.totalMembersActive}</Mono>
                </p>
              </div>
            </div>

            <PageCard title={`${consultancyName} — clients`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-rule text-[11px] text-ink-muted">
                      <th className="py-2 pr-3 font-normal">Client</th>
                      <th className="py-2 pr-3 font-normal">Plan</th>
                      <th className="py-2 pr-3 font-normal text-right">Seats paid</th>
                      <th className="py-2 pr-3 font-normal text-right">Active members</th>
                      <th className="py-2 pr-3 font-normal text-right">Periods used</th>
                      <th className="py-2 pr-3 font-normal text-right">Suppliers used</th>
                      <th className="py-2 pr-3 font-normal">Subscription</th>
                      <th className="py-2 font-normal"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollup.clients.map((c) => (
                      <tr key={c.id} className="border-b border-rule">
                        <td className="py-2.5 pr-3 text-ink">{c.name}</td>
                        <td className="py-2.5 pr-3 text-ink-muted">
                          {PLAN_LIMITS[c.plan].label}
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <Mono>
                            {c.seatsPaid === null ? "—" : formatNum(c.seatsPaid)}
                          </Mono>
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <Mono>{formatNum(c.membersActive)}</Mono>
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <Mono>
                            {formatNum(c.usage.periods.used)}
                            {c.usage.periods.max === null
                              ? " / ∞"
                              : ` / ${c.usage.periods.max}`}
                          </Mono>
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <Mono>
                            {formatNum(c.usage.suppliers.used)}
                            {c.usage.suppliers.max === null
                              ? " / ∞"
                              : ` / ${c.usage.suppliers.max}`}
                          </Mono>
                        </td>
                        <td className="py-2.5 pr-3">
                          {c.subscriptionId ? (
                            <span className="text-signal">{c.subscriptionStatus}</span>
                          ) : (
                            <span className="text-ink-muted">none</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyId === c.id || !c.subscriptionId}
                            onClick={() => void generateInvoice(c)}
                            title={
                              c.subscriptionId
                                ? "Create a draft invoice from this row"
                                : "No subscription on this client — export CSV instead"
                            }
                          >
                            {busyId === c.id ? "Generating…" : "Generate invoice"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PageCard>
          </>
        ) : null}
      </div>
    </PageFrame>
  );
}
