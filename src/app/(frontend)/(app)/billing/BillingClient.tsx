"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PageCard, PageFrame, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import type { MembershipRole } from "@/lib/access/membership";
import {
  ANNUAL_DISCOUNT_LABEL,
  CHECKOUT_PLAN_IDS,
  formatUsdAnnual,
  formatUsdMonthly,
  PLAN_LIMITS,
  type CheckoutPlanId,
  type PlanId,
} from "@/lib/billing/plans";
import type { UsageMeters } from "@/lib/billing/usage";
import { subscriptionStatusLabel } from "@/lib/ui/displayLabels";

type BillingState = {
  plan: PlanId;
  subscriptionStatus: string;
  usage: UsageMeters;
};

type PlanPricing = {
  planId: string;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  annualDiscountPercentage: number;
  seats: number;
  billingCycle: "monthly" | "annual";
  volumeTiers: Array<{ minSeats: number; discountPercent: number; label: string }>;
  volumeDiscountPercent: number;
};

type ContractState = {
  contractTermYears: "1" | "2" | "3" | null;
  contractEndsAt: string | null;
  multiYearDiscountPercent: number | null;
  trialEndsAt: string | null;
  trialExtensionCount: number;
};

type DunningState = {
  status: string;
  nextRetryAt: string | null;
  failureReason: string | null;
  manualPaymentLink: string | null;
};

