import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

const MAX_EXTENSIONS = 2;
const EXTENSION_DAYS = 14;

/**
 * POST /api/app/billing/subscriptions/extend-trial
 * Extends an active trial by 14 days (max 2 extensions per subscription).
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only an owner or admin can extend the trial." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { days?: number };
    const days =
      typeof body.days === "number" && body.days > 0 && body.days <= 30
        ? Math.floor(body.days)
        : EXTENSION_DAYS;

    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "subscriptions",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 1,
      overrideAccess: true,
    });
    const sub = result.docs[0];
    if (!sub) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }
    if (sub.status !== "trialing") {
      return NextResponse.json(
        { error: "Trial extension is only available while status is trialing." },
        { status: 400 },
      );
    }

    const used =
      typeof sub.trialExtensionCount === "number" && sub.trialExtensionCount >= 0
        ? sub.trialExtensionCount
        : 0;
    if (used >= MAX_EXTENSIONS) {
      return NextResponse.json(
        {
          error: `Trial already extended ${MAX_EXTENSIONS} times. Upgrade to continue.`,
          extensionsUsed: used,
          maxExtensions: MAX_EXTENSIONS,
        },
        { status: 400 },
      );
    }

    const base = sub.trialEndsAt ? new Date(String(sub.trialEndsAt)) : new Date();
    const from = Number.isFinite(base.getTime()) && base > new Date() ? base : new Date();
    const next = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
    const newCount = used + 1;

    await payload.update({
      collection: "subscriptions",
      id: sub.id,
      data: {
        trialEndsAt: next.toISOString(),
        trialExtensionCount: newCount,
        updatedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });

    await payload.update({
      collection: "organisations",
      id: ctx.activeOrg.id,
      data: { subscriptionStatus: "trialing" },
      overrideAccess: true,
    });

    return NextResponse.json({
      ok: true,
      trialEndsAt: next.toISOString(),
      extensionsUsed: newCount,
      maxExtensions: MAX_EXTENSIONS,
      daysAdded: days,
    });
  } catch (error) {
    console.error("extend-trial error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
