import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { riskOf, sortByDeadlineRisk, type ClientRiskRow } from "@/lib/consultant";
import { SECTOR_TEMPLATES } from "@/lib/consultant/templates";
import config from "@/payload.config";

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }
  if (ctx.activeOrg.type !== "consultancy") {
    return NextResponse.json(
      { error: "Switch to a consultancy organisation to open Command Centre" },
      { status: 403 },
    );
  }

  const payload = await getPayload({ config });
  const children = await payload.find({
    collection: "organisations",
    where: { parentOrg: { equals: ctx.activeOrg.id } },
    limit: 200,
    overrideAccess: true,
  });

  const rows: ClientRiskRow[] = [];
  for (const child of children.docs) {
    const obligations = await payload.find({
      collection: "compliance-obligations",
      where: { organisation: { equals: child.id } },
      limit: 1,
      sort: "filingDeadline",
      overrideAccess: true,
    });
    const deadline = obligations.docs[0]?.filingDeadline
      ? String(obligations.docs[0].filingDeadline)
      : null;
    const days = deadline ? daysUntil(deadline) : null;

    const periods = await payload.find({
      collection: "reporting-periods",
      where: {
        and: [{ organisation: { equals: child.id } }, { status: { equals: "open" } }],
      },
      limit: 1,
      overrideAccess: true,
    });
    let collected = 0;
    if (periods.docs[0]) {
      const dps = await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: child.id } },
            { period: { equals: periods.docs[0].id } },
            { quality: { not_equals: "missing" } },
          ],
        },
        limit: 100,
        overrideAccess: true,
      });
      collected = dps.docs.length;
    }

    const reports = await payload.find({
      collection: "reports",
      where: {
        and: [
          { organisation: { equals: child.id } },
          { status: { equals: "published" } },
        ],
      },
      sort: "-version",
      limit: 1,
      overrideAccess: true,
    });

    const required = 18;
    rows.push({
      id: child.id,
      name: child.name,
      slug: child.slug,
      sector: child.sector,
      country: child.country,
      plan: child.plan ?? "free",
      daysToFiling: days,
      datapointsCollected: collected,
      datapointsRequired: required,
      overallScore: reports.docs[0]?.scores?.overall ?? null,
      risk: riskOf(days, collected, required),
    });
  }

  return NextResponse.json({
    consultancy: {
      id: ctx.activeOrg.id,
      name: ctx.activeOrg.name,
      plan: ctx.activeOrg.plan,
      brand: ctx.activeOrg.brand,
      clientCount: rows.length,
      clientCap: ctx.activeOrg.plan === "consultant" ? 10 : 3,
    },
    clients: sortByDeadlineRisk(rows),
    templates: SECTOR_TEMPLATES,
  });
}