type ProvidersState = {
  activeProvider: "stripe" | "razorpay";
  currency: "INR" | "EUR" | "USD";
  razorpay: { configured: boolean };
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
  planPricing = null,
  dunning = null,
  contract = null,
  isConsultancy = false,
}: {
  initial: BillingState;
  role?: MembershipRole | null;
  planPricing?: PlanPricing | null;
  dunning?: DunningState | null;
  contract?: ContractState | null;
  isConsultancy?: boolean;
}) {
  const [state, setState] = useState(initial);
  const [cycle, setCycle] = useState<"monthly" | "annual">(
    planPricing?.billingCycle ?? "monthly",
  );
  const [contractState, setContractState] = useState<ContractState | null>(contract);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [busy, setBusy] = useState(false);
  const [prorataConfirm, setProrataConfirm] = useState<{
    amount: number;
    message: string;
    newBillingCycle: "monthly" | "annual";
  } | null>(null);
  const [providers, setProviders] = useState<ProvidersState | null>(null);
  const canManage = role === null ? true : role === "owner" || role === "admin";
  const readOnlyNonOwner = role !== null && role !== "owner" && role !== "admin";
  const isTrialing = state.subscriptionStatus === "trialing";
  const extensionsLeft = Math.max(0, 2 - (contractState?.trialExtensionCount ?? 0));

  useEffect(() => {
    let active = true;
    fetch("/api/app/billing/providers")
      .then((res) => (res.ok ? (res.json() as Promise<ProvidersState>) : null))
      .then((data) => {
        if (active && data) setProviders(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const showInrBanner =
    providers !== null &&
    (providers.currency === "INR" || providers.activeProvider === "razorpay");

  async function checkout(plan: CheckoutPlanId) {
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

  async function switchCycle(
    newBillingCycle: "monthly" | "annual",
    confirmProrata = false,
  ) {
    if (!canManage) {
      setStatusTone("error");
      setStatus("Only an owner or admin can switch billing cycle.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/app/billing/subscriptions/switch-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newBillingCycle, confirmProrata }),
      });
      const data = (await res.json()) as {
        error?: string;
        confirmationRequired?: boolean;
        prorataAmount?: number;
        message?: string;
        billingCycle?: string;
      };
      if (res.status === 200 && data.confirmationRequired) {
        setProrataConfirm({
          amount: data.prorataAmount ?? 0,
          message: data.message ?? "Confirm prorata charge to switch cycle.",
          newBillingCycle,
        });
        setStatusTone("neutral");
        setStatus(data.message ?? "Confirm prorata to continue.");
        return;
      }
      if (!res.ok) {
        setStatusTone("error");
        setStatus(data.error ?? "Could not switch billing cycle.");
        return;
      }
      setCycle(newBillingCycle);
      setProrataConfirm(null);
      setStatusTone("ok");
      setStatus(`Billing cycle set to ${newBillingCycle}.`);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const res = await fetch("/api/app/billing/usage?legacy=1");
    if (!res.ok) return;
    const data = (await res.json()) as BillingState;
    if (data.plan && data.usage) setState(data);
  }

  async function extendTrial() {
    if (!canManage) {
      setStatusTone("error");
      setStatus("Only an owner or admin can extend the trial.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/app/billing/subscriptions/extend-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        error?: string;
        trialEndsAt?: string;
        extensionsUsed?: number;
        daysAdded?: number;
      };
      if (!res.ok) {
        setStatusTone("error");
        setStatus(data.error ?? "Could not extend trial.");
        return;
      }
      setContractState((prev) =>
        prev
          ? {
              ...prev,
              trialEndsAt: data.trialEndsAt ?? prev.trialEndsAt,
              trialExtensionCount: data.extensionsUsed ?? prev.trialExtensionCount,
            }
          : {
              contractTermYears: null,
              contractEndsAt: null,
              multiYearDiscountPercent: null,
              trialEndsAt: data.trialEndsAt ?? null,
              trialExtensionCount: data.extensionsUsed ?? 1,
            },
      );
      setStatusTone("ok");
      setStatus(
        `Trial extended by ${data.daysAdded ?? 14} days${
          data.trialEndsAt
            ? ` (ends ${new Date(data.trialEndsAt).toLocaleDateString()})`
            : ""
        }.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function setContractTerm(years: "1" | "2" | "3" | null) {
    if (!canManage) {
      setStatusTone("error");
      setStatus("Only an owner or admin can set the contract term.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/app/billing/subscriptions/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractTermYears: years }),
      });
      const data = (await res.json()) as {
        error?: string;
        contractTermYears?: "1" | "2" | "3" | null;
        contractEndsAt?: string | null;
        multiYearDiscountPercent?: number | null;
      };
      if (!res.ok) {
        setStatusTone("error");
        setStatus(data.error ?? "Could not update contract.");
        return;
      }
      setContractState((prev) => ({
        contractTermYears: data.contractTermYears ?? null,
        contractEndsAt: data.contractEndsAt ?? null,
        multiYearDiscountPercent: data.multiYearDiscountPercent ?? null,
        trialEndsAt: prev?.trialEndsAt ?? null,
        trialExtensionCount: prev?.trialExtensionCount ?? 0,
      }));
      setStatusTone("ok");
      setStatus(
        years ? `Contract term set to ${years} year(s).` : "Multi-year contract cleared.",
      );
    } finally {
      setBusy(false);
    }
  }

  const monthlyBase = planPricing?.monthlyPrice ?? 0;
  const annualBase = planPricing?.annualPrice ?? 0;
  const seatCount = planPricing?.seats ?? 1;
  const volPct = planPricing?.volumeDiscountPercent ?? 0;
  const monthlyAfterVol =
    Math.round(monthlyBase * seatCount * (1 - volPct / 100) * 100) / 100;
  const annualAfterVol =
    Math.round(annualBase * seatCount * (1 - volPct / 100) * 100) / 100;

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
            {state.plan === "enterprise"
              ? " · Custom"
              : PLAN_LIMITS[state.plan].priceUsd > 0
                ? ` · ${formatUsdMonthly(state.plan)}`
                : " · $0/mo"}
          </p>
          <p className="font-data text-[11px]">
            {subscriptionStatusLabel(state.subscriptionStatus)}
          </p>
          {state.usage.watermarkedPdf ? (
            <p className="text-amber">
              PDFs are watermarked on Free. Upgrade to Pro for a clean export.
            </p>
          ) : null}
          <Link
            href="/billing/usage"
            className="inline-block text-accent underline-offset-2 hover:underline"
          >
            Metered usage details
          </Link>
          <Link
            href="/billing/revenue-recognition"
            className="block text-accent underline-offset-2 hover:underline"
          >
            Revenue recognition notes
          </Link>
          {isConsultancy && canManage ? (
            <Link
              href="/billing/clients"
              className="block text-accent underline-offset-2 hover:underline"
            >
              Client billing rollup
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

        {isTrialing ? (
          <StatusLine tone="neutral">
            Trial active
            {contractState?.trialEndsAt
              ? ` until ${new Date(contractState.trialEndsAt).toLocaleDateString()}`
              : ""}
            .{" "}
            {canManage && extensionsLeft > 0 ? (
              <>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  disabled={busy}
                  onClick={() => void extendTrial()}
                >
                  Extend trial ({extensionsLeft} left)
                </button>
                {" · "}
              </>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="underline underline-offset-2"
                disabled={busy}
                onClick={() => void checkout("pro")}
              >
                Upgrade
              </button>
            ) : (
              "Ask an owner to extend or upgrade."
            )}
          </StatusLine>
        ) : null}

        {dunning || state.subscriptionStatus === "past_due" ? (
          <StatusLine tone="error">
            Payment failed
            {dunning?.failureReason ? ` (${dunning.failureReason})` : ""}.
            {dunning?.nextRetryAt
              ? ` Next retry ${new Date(dunning.nextRetryAt).toLocaleDateString()}.`
              : ""}{" "}
            {dunning?.manualPaymentLink ? (
              <a
                href={dunning.manualPaymentLink}
                className="underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                Pay outstanding balance
              </a>
            ) : canManage ? (
              <button
                type="button"
                className="underline underline-offset-2"
                disabled={busy}
                onClick={() => void portal()}
              >
                Open billing portal
              </button>
            ) : (
              "Ask an owner to update the payment method."
            )}
          </StatusLine>
        ) : null}

        {readOnlyNonOwner ? (
          <StatusLine tone="neutral">
            Plan changes and the Stripe portal are limited to owners and admins. You can
            still review usage below.
          </StatusLine>
        ) : null}

        {showInrBanner ? (
          <div className="rounded-[6px] border border-rule bg-surface-1 px-4 py-3">
            <p className="text-[13px] text-ink">
              <span className="font-semibold text-amber">INR via Razorpay</span> —
              configure env after open decision §11.
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">
              {providers?.razorpay.configured
                ? "Razorpay keys are set. Live INR checkout still requires Workstream 0 sign-off (docs/LAUNCH_DECISIONS.md)."
                : "Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and BILLING_PROVIDER=razorpay once ops confirms the INR/Razorpay decision. Stripe checkout above is unaffected."}
            </p>
          </div>
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

        {planPricing ? (
          <PageCard title="Billing cycle">
            <p className="text-[13px] text-ink-muted">
              {planPricing.displayName} ·{" "}
              <span className="font-mono tabular-nums">{seatCount}</span> seat
              {seatCount === 1 ? "" : "s"}
              {volPct > 0 ? (
                <>
                  {" "}
                  · volume discount{" "}
                  <span className="font-mono tabular-nums text-ink">{volPct}%</span>
                </>
              ) : null}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy || !canManage || cycle === "monthly"}
                onClick={() => void switchCycle("monthly")}
                className={`rounded-[6px] border px-4 py-3 text-left ${
                  cycle === "monthly"
                    ? "border-accent bg-accent-quiet"
                    : "border-rule bg-surface-1 hover:border-rule-strong"
                } disabled:opacity-50`}
              >
                <p className="text-[12px] font-semibold text-ink">Monthly</p>
                <p className="mt-1 font-mono text-[18px] tabular-nums text-ink">
                  ${monthlyAfterVol}
                  <span className="text-[12px] text-ink-muted">/mo</span>
                </p>
              </button>
              <button
                type="button"
                disabled={busy || !canManage || cycle === "annual"}
                onClick={() => void switchCycle("annual")}
                className={`rounded-[6px] border px-4 py-3 text-left ${
                  cycle === "annual"
                    ? "border-accent bg-accent-quiet"
                    : "border-rule bg-surface-1 hover:border-rule-strong"
                } disabled:opacity-50`}
              >
                <p className="text-[12px] font-semibold text-ink">
                  Annual
                  {planPricing.annualDiscountPercentage > 0 ? (
                    <span className="ml-2 font-mono text-[11px] text-signal">
                      save {planPricing.annualDiscountPercentage}%
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 font-mono text-[18px] tabular-nums text-ink">
                  ${annualAfterVol}
                  <span className="text-[12px] text-ink-muted">/yr</span>
                </p>
              </button>
            </div>
            {prorataConfirm ? (
              <div className="mt-4 border-t border-rule pt-4">
                <p className="text-[13px] text-ink-muted">{prorataConfirm.message}</p>
                <p className="mt-1 font-mono text-[13px] tabular-nums text-ink">
                  Prorata ${prorataConfirm.amount}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  disabled={busy}
                  onClick={() => void switchCycle(prorataConfirm.newBillingCycle, true)}
                >
                  Confirm switch
                </Button>
              </div>
            ) : null}
          </PageCard>
        ) : null}

        {planPricing ? (
          <PageCard title="Multi-year contract">
            <p className="text-[13px] text-ink-muted">
              Commercial term on the subscription (1–3 years). Setting 2y or 3y applies a
              default multi-year discount (10% / 15%). Revenue is still recognised over
              time — see revenue recognition notes.
            </p>
            {contractState?.contractTermYears ? (
              <p className="mt-2 text-[13px] text-ink">
                Current:{" "}
                <span className="font-mono tabular-nums">
                  {contractState.contractTermYears} year
                  {contractState.contractTermYears === "1" ? "" : "s"}
                </span>
                {contractState.contractEndsAt
                  ? ` · ends ${new Date(contractState.contractEndsAt).toLocaleDateString()}`
                  : ""}
                {contractState.multiYearDiscountPercent != null
                  ? ` · ${contractState.multiYearDiscountPercent}% multi-year discount`
                  : ""}
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-ink-muted">No multi-year term set.</p>
            )}
            {canManage ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(["1", "2", "3"] as const).map((y) => (
                  <Button
                    key={y}
                    type="button"
                    size="sm"
                    variant={
                      contractState?.contractTermYears === y ? "default" : "outline"
                    }
                    disabled={busy}
                    onClick={() => void setContractTerm(y)}
                  >
                    {y}y
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !contractState?.contractTermYears}
                  onClick={() => void setContractTerm(null)}
                >
                  Clear
                </Button>
              </div>
            ) : null}
          </PageCard>
        ) : null}

        {planPricing && planPricing.volumeTiers.length > 0 ? (
          <PageCard title="Volume discounts">
            <ul className="space-y-2 text-[13px] text-ink-muted">
              {planPricing.volumeTiers.map((t) => (
                <li key={t.minSeats} className="font-mono tabular-nums">
                  {t.label}
                  {seatCount >= t.minSeats ? (
                    <span className="ml-2 text-signal">applied</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </PageCard>
        ) : null}

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

        <p className="text-[13px] text-ink-muted">
          14-day free trial of Pro — no credit card required. Annual billing:{" "}
          {ANNUAL_DISCOUNT_LABEL} (≈ 2 months free).
        </p>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(
            [
              "free",
              "pro",
              "professional",
              "consultant",
              "enterprise",
            ] as const satisfies readonly PlanId[]
          ).map((plan) => {
            const annual = formatUsdAnnual(plan);
            const isCheckout = (CHECKOUT_PLAN_IDS as readonly string[]).includes(plan);
            return (
              <PageCard key={plan} title={PLAN_LIMITS[plan].label}>
                <p className="font-data text-[22px] font-bold text-ink">
                  {formatUsdMonthly(plan)}
                </p>
                {annual ? (
                  <p className="mt-1 font-data text-[12px] text-ink-muted">
                    or {annual} · {ANNUAL_DISCOUNT_LABEL}
                  </p>
                ) : plan === "enterprise" ? (
                  <p className="mt-1 text-[12px] text-ink-muted">Contact sales</p>
                ) : (
                  <p className="mt-1 text-[12px] text-ink-muted">Forever free</p>
                )}
                <p className="mt-2 text-[13px] text-ink-muted">
                  {PLAN_LIMITS[plan].blurb}
                </p>
                {canManage ? (
                  plan === "enterprise" ? (
                    <a
                      href="mailto:sales@clearesg.com"
                      className="mt-4 inline-flex text-[13px] font-medium text-accent underline-offset-2 hover:underline"
                    >
                      Contact sales
                    </a>
                  ) : isCheckout ? (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-4"
                      disabled={busy || state.plan === plan}
                      onClick={() => void checkout(plan as CheckoutPlanId)}
                    >
                      {state.plan === plan
                        ? "Current"
                        : `Upgrade to ${PLAN_LIMITS[plan].label}`}
                    </Button>
                  ) : (
                    <p className="mt-4 text-[13px] text-ink-muted">
                      {state.plan === plan ? "Current plan" : "Included forever"}
                    </p>
                  )
                ) : (
                  <p className="mt-4 text-[13px] text-ink-muted">
                    {state.plan === plan ? "Current plan" : "Ask an owner to upgrade"}
                  </p>
                )}
              </PageCard>
            );
          })}
        </div>
      </div>
    </PageFrame>
  );
}
