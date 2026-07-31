import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { evaluateAllOrganisationAlerts } from "@/lib/alerts/cron";
import { isProductionRuntime } from "@/lib/launch/gates";
import config from "@/payload.config";

/**
 * Vercel cron → evaluate enabled alert rules for all orgs that have them.
 * CRON_SECRET required in production.
 * Schedule: hourly (vercel.json).
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
    const result = await evaluateAllOrganisationAlerts(payload);
    return NextResponse.json({
      ok: true,
      organisations: result.organisations,
      results: result.results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Alert evaluate cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
