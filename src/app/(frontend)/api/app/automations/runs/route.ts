import { getPayload } from "payload";
import type { Where } from "payload";
import { NextResponse } from "next/server";

import { mapAutomationRunDoc } from "@/lib/automations";
import { findAutomationRuns } from "@/lib/automations/store";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

/** GET /api/app/automations/runs — recent run logs for the active org. */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const automationId = url.searchParams.get("automationId");
    const limitRaw = Number(url.searchParams.get("limit") ?? "50");
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 100)
        : 50;

    const where: Where = automationId
      ? {
          and: [
            { organisation: { equals: ctx.activeOrg.id } },
            { automation: { equals: automationId } },
          ],
        }
      : { organisation: { equals: ctx.activeOrg.id } };

    const payload = await getPayload({ config });
    const result = await findAutomationRuns(payload, {
      where,
      sort: "-createdAt",
      limit,
      depth: 1,
    });

    const runs = result.docs
      .map((doc) => mapAutomationRunDoc(doc))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return NextResponse.json({
      runs,
      total: result.totalDocs,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing automation runs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
