import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { buildOrgAlertWhere, mapAlertRuleDoc, parseCreateBody } from "@/lib/alerts";
import { createAlertRule, findAlertRules } from "@/lib/alerts/store";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

/** GET /api/app/alerts — list org alert rules (active / triggered / muted). */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload({ config });
    const result = await findAlertRules(payload, {
      where: buildOrgAlertWhere(ctx.activeOrg.id),
      sort: "-updatedAt",
      limit: 200,
    });

    const rules = result.docs
      .map((doc) => mapAlertRuleDoc(doc))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const active = rules.filter((r) => r.status === "active").length;
    const triggered = rules.filter((r) => r.status === "triggered").length;
    const muted = rules.filter((r) => r.status === "muted").length;
    const disabled = rules.filter((r) => r.status === "disabled").length;

    return NextResponse.json({
      rules,
      total: result.totalDocs,
      summary: { active, triggered, muted, disabled },
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing alert rules:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/app/alerts — create an alert rule. */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can manage alert rules." },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = parseCreateBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const created = await createAlertRule(payload, {
      organisation: ctx.activeOrg.id,
      name: parsed.data.name,
      enabled: parsed.data.enabled !== false,
      condition: parsed.data.condition,
      actions: parsed.data.actions,
      muted: parsed.data.muted === true,
      mutedUntil: parsed.data.mutedUntil ?? null,
      triggeredCount: 0,
      createdBy: ctx.user.id,
    });

    const rule = mapAlertRuleDoc(created);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating alert rule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
