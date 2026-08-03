import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { escalateOverdueInternalRequests } from "@/lib/internal-requests";
import { isProductionRuntime } from "@/lib/launch/gates";
import config from "@/payload.config";

/**
 * Vercel cron → escalate overdue internal data requests (in-app notification).
 * CRON_SECRET required in production.
 * Schedule: daily 10:30 UTC (see vercel.json).
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
    const payload = await getPayload({ config });
    const result = await escalateOverdueInternalRequests(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal request escalate cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
