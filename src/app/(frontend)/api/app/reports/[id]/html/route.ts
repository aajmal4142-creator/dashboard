import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import type { ReportSnapshot } from "@/lib/reports";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/app/reports/[id]/html
 * Authenticated: redirect to interactive HTML report page (Membership-gated).
 * ?json=1 returns the URL for embed/preview modals.
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

  const url = new URL(req.url);
  const htmlPath = `/reports/${id}/html`;
  const htmlUrl = `${url.origin}${htmlPath}`;
  const previewUrl = `${htmlUrl}?embed=1`;

  if (url.searchParams.get("json") === "1") {
    return NextResponse.json({
      htmlUrl,
      previewUrl,
      organisationName: snapshot.organisationName,
      version: snapshot.version,
      generatedAt: new Date().toISOString(),
    });
  }

  return NextResponse.redirect(new URL(htmlPath, url.origin), 302);
}
