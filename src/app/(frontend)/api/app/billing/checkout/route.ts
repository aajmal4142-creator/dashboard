import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import {
  appOrigin,
  getStripe,
  isPlanId,
  stripeConfigured,
  stripePriceIdForPlan,
  type PlanId,
} from "@/lib/billing";
import {
  mayEnablePaidBilling,
  paidBillingDenial,
  devBypassAllowed,
} from "@/lib/launch/gates";
import config from "@/payload.config";

/**
 * Start Checkout for Pro or Consultant.
 * Live Stripe charge requires WS0. Without WS0: safe stub / DEV bypass only — never charges.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin required for billing" }, { status: 403 });
  }

  const body = (await req.json()) as { plan?: string };
  if (!body.plan || body.plan === "free" || !isPlanId(body.plan)) {
    return NextResponse.json(
      { error: "plan must be pro or consultant" },
      { status: 400 },
    );
  }
  const target = body.plan as Exclude<PlanId, "free">;
  const origin = appOrigin(req);
  const payload = await getPayload({ config });

  // Live money path — gated
  if (stripeConfigured() && mayEnablePaidBilling()) {
    const stripe = getStripe();
    const org = await payload.findByID({
      collection: "organisations",
      id: ctx.activeOrg.id,
      depth: 0,
      overrideAccess: true,
    });

    let customerId = org.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ctx.user.email,
        name: org.name,
        metadata: {
          organisationId: org.id,
          organisationSlug: org.slug,
        },
      });
      customerId = customer.id;
      await payload.update({
        collection: "organisations",
        id: org.id,
        data: { stripeCustomerId: customerId },
        overrideAccess: true,
      });
    }

    const priceId = stripePriceIdForPlan(target);
    if (!priceId) {
      return NextResponse.json(
        {
          error: `Missing env ${target === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_CONSULTANT"}`,
        },
        { status: 503 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/billing?checkout=success`,
      cancel_url: `${origin}/dashboard/billing?checkout=cancel`,
      metadata: {
        organisationId: org.id,
        plan: target,
      },
      subscription_data: {
        metadata: {
          organisationId: org.id,
          plan: target,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout session missing URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, mode: "stripe", url: session.url });
  }

  // Stripe keys present but WS0 unsigned → refuse charge path
  if (stripeConfigured() && !mayEnablePaidBilling()) {
    return NextResponse.json(paidBillingDenial(), { status: 403 });
  }

  // Safe stub / DEV bypass — never charges
  if (!devBypassAllowed()) {
    return NextResponse.json(
      {
        error:
          "Live checkout is gated (docs/LAUNCH_DECISIONS.md). Set CLEARESG_DEV_BYPASS=1 for a non-charging local stub, or CLEARESG_WS0_SIGNED_OFF=1 for Stripe.",
        code: "WS0_REQUIRED",
        docs: "/docs/LAUNCH_DECISIONS.md",
      },
      { status: 403 },
    );
  }

  const beforePlan = ctx.activeOrg.plan;
  await payload.update({
    collection: "organisations",
    id: ctx.activeOrg.id,
    data: {
      plan: target,
      subscriptionStatus: "active",
    },
    overrideAccess: true,
  });
  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "billing.plan_changed",
    entityType: "organisations",
    entityId: ctx.activeOrg.id,
    before: { plan: beforePlan },
    after: { plan: target, mode: "dev_bypass" },
  });
  return NextResponse.json({
    ok: true,
    mode: "dev_bypass",
    url: `${origin}/dashboard/billing?upgraded=${target}`,
  });
}
