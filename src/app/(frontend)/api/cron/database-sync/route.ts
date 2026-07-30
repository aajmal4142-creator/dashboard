import { NextResponse } from "next/server";

import { syncDueDatabaseConnections } from "@/lib/database";
import { isProductionRuntime } from "@/lib/launch/gates";

/**
 * Vercel cron → scheduled database connector syncs.
 * CRON_SECRET required in production.
 * Schedule: hourly (vercel.json). Connections with syncFrequency hourly/daily/weekly
 * run when nextSyncAt is due.
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
    const result = await syncDueDatabaseConnections();
    return NextResponse.json({
      ok: true,
      attempted: result.attempted,
      results: result.results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database sync cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
