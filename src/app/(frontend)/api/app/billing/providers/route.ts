import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  billingCurrency,
  billingProvider,
  razorpayConfigured,
  stripeConfigured,
} from "@/lib/billing";
import { mayEnablePaidBilling } from "@/lib/launch/gates";

/**
 * Configured billing providers — no secrets. Lets BillingClient decide
 * whether to surface the INR/Razorpay banner (Y05, open decision §11).
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  return NextResponse.json({
    activeProvider: billingProvider(),
    currency: billingCurrency(),
    liveBillingSignedOff: mayEnablePaidBilling(),
    stripe: { configured: stripeConfigured() },
    razorpay: { configured: razorpayConfigured() },
    openDecision:
      "INR/Razorpay is an open decision (§11) — ops must confirm before enabling live INR checkout.",
  });
}
