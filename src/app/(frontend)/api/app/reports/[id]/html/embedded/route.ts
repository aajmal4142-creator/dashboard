import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { buildEmbedCode } from "@/lib/reports/htmlReport";
import { mintReportShareLink } from "@/lib/reports/htmlReportShare";
import type { ReportSnapshot } from "@/lib/reports";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/reports/[id]/html/embedded
 * Mints (or returns) an embeddable iframe URL with a 7-day temp token.
 */
export async function GET(req: Request, ctx: Ctx) {
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

  const { id } = await ctx.params;
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

  const snapshot = report.snapshot as ReportSnapshot | null;
  if (!snapshot) {
    return NextResponse.json({ error: "Report has no snapshot" }, { status: 409 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");

  const minted = await mintReportShareLink(payload, {
    reportId: id,
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    origin: req.url,
    ip,
    userAgent,
  });

  if (!minted.ok) {
    return NextResponse.json({ error: minted.error }, { status: minted.status });
  }

  return NextResponse.json(
    {
      embedUrl: minted.result.embedUrl,
      embedCode: minted.result.embedCode ?? buildEmbedCode(minted.result.embedUrl),
      shareUrl: minted.result.shareUrl,
      expiresAt: minted.result.expiresAt,
      ttlDays: minted.result.ttlDays,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Content-Security-Policy": "frame-ancestors *",
      },
    },
  );
}
