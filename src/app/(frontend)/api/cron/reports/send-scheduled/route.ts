import { NextResponse } from "next/server";

import { executeDueScheduledReports } from "@/lib/reports/reportScheduler";
import { isProductionRuntime } from "@/lib/launch/gates";

/**
 * Vercel cron → send due scheduled report deliveries.
 * CRON_SECRET required in production.
 * Schedule: every 5 minutes (vercel.json).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (isProductionRuntime()) {
    if (!secret) {
      return NextResponse.json(
        { error: "CRON_SECRET required in production" },
        { status: 503 },
      );
    }
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await executeDueScheduledReports();
    return NextResponse.json({
      ok: true,
      attempted: result.attempted,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      results: result.results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scheduled report cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
