import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { mapAlertRuleDoc, orgIdFromDoc, parseMuteBody } from "@/lib/alerts";
import { findAlertRuleById, updateAlertRule } from "@/lib/alerts/store";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/app/alerts/[id]/mute — mute or unmute a rule. */
export async function POST(req: Request, routeCtx: RouteCtx) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can mute alert rules." },
        { status: 403 },
      );
    }

    const { id } = await routeCtx.params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = parseMuteBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const payload = await getPayload({ config });
    let doc: Awaited<ReturnType<typeof findAlertRuleById>>;
    try {
      doc = await findAlertRuleById(payload, id);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (orgIdFromDoc(doc) !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await updateAlertRule(payload, doc.id, {
      muted: parsed.data.muted,
      mutedUntil: parsed.data.muted ? (parsed.data.mutedUntil ?? null) : null,
    });

    const rule = mapAlertRuleDoc(updated);
    return NextResponse.json({ rule });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error muting alert rule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
