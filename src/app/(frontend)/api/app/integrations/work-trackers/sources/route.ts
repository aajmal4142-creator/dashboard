import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { listPushableSourceItems } from "@/lib/integrations/workTrackers";
import config from "@/payload.config";

/**
 * GET /api/app/integrations/work-trackers/sources
 * Internal requests + compliance obligations available to push.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const sources = await listPushableSourceItems(payload, ctx.activeOrg.id);
  return NextResponse.json({ sources });
}
