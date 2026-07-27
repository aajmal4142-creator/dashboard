import { getPayload } from "payload";
import type { Stripe } from "stripe";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import {
  getStripe,
  normalizePlan,
  planFromStripePriceId,
  stripeConfigured,
  type PlanId,
} from "@/lib/billing";
import config from "@/payload.config";

export const runtime = "nodejs";

async function setOrgPlan(
  organisationId: string,
  data: {
    plan?: PlanId;
    subscriptionStatus?: "none" | "active" | "past_due" | "canceled";
    stripeCustomerId?: string;
  },
) {
  const payload = await getPayload({ config });
  const before = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });
  await payload.update({
    collection: "organisations",
    id: organisationId,
    data,
    overrideAccess: true,
  });
  if (data.plan && data.plan !== before.plan) {
    await writeAuditLog(payload, {
      organisationId,
      action: "billing.plan_changed",
      entityType: "organisations",
      entityId: organisationId,
      before: { plan: before.plan, subscriptionStatus: before.subscriptionStatus },
      after: {
        plan: data.plan,
        subscriptionStatus: data.subscriptionStatus ?? before.subscriptionStatus,
        source: "stripe_webhook",
      },
    });
  }
}

async function orgIdFromCustomer(customerId: string): Promise<string | null> {
  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: "organisations",
    where: { stripeCustomerId: { equals: customerId } },
    limit: 1,
    overrideAccess: true,
  });
  return found.docs[0]?.id ?? null;
}

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0];
  if (!item) return null;
  return typeof item.price === "string" ? item.price : item.price.id;
}

export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET missing" }, { status: 503 });
  }

  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.error("Stripe webhook signature failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organisationId = session.metadata?.organisationId;
        const planMeta = session.metadata?.plan;
        if (organisationId) {
          const plan = normalizePlan(planMeta ?? "pro");
          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id;
          await setOrgPlan(organisationId, {
            plan: plan === "free" ? "pro" : plan,
            subscriptionStatus: "active",
            ...(customerId ? { stripeCustomerId: customerId } : {}),
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const organisationId =
          sub.metadata?.organisationId ?? (await orgIdFromCustomer(customerId));
        if (!organisationId) break;

        const fromPrice = planFromStripePriceId(priceIdFromSubscription(sub));
        const fromMeta = sub.metadata?.plan ? normalizePlan(sub.metadata.plan) : null;
        const plan = fromPrice ?? fromMeta ?? "pro";

        let status: "active" | "past_due" | "canceled" | "none" = "active";
        if (sub.status === "past_due" || sub.status === "unpaid") status = "past_due";
        else if (sub.status === "canceled" || sub.status === "incomplete_expired")
          status = "canceled";
        else if (sub.status === "active" || sub.status === "trialing") status = "active";
        else status = "none";

        await setOrgPlan(organisationId, {
          plan: status === "canceled" ? "free" : plan,
          subscriptionStatus: status,
          stripeCustomerId: customerId,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const organisationId =
          sub.metadata?.organisationId ?? (await orgIdFromCustomer(customerId));
        if (organisationId) {
          await setOrgPlan(organisationId, {
            plan: "free",
            subscriptionStatus: "canceled",
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const organisationId = await orgIdFromCustomer(customerId);
        if (organisationId) {
          await setOrgPlan(organisationId, { subscriptionStatus: "past_due" });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
