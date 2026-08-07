import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { BillingClient } from "./BillingClient";
import { getCurrentContext } from "@/lib/auth";
import { formatDiscountTierDisplay, getUsageMeters, normalizePlan } from "@/lib/billing";
import config from "@/payload.config";

export const metadata = {
  title: "Billing | ClearESG",
};

export default async function BillingPage() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) redirect("/login");

  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  const usage = await getUsageMeters(ctx.activeOrg.id, org.plan);
  const plan = normalizePlan(org.plan);

  const subResult = await payload.find({
    collection: "subscriptions",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const subscription = subResult.docs[0] ?? null;

  let planPricing: {
    planId: string;
    displayName: string;
    monthlyPrice: number;
    annualPrice: number;
    annualDiscountPercentage: number;
    seats: number;
    billingCycle: "monthly" | "annual";
    volumeTiers: Array<{ minSeats: number; discountPercent: number; label: string }>;
    volumeDiscountPercent: number;
  } | null = null;

  if (subscription) {
    const planDoc =
      typeof subscription.plan === "object" && subscription.plan !== null
        ? subscription.plan
        : await payload.findByID({
            collection: "plans",
            id: String(subscription.plan),
            depth: 0,
            overrideAccess: true,
          });
    const seats =
      typeof subscription.seats === "number" && subscription.seats > 0
        ? subscription.seats
        : 1;
    const monthly = typeof planDoc.monthlyPrice === "number" ? planDoc.monthlyPrice : 0;
    const annual =
      typeof planDoc.annualPrice === "number"
        ? planDoc.annualPrice
        : Math.round(monthly * 12 * 0.85 * 100) / 100;
    const annualVsMonthly =
      monthly > 0 ? Math.round((1 - annual / (monthly * 12)) * 100) : 15;
    const tiers = Array.isArray(planDoc.volumeDiscounts)
      ? planDoc.volumeDiscounts.map(
          (t: { minSeats: number; discountPercent: number }) => ({
            minSeats: t.minSeats,
            discountPercent: t.discountPercent,
            label: formatDiscountTierDisplay({
              minSeats: t.minSeats,
              discountPercent: t.discountPercent,
            }),
          }),
        )
      : [];
    let volumeDiscountPercent = 0;
    for (const t of tiers) {
      if (seats >= t.minSeats) {
        volumeDiscountPercent = Math.max(volumeDiscountPercent, t.discountPercent);
      }
    }
    planPricing = {
      planId: String(planDoc.id),
      displayName: String(planDoc.displayName ?? planDoc.name ?? "Plan"),
      monthlyPrice: monthly,
      annualPrice: annual,
      annualDiscountPercentage: annualVsMonthly,
      seats,
      billingCycle: subscription.billingCycle === "annual" ? "annual" : "monthly",
      volumeTiers: tiers,
      volumeDiscountPercent,
    };
  }

  let dunning: {
    status: string;
    nextRetryAt: string | null;
    failureReason: string | null;
    manualPaymentLink: string | null;
  } | null = null;

  let contract: {
    contractTermYears: "1" | "2" | "3" | null;
    contractEndsAt: string | null;
    multiYearDiscountPercent: number | null;
    trialEndsAt: string | null;
    trialExtensionCount: number;
  } | null = null;

  if (subscription) {
    const term = subscription.contractTermYears;
    contract = {
      contractTermYears: term === "1" || term === "2" || term === "3" ? term : null,
      contractEndsAt: subscription.contractEndsAt
        ? String(subscription.contractEndsAt)
        : null,
      multiYearDiscountPercent:
        typeof subscription.multiYearDiscountPercent === "number"
          ? subscription.multiYearDiscountPercent
          : null,
      trialEndsAt: subscription.trialEndsAt ? String(subscription.trialEndsAt) : null,
      trialExtensionCount:
        typeof subscription.trialExtensionCount === "number"
          ? subscription.trialExtensionCount
          : 0,
    };

    const dunningFound = await payload.find({
      collection: "dunning-management",
      where: {
        and: [
          { subscription: { equals: subscription.id } },
          { status: { in: ["retrying", "suspended"] } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const camp = dunningFound.docs[0];
    if (camp) {
      dunning = {
        status: String(camp.status),
        nextRetryAt: camp.nextRetryAt ? String(camp.nextRetryAt) : null,
        failureReason: camp.failureReason ? String(camp.failureReason) : null,
        manualPaymentLink: camp.manualPaymentLink ? String(camp.manualPaymentLink) : null,
      };
    }
  }

  return (
    <BillingClient
      initial={{
        plan,
        subscriptionStatus: org.subscriptionStatus ?? "none",
        usage,
      }}
      role={ctx.role}
      planPricing={planPricing}
      dunning={dunning}
      contract={contract}
      isConsultancy={ctx.activeOrg.type === "consultancy"}
    />
  );
}
