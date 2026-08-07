import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  billingCurrency,
  billingProvider,
  createRazorpayOrder,
  providerNotRazorpayDenial,
} from "@/lib/billing";

type CheckoutBody = {
  /** Amount in the smallest currency unit (paise for INR). */
  amount?: number;
  plan?: string;
};

/**
 * Create a Razorpay order for the active org's plan.
 * Y05 — open decision §11 (INR/Razorpay). Owner/admin only. Never charges
 * unless BILLING_PROVIDER=razorpay, RAZORPAY_KEY_ID/SECRET are set, and
 * Workstream 0 is signed off — otherwise returns a structured 501/402.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin required for billing" }, { status: 403 });
  }

  if (billingProvider() !== "razorpay") {
    const denial = providerNotRazorpayDenial();
    return NextResponse.json(denial, { status: denial.status });
  }

  const body = (await req.json().catch(() => ({}))) as CheckoutBody;
  const amount =
    typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0
      ? Math.round(body.amount)
      : null;
  if (!amount) {
    return NextResponse.json(
      { error: "amount (positive integer, smallest INR unit) is required" },
      { status: 400 },
    );
  }

  const currency = billingCurrency();
  const result = await createRazorpayOrder({
    amountMinorUnits: amount,
    currency: currency === "USD" ? "USD" : currency === "EUR" ? "EUR" : "INR",
    receipt: `org-${ctx.activeOrg.id}-${Date.now()}`,
    notes: {
      organisationId: ctx.activeOrg.id,
      plan: body.plan ?? "",
    },
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json({ provider: "razorpay", ...result });
}
