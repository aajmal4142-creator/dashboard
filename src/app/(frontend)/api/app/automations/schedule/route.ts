import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { runScheduledAutomations } from "@/lib/automations";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

/**
 * POST /api/app/automations/schedule
 * Runs enabled schedule-trigger automations whose cron matches now.
 */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin" && ctx.role !== "contributor") {
      return NextResponse.json(
        { error: "Insufficient role to run schedule automations." },
        { status: 403 },
      );
    }

    let dryRun = false;
    try {
      const body = (await req.json()) as { dryRun?: unknown };
      dryRun = body.dryRun === true;
    } catch {
      // empty body ok
    }

    const payload = await getPayload({ config });
    const result = await runScheduledAutomations(payload, ctx.activeOrg.id, {
      actorId: ctx.user.id,
      dryRun,
    });

    return NextResponse.json({
      ok: true,
      dryRun,
      ...result,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error running schedule automations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
