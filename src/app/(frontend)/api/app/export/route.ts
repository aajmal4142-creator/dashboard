import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * Full-account data export before charging. §15.3 / §18.2
 * Structured datapoints include XBRL-shaped taxonomyRef + datapointId.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Owner or admin required" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const orgId = ctx.activeOrg.id;

  const [org, periods, datapoints, evidence, reports, suppliers] = await Promise.all([
    payload.findByID({
      collection: "organisations",
      id: orgId,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: "reporting-periods",
      where: { organisation: { equals: orgId } },
      limit: 100,
      overrideAccess: true,
    }),
    payload.find({
      collection: "datapoints",
      where: { organisation: { equals: orgId } },
      limit: 5000,
      overrideAccess: true,
    }),
    payload.find({
      collection: "evidence",
      where: { organisation: { equals: orgId } },
      limit: 5000,
      overrideAccess: true,
    }),
    payload.find({
      collection: "reports",
      where: { organisation: { equals: orgId } },
      limit: 100,
      overrideAccess: true,
    }),
    payload.find({
      collection: "suppliers",
      where: { organisation: { equals: orgId } },
      limit: 1000,
      overrideAccess: true,
    }),
  ]);

  const exportBody = {
    exportedAt: new Date().toISOString(),
    format: "clearesg.account.v1",
    note: "Structured export you or your filing agent can tag. Not filing-ready XBRL.",
    organisation: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      sector: org.sector,
      country: org.country,
      plan: org.plan,
    },
    periods: periods.docs,
    datapoints: datapoints.docs.map((d) => ({
      datapointId: d.id,
      taxonomyRef: d.metricKey,
      metricKey: d.metricKey,
      value: d.value,
      unit: d.unit,
      quality: d.quality,
      approvalState: d.approvalState,
      source: d.source,
      period: d.period,
      evidence: d.evidence,
    })),
    evidence: evidence.docs.map((e) => ({
      id: e.id,
      filename: e.filename,
      sha256: e.sha256,
      ocrStatus: e.ocrStatus,
      createdAt: e.createdAt,
    })),
    reports: reports.docs.map((r) => ({
      id: r.id,
      framework: r.framework,
      version: r.version,
      status: r.status,
      publishedAt: r.publishedAt,
      snapshot: r.snapshot,
    })),
    suppliers: suppliers.docs.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      requestStatus: s.requestStatus,
      submittedData: s.submittedData,
    })),
  };

  return new NextResponse(JSON.stringify(exportBody, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="clearesg-export-${org.slug}.json"`,
    },
  });
}
