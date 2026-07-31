import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { revokeReportEmbedToken } from "@/lib/reports/htmlReportShare";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string; token: string }> };

/**
 * DELETE /api/app/reports/[id]/embed-token/[token]
 * Revoke a single embed/share token (read-only access thereafter denied).
 */
export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, token: rawToken } = await ctx.params;
  const token = decodeURIComponent(rawToken);
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const orgId =
    typeof report.organisation === "object" && report.organisation !== null
      ? report.organisation.id
      : String(report.organisation);
  if (orgId !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");

  const revoked = await revokeReportEmbedToken(payload, {
    reportId: id,
    organisationId: auth.activeOrg.id,
    token,
    actorId: auth.user.id,
    ip,
    userAgent,
  });

  if (!revoked.ok) {
    return NextResponse.json({ error: revoked.error }, { status: revoked.status });
  }

  return NextResponse.json({
    revoked: true,
    alreadyRevoked: revoked.alreadyRevoked,
    tokenId: revoked.tokenId,
  });
}
