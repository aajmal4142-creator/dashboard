import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { getJourneyTelemetry, hoursToFirstReport } from "@/lib/telemetry/journey";

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    organisationId: ctx.activeOrg.id,
    events: getJourneyTelemetry(ctx.activeOrg.id)?.events ?? {},
    hoursToFirstReport: hoursToFirstReport(ctx.activeOrg.id),
    note: "No public hours-saved claim until this metric is populated in production.",
  });
}
