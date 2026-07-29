import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * GET /api/app/billing/plans
 * List all active plans (public, readable by all authenticated users)
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload({ config });

    const plans = await payload.find({
      collection: "plans" as any,
      where: {
        isActive: { equals: true },
      },
      limit: 100,
    });

    return NextResponse.json({
      plans: plans.docs || [],
      total: plans.totalDocs,
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
