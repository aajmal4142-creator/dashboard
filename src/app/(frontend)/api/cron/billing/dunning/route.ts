import { NextResponse } from "next/server";

import { processDueDunningRetries } from "@/lib/billing";
import { isProductionRuntime } from "@/lib/launch/gates";

/**
 * Vercel cron → execute due dunning payment retries.
 * CRON_SECRET required in production.
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
    const result = await processDueDunningRetries();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dunning cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
