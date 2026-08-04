import { renderToBuffer } from "@react-pdf/renderer";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { can, resolveEffectivePlan } from "@/lib/billing";
import {
  computeCsrdCoverage,
  CsrdEsrsPdfDocument,
  type CsrdDatapointInput,
} from "@/lib/frameworks/csrd";
import type { ReportSnapshot } from "@/lib/reports";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

function evidenceIdsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.length > 0) return [item];
    if (typeof item === "object" && item !== null && "id" in item) {
      const id = (item as { id: unknown }).id;
      if (typeof id === "string" && id.length > 0) return [id];
    }
    return [];
  });
}

function asQuality(value: unknown): CsrdDatapointInput["quality"] {
  if (
    value === "measured" ||
    value === "calculated" ||
    value === "estimated" ||
    value === "missing"
  ) {
    return value;
  }
  return "missing";
}

function asProvenance(value: unknown): CsrdDatapointInput["provenance"] {
  if (value === "supplier_primary" || value === "spend_estimate" || value === "manual") {
    return value;
  }
  return null;
}

/**
 * GET /api/app/reports/[id]/csrd-pdf
 * Filing-oriented CSRD/ESRS PDF from the published report snapshot (always light).
 */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "export",
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

  const periodId =
    typeof report.period === "object" && report.period !== null
      ? String(report.period.id)
      : String(report.period);

  let coverage = null;
  try {
    const datapoints = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: auth.activeOrg.id } },
          { period: { equals: periodId } },
        ],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    });
    const inputs: CsrdDatapointInput[] = datapoints.docs.map((doc) => ({
      metricKey: String(doc.metricKey),
      quality: asQuality(doc.quality),
      provenance: asProvenance(doc.provenance),
      evidenceIds: evidenceIdsOf(doc.evidence),
    }));
    coverage = computeCsrdCoverage({ periodId, datapoints: inputs });
  } catch {
    coverage = null;
  }

  const watermarked = !can(
    resolveEffectivePlan({
      plan: auth.activeOrg.plan,
      subscriptionStatus: auth.activeOrg.subscriptionStatus,
    }),
    "unwatermarked_pdf",
  );

  const buffer = await renderToBuffer(
    <CsrdEsrsPdfDocument
      snapshot={snapshot}
      coverage={coverage}
      watermarked={watermarked}
    />,
  );

  const safeOrg = snapshot.organisationName
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const filename = `clearesg-csrd-esrs-${safeOrg || "org"}-${id}.pdf`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
