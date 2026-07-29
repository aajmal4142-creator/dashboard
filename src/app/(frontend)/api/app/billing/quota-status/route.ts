import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createQuotaEnforcer } from "@/lib/billing";
import { CACHE_HEADERS } from "@/lib/api/cache-headers";
import config from "@/payload.config";

/**
 * GET /api/app/billing/quota-status
 * Get current quota usage vs limits
 */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload({ config });
    const enforcer = createQuotaEnforcer(payload);

    const status = await enforcer.getQuotaStatus(ctx.activeOrg.id);
    const warnings = enforcer.getWarnings(status);

    return NextResponse.json(
      {
        ...status,
        warnings,
      },
      {
        headers: CACHE_HEADERS.MINIMAL, // Real-time usage data, minimal cache
      },
    );
  } catch (error) {
    console.error("Error fetching quota status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
