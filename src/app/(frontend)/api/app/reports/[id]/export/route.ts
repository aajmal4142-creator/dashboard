import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { snapshotToCsv, type ReportSnapshot } from "@/lib/reports";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const format = new URL(req.url).searchParams.get("format") ?? "json";
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
    return NextResponse.json({ error: "No snapshot" }, { status: 409 });
  }

  if (format === "csv") {
    return new NextResponse(snapshotToCsv(snapshot), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clearesg-v${snapshot.version}.csv"`,
      },
    });
  }

  return NextResponse.json(snapshot);
}
