import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import type { BillingCycle } from "@/lib/billing/types";

/**
 * GET /api/app/billing/subscriptions/current
 * Get current organization's subscription
 */
export async function GET(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "billing",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    const result = await payload.find({
      collection: "subscriptions",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 1,
    });

    const subscription = result.docs?.[0];
    if (!subscription) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    const planId =
      typeof subscription.plan === "object" ? subscription.plan.id : subscription.plan;
    const plan = await payload.findByID({
      collection: "plans",
      id: String(planId),
    });

    return NextResponse.json({
      ...subscription,
      plan,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/billing/subscriptions
 * Create a new subscription for organization
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can create subscriptions" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      planId?: string;
      billingCycle?: BillingCycle;
      seats?: number;
    };
    const { planId, billingCycle = "monthly", seats = 1 } = body;

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const payload = await getPayload({ config });

    const plan = await payload.findByID({
      collection: "plans",
      id: planId,
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const existing = await payload.find({
      collection: "subscriptions",
      where: {
        organisation: { equals: ctx.activeOrg.id },
      },
      limit: 1,
    });

    if (existing.docs?.length) {
      return NextResponse.json(
        { error: "Organization already has an active subscription" },
        { status: 409 },
      );
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await payload.create({
      collection: "subscriptions",
      data: {
        organisation: ctx.activeOrg.id,
        plan: planId,
        status: "trialing",
        billingCycle,
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        seats,
        autoRenew: true,
        sendInvoices: true,
        sendUsageAlerts: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
