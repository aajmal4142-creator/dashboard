import { getPayload } from "payload";
import { NextResponse } from "next/server";

import type { MetricSeries } from "@/lib/alerts";
import { evaluateOrganisationAlerts } from "@/lib/alerts/trigger";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

function parseSeriesOverride(raw: unknown): MetricSeries[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: MetricSeries[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (typeof row.metric !== "string" || !row.metric.trim()) continue;
    if (!Array.isArray(row.values)) continue;
    const values: number[] = [];
    for (const v of row.values) {
      if (typeof v === "number" && Number.isFinite(v)) values.push(v);
    }
    out.push({ metric: row.metric.trim(), values });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * POST /api/app/alerts/evaluate
 * Evaluate enabled (non-muted) rules; fire notify/email/Slack when configured.
 * Optional body: { ruleIds?: string[], series?: MetricSeries[] }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin" && ctx.role !== "contributor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const obj =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    const ruleIds =
      Array.isArray(obj.ruleIds) && obj.ruleIds.every((id) => typeof id === "string")
        ? (obj.ruleIds as string[])
        : undefined;

    const seriesOverride = parseSeriesOverride(obj.series);

    const payload = await getPayload({ config });
    const result = await evaluateOrganisationAlerts(payload, ctx.activeOrg.id, {
      seriesOverride,
      ruleIds,
      actorId: ctx.user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error evaluating alert rules:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
