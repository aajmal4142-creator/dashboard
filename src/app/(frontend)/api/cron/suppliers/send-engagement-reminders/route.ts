import { NextResponse } from "next/server";

import { isProductionRuntime } from "@/lib/launch/gates";
import { sendEngagementReminders } from "@/lib/suppliers";

/**
 * Vercel cron → day-7 / day-14 engagement reminders for invited (not started) questionnaires.
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

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;

  try {
    const result = await sendEngagementReminders(origin);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Engagement reminder cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
