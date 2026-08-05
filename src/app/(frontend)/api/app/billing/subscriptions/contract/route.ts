import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * POST /api/app/billing/subscriptions/contract
 * Set multi-year contract term (1|2|3 years) + optional multi-year discount.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only an owner or admin can set the contract term." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      contractTermYears?: "1" | "2" | "3" | null;
      multiYearDiscountPercent?: number | null;
    };

    const term = body.contractTermYears;
    if (
      term !== null &&
      term !== undefined &&
      term !== "1" &&
      term !== "2" &&
      term !== "3"
    ) {
      return NextResponse.json(
        { error: "contractTermYears must be 1, 2, 3, or null." },
        { status: 400 },
      );
    }

    let discount = body.multiYearDiscountPercent;
    if (discount !== undefined && discount !== null) {
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
        return NextResponse.json(
          { error: "multiYearDiscountPercent must be 0–100 or null." },
          { status: 400 },
        );
      }
      discount = Math.round(discount * 100) / 100;
    }

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

    const data: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (term === null) {
      data.contractTermYears = null;
      data.contractEndsAt = null;
      data.multiYearDiscountPercent = null;
    } else if (term !== undefined) {
      data.contractTermYears = term;
      const years = Number(term);
      const start = sub.currentPeriodStart
        ? new Date(String(sub.currentPeriodStart))
        : new Date();
      const ends = new Date(start);
      ends.setFullYear(ends.getFullYear() + years);
      data.contractEndsAt = ends.toISOString();
      if (years >= 2 && discount === undefined) {
        data.multiYearDiscountPercent = years === 3 ? 15 : 10;
      }
    }

    if (discount !== undefined) {
      data.multiYearDiscountPercent = discount;
    }

    const updated = await payload.update({
      collection: "subscriptions",
      id: sub.id,
      data,
      overrideAccess: true,
    });

    return NextResponse.json({
      ok: true,
      contractTermYears: updated.contractTermYears ?? null,
      contractEndsAt: updated.contractEndsAt ? String(updated.contractEndsAt) : null,
      multiYearDiscountPercent:
        typeof updated.multiYearDiscountPercent === "number"
          ? updated.multiYearDiscountPercent
          : null,
    });
  } catch (error) {
    console.error("contract term error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
