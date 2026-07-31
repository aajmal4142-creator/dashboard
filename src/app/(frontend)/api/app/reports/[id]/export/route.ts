import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  CONFIRMED_APPROVAL_STATE,
  parseMachineExportFormat,
  snapshotToJsonExport,
  snapshotToXmlExport,
  type MachineExportDatapointInput,
} from "@/lib/reports/machineExport";
import { snapshotToCsv, type ReportSnapshot } from "@/lib/reports";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

/**
 * GET /api/app/reports/[id]/export?format=json|xml|csv
 * Membership-gated machine-readable export. Confirmed datapoints only.
 */
export async function GET(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = parseMachineExportFormat(new URL(req.url).searchParams.get("format"));
  if (!format) {
    return NextResponse.json(
      { error: "Unsupported format. Use format=json, format=xml, or format=csv." },
      { status: 400 },
    );
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

  const orgId = relationId(report.organisation);
  if (!orgId || orgId !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const snapshot = report.snapshot as ReportSnapshot | null;
  if (!snapshot) {
    return NextResponse.json({ error: "No snapshot" }, { status: 409 });
  }

  const periodId = relationId(report.period);
  const baseName = `clearesg-v${snapshot.version}`;

  if (format === "csv") {
    return new NextResponse(snapshotToCsv(snapshot), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  const confirmed = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: orgId } },
        ...(periodId ? [{ period: { equals: periodId } }] : []),
        { approvalState: { equals: CONFIRMED_APPROVAL_STATE } },
      ],
    },
    limit: 5000,
    overrideAccess: true,
  });

  const datapoints: MachineExportDatapointInput[] = confirmed.docs.map((d) => ({
    id: String(d.id),
    value: d.value,
    unit: d.unit,
    metricKey: d.metricKey,
    quality: d.quality,
    approvalState: d.approvalState,
    enteredAt: d.enteredAt ?? null,
    updatedAt: d.updatedAt,
    createdAt: d.createdAt,
  }));

  const exportCtx = {
    organisationId: orgId,
    periodId,
    status: typeof report.status === "string" ? report.status : null,
    datapoints,
  };

  if (format === "xml") {
    const xml = snapshotToXmlExport(snapshot, exportCtx);
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.xml"`,
      },
    });
  }

  const json = snapshotToJsonExport(snapshot, exportCtx);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.json"`,
    },
  });
}
