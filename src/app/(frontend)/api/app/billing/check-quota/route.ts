import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createQuotaEnforcer } from "@/lib/billing";
import config from "@/payload.config";

/**
 * POST /api/app/billing/check-quota
 * Check if an action is allowed within quota limits
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, count = 1 } = body;

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    if (!["create_datapoint", "publish_report", "api_call", "store_file"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });
    const enforcer = createQuotaEnforcer(payload);

    const result = await enforcer.checkQuota(
      ctx.activeOrg.id,
      action as "create_datapoint" | "publish_report" | "api_call" | "store_file",
      count
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error checking quota:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
