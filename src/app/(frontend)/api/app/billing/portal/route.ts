import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { appOrigin, getStripe, stripeConfigured } from "@/lib/billing";
import { mayEnablePaidBilling, paidBillingDenial } from "@/lib/launch/gates";
import config from "@/payload.config";

/** Stripe Customer Billing Portal — same WS0 gate as live Checkout. */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin required for billing" }, { status: 403 });
  }

  if (!mayEnablePaidBilling()) {
    return NextResponse.json(paidBillingDenial(), { status: 403 });
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      {
        error: "Stripe is not configured. Manage plans via Checkout in DEV bypass.",
        upgradePath: "/dashboard/billing",
      },
      { status: 503 },
    );
  }

  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  if (!org.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer yet. Start a Checkout session first." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${appOrigin(req)}/dashboard/billing`,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
