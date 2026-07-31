import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { isTimeRange } from "@/lib/dashboards";
import { resolveWidgetData } from "@/lib/dashboards/widgetData";
import config from "@/payload.config";

/** GET /api/app/dashboards/widget-data?metric=&timeRange= */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      { error: "No active organisation. Finish onboarding or switch organisation." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const metric = (url.searchParams.get("metric") ?? "").trim();
  const timeRangeRaw = (url.searchParams.get("timeRange") ?? "3m").trim();

  if (!metric) {
    return NextResponse.json({ error: "metric is required." }, { status: 400 });
  }
  if (!isTimeRange(timeRangeRaw)) {
    return NextResponse.json(
      { error: "timeRange must be one of 1m, 3m, 6m, 1y." },
      { status: 400 },
    );
  }

  try {
    const payload = await getPayload({ config });
    const data = await resolveWidgetData(payload, ctx.activeOrg.id, metric, timeRangeRaw);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load widget data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
