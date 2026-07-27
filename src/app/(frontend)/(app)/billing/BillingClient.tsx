"use client";

import { useState } from "react";

import { PageCard, PageFrame, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import type { MembershipRole } from "@/lib/access/membership";
import { PLAN_LIMITS, type PlanId } from "@/lib/billing/plans";
import type { UsageMeters } from "@/lib/billing/usage";
import { subscriptionStatusLabel } from "@/lib/ui/displayLabels";

type BillingState = {
  plan: PlanId;
  subscriptionStatus: string;
  usage: UsageMeters;
};

function Meter({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number | null;
}) {
  const pct =
    max === null || max === 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  const near = max !== null && used / max >= 0.8;
  return (
    <div className="border-t border-rule py-3 first:border-t-0 first:pt-0">
      <div className="mb-2 flex justify-between text-[13px]">
        <span className="text-ink-muted">{label}</span>
        <span className="font-data text-ink">
          {used}
          {max === null ? " / ∞" : ` / ${max}`}
        </span>
      </div>
      <div className="h-1.5 rounded-[2px] bg-surface-2">
        <div
          className={`h-1.5 rounded-[2px] ${near ? "bg-amber" : "bg-signal"}`}
          style={{ width: max === null ? "8%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function BillingClient({
  initial,
  role = null,
}: {
  initial: BillingState;
  role?: MembershipRole | null;
}) {
  const [state, setState] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [busy, setBusy] = useState(false);
  const canManage = role === null ? true : role === "owner" || role === "admin";
  const readOnlyNonOwner = role !== null && role !== "owner" && role !== "admin";

  async function checkout(plan: Exclude<PlanId, "free">) {
    if (!canManage) {
      setStatusTone("error");
      setStatus("Only an owner or admin can change the plan.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/app/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string; mode?: string };
      if (!res.ok || !data.url) {
        const raw = data.error ?? "Checkout failed";
        setStatusTone("error");
        setStatus(
          raw === "Forbidden"
            ? "You do not have permission to change billing. Ask an owner."
            : raw,
        );
        return;
      }
      window.location.assign(data.url);
    } finally {
      setBusy(false);
    }
  }

  async function portal() {
    if (!canManage) {
      setStatusTone("error");
      setStatus("Only an owner or admin can open the billing portal.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/app/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        const raw = data.error ?? "Portal unavailable";
        setStatusTone("error");
        setStatus(
          raw === "Forbidden"
            ? "You do not have permission to manage billing. Ask an owner."
            : raw,
        );
        return;
      }
      window.location.assign(data.url);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const res = await fetch("/api/app/billing/usage");
    if (!res.ok) return;
    const data = (await res.json()) as BillingState;
    setState(data);
  }

  return (
    <PageFrame
      eyebrow="Billing"
      title="Plan & usage"
      help="Free includes full calculation. Paid plans unlock clean PDF export, extra periods, evidence storage, and consultant tools."
      actions={
        readOnlyNonOwner ? (
          <p className="text-[13px] text-ink-muted">
            Read-only — ask an owner to upgrade
          </p>
        ) : undefined
      }
      rail={
        <div className="space-y-3 text-[13px] text-ink-muted">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
            Current
          </p>
          <p className="font-data text-[22px] font-bold text-ink">
            {PLAN_LIMITS[state.plan].label}
            {PLAN_LIMITS[state.plan].priceEur > 0
              ? ` · €${PLAN_LIMITS[state.plan].priceEur}/mo`
              : ""}
          </p>
          <p className="font-data text-[11px]">
            {subscriptionStatusLabel(state.subscriptionStatus)}
          </p>
          {state.usage.watermarkedPdf ? (
            <p className="text-amber">
              PDFs are watermarked on Free. Upgrade to Pro for a clean export.
            </p>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

        {readOnlyNonOwner ? (
          <StatusLine tone="neutral">
            Plan changes and the Stripe portal are limited to owners and admins. You can
            still review usage below.
          </StatusLine>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void portal()}
            >
              Manage billing
            </Button>
          ) : null}
        </div>

        <PageCard title="Usage">
          <Meter
            label="Reporting periods"
            used={state.usage.periods.used}
            max={state.usage.periods.max}
          />
          <Meter
            label="Suppliers"
            used={state.usage.suppliers.used}
            max={state.usage.suppliers.max}
          />
          {state.plan !== "free" &&
          (state.usage.clients.max === null || state.usage.clients.max > 0) ? (
            <Meter
              label="Clients"
              used={state.usage.clients.used}
              max={state.usage.clients.max}
            />
          ) : null}
        </PageCard>

        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ["pro", "Unlimited periods, clean PDF, evidence vault, 10 suppliers"],
              [
                "consultant",
                "Everything in Pro + white-label, bulk nudge, 10 clients (+€15/client after)",
              ],
            ] as const
          ).map(([plan, blurb]) => (
            <PageCard key={plan} title={PLAN_LIMITS[plan].label}>
              <p className="font-data text-[22px] font-bold text-ink">
                €{PLAN_LIMITS[plan].priceEur}/mo
              </p>
              <p className="mt-2 text-[13px] text-ink-muted">{blurb}</p>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  disabled={busy || state.plan === plan}
                  onClick={() => void checkout(plan)}
                >
                  {state.plan === plan
                    ? "Current"
                    : `Upgrade to ${PLAN_LIMITS[plan].label}`}
                </Button>
              ) : (
                <p className="mt-4 text-[13px] text-ink-muted">
                  {state.plan === plan ? "Current plan" : "Ask an owner to upgrade"}
                </p>
              )}
            </PageCard>
          ))}
        </div>
      </div>
    </PageFrame>
  );
}
