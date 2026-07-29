import { getPayload } from "payload";
import config from "@/payload.config";
import { getStripe } from "./stripe";
import type { DunningManagement, Plan, Subscription } from "@/payload-types";

export type RetrySchedule = "stripe_default" | "aggressive" | "conservative" | "custom";

const RETRY_SCHEDULES: Record<Exclude<RetrySchedule, "custom">, number[]> = {
  stripe_default: [1, 3, 5],
  aggressive: [1, 3, 5],
  conservative: [7, 14],
};

type RetryAttempt = NonNullable<DunningManagement["retryAttempts"]>[number];

function orgIdOf(value: Subscription["organisation"]): string {
  return typeof value === "string" ? value : value.id;
}

function planDisplayName(plan: Subscription["plan"]): string {
  if (typeof plan === "object" && plan !== null && "displayName" in plan) {
    return (plan as Plan).displayName;
  }
  return "Subscription";
}

function resolveChargeAmountCents(subscription: Subscription): number {
  const plan = subscription.plan;
  if (typeof plan === "object" && plan !== null && "monthlyPrice" in plan) {
    const monthly = (plan as Plan).monthlyPrice;
    return Math.round(monthly * subscription.seats * 100);
  }
  return Math.round(subscription.seats * 100); // fallback: $1 per seat
}

