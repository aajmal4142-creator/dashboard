import { getPayload } from "payload";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { clientsUsageRollupToCsv, loadClientsUsageRollup } from "@/lib/consultant";
import config from "@/payload.config";

/**
 * GET /api/app/billing/clients/usage?format=csv
 *
 * Per-client seats/usage rollup for a consultancy organisation. Owner/admin
 * only — this is billing data about every client org the consultancy manages.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (ctx.activeOrg.type !== "consultancy") {
      return NextResponse.json(
        { error: "Switch to a consultancy organisation to view client billing" },
        { status: 403 },
      );
    }
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Owner or admin required to view client billing" },
        { status: 403 },
      );
    }

    const payload = await getPayload({ config });
    const rollup = await loadClientsUsageRollup(
      payload,
      ctx.activeOrg.id,
      ctx.activeOrg.name,
    );

    const format = new URL(req.url).searchParams.get("format");
    if (format === "csv") {
      const csv = clientsUsageRollupToCsv(rollup);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="client-usage-${ctx.activeOrg.slug}.csv"`,
        },
      });
    }

    return NextResponse.json({ rollup });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Client billing rollup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
