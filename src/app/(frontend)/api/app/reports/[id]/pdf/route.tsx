import { renderToBuffer } from "@react-pdf/renderer";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { can, resolveEffectivePlan } from "@/lib/billing";
import { ReportPdfDocument } from "@/lib/reports/ReportPdfDocument";
import type { ReportSnapshot } from "@/lib/reports";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
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

  const watermarked = !can(
    resolveEffectivePlan({
      plan: auth.activeOrg.plan,
      subscriptionStatus: auth.activeOrg.subscriptionStatus,
    }),
    "unwatermarked_pdf",
  );
  const buffer = await renderToBuffer(
    <ReportPdfDocument snapshot={snapshot} watermarked={watermarked} />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="clearesg-${snapshot.organisationName}-v${snapshot.version}.pdf"`,
    },
  });
}