export async function createDunningCampaign(
  subscriptionId: string,
  failureReason: string,
  failureCode?: string,
): Promise<void> {
  const payload = await getPayload({ config });

  await payload.findByID({
    collection: "subscriptions",
    id: subscriptionId,
  });

  const firstRetryDays = RETRY_SCHEDULES.stripe_default[0];

  // Create dunning record
  await payload.create({
    collection: "dunning-management",
    data: {
      subscription: subscriptionId,
      status: "retrying",
      failureReason,
      failureCode: mapFailureCode(failureCode),
      initialFailureDate: new Date().toISOString(),
      retrySchedule: "stripe_default",
      retryAttempts: [],
      nextRetryAt: new Date(
        Date.now() + firstRetryDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
  });

  // Update subscription status
  await payload.update({
    collection: "subscriptions",
    id: subscriptionId,
    data: {
      status: "past_due",
    },
  });
}

function mapFailureCode(code?: string): DunningManagement["failureCode"] {
  const allowed = [
    "insufficient_funds",
    "lost_card",
    "stolen_card",
    "expired_card",
    "incorrect_cvc",
    "processor_error",
    "other",
  ] as const;
  if (code && (allowed as readonly string[]).includes(code)) {
    return code as NonNullable<DunningManagement["failureCode"]>;
  }
  return code ? "other" : null;
}

export async function scheduleRetryAttempt(
  subscriptionId: string,
  attemptNumber: number,
  delayDays: number,
): Promise<void> {
  const payload = await getPayload({ config });

  const dunning = await payload.find({
    collection: "dunning-management",
    where: { subscription: { equals: subscriptionId } },
    limit: 1,
  });

  if (!dunning.docs?.[0]) return;

  const campaign = dunning.docs[0];
  const nextRetryDate = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);

  const retryAttempts: RetryAttempt[] = [...(campaign.retryAttempts ?? [])];
  retryAttempts.push({
    attemptNumber,
    attemptedAt: new Date().toISOString(),
    status: "pending",
    paymentIntentId: null,
  });

  await payload.update({
    collection: "dunning-management",
    id: campaign.id,
    data: {
      retryAttempts,
      nextRetryAt: nextRetryDate.toISOString(),
    },
  });
}

export async function executeRetryAttempt(
  subscriptionId: string,
  _attemptNumber: number,
): Promise<{ success: boolean; errorMessage?: string }> {
  const payload = await getPayload({ config });
  const stripe = await getStripe();

  if (!stripe) {
    return { success: false, errorMessage: "Stripe not configured" };
  }

  const subscription = await payload.findByID({
    collection: "subscriptions",
    id: subscriptionId,
    depth: 1,
  });

  // Prefer subscription Stripe customer, fall back to organisation
  let customerId = subscription.stripeCustomerId ?? null;
  if (!customerId) {
    const org = await payload.findByID({
      collection: "organisations",
      id: orgIdOf(subscription.organisation),
    });
    customerId = org.stripeCustomerId ?? null;
  }

  if (!customerId) {
    return { success: false, errorMessage: "No Stripe customer found" };
  }

  try {
    // Try to charge the customer using their default payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount: resolveChargeAmountCents(subscription),
      currency: "usd",
      customer: customerId,
      off_session: true,
      confirm: true,
    });

    if (paymentIntent.status === "succeeded") {
      // Update subscription back to active
      await payload.update({
        collection: "subscriptions",
        id: subscriptionId,
        data: {
          status: "active",
        },
      });

      // Update dunning record
      const dunning = await payload.find({
        collection: "dunning-management",
        where: { subscription: { equals: subscriptionId } },
        limit: 1,
      });

      if (dunning.docs?.[0]) {
        await payload.update({
          collection: "dunning-management",
          id: dunning.docs[0].id,
          data: {
            status: "resolved",
            recoveryDate: new Date().toISOString(),
          },
        });
      }

      return { success: true };
    } else {
      return {
        success: false,
        errorMessage: `Payment intent status: ${paymentIntent.status}`,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment retry failed";
    return { success: false, errorMessage: message };
  }
}

export async function suspendSubscriptionDueToDunning(
  subscriptionId: string,
): Promise<void> {
  const payload = await getPayload({ config });

  await payload.update({
    collection: "subscriptions",
    id: subscriptionId,
    data: {
      status: "suspended",
    },
  });

  const dunning = await payload.find({
    collection: "dunning-management",
    where: { subscription: { equals: subscriptionId } },
    limit: 1,
  });

  if (dunning.docs?.[0]) {
    await payload.update({
      collection: "dunning-management",
      id: dunning.docs[0].id,
      data: {
        status: "suspended",
        accountSuspendedAt: new Date().toISOString(),
      },
    });
  }
}

export async function cancelSubscriptionDueToDunning(
  subscriptionId: string,
): Promise<void> {
  const payload = await getPayload({ config });
  const stripe = await getStripe();

  if (stripe) {
    const subscription = await payload.findByID({
      collection: "subscriptions",
      id: subscriptionId,
    });

    const stripeSubId = subscription.stripeSubscriptionId;
    if (stripeSubId) {
      await stripe.subscriptions.cancel(stripeSubId);
    }
  }

  await payload.update({
    collection: "subscriptions",
    id: subscriptionId,
    data: {
      status: "canceled",
      cancelledAt: new Date().toISOString(),
    },
  });

  const dunning = await payload.find({
    collection: "dunning-management",
    where: { subscription: { equals: subscriptionId } },
    limit: 1,
  });

  if (dunning.docs?.[0]) {
    await payload.update({
      collection: "dunning-management",
      id: dunning.docs[0].id,
      data: {
        status: "canceled",
        canceledAt: new Date().toISOString(),
      },
    });
  }
}

export async function generateManualPaymentLink(subscriptionId: string): Promise<string> {
  const payload = await getPayload({ config });
  const stripe = await getStripe();

  if (!stripe) throw new Error("Stripe not configured");

  const subscription = await payload.findByID({
    collection: "subscriptions",
    id: subscriptionId,
    depth: 1,
  });

  let customerId = subscription.stripeCustomerId ?? null;
  let contactEmail = subscription.contactEmail ?? null;

  const org = await payload.findByID({
    collection: "organisations",
    id: orgIdOf(subscription.organisation),
  });

  if (!customerId) customerId = org.stripeCustomerId ?? null;
  if (!contactEmail) contactEmail = null;

  if (!customerId) throw new Error("No Stripe customer");

  // Create payment link for the outstanding balance
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${planDisplayName(subscription.plan)} Recovery Payment`,
          },
          unit_amount: resolveChargeAmountCents(subscription),
        },
        quantity: 1,
      },
    ],
    ...(contactEmail
      ? {
          after_completion: {
            type: "redirect" as const,
            redirect: { url: "https://clearesg.com/billing" },
          },
        }
      : {}),
  });

  if (!paymentLink.url) throw new Error("Failed to create payment link");

  // Update dunning record
  const dunning = await payload.find({
    collection: "dunning-management",
    where: { subscription: { equals: subscriptionId } },
    limit: 1,
  });

  if (dunning.docs?.[0]) {
    await payload.update({
      collection: "dunning-management",
      id: dunning.docs[0].id,
      data: {
        manualPaymentLink: paymentLink.url,
      },
    });
  }

  return paymentLink.url;
}
