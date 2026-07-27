import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { templateForSector } from "@/lib/consultant";
import config from "@/payload.config";

/** Export all client summaries as JSON (bulk). */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || ctx.activeOrg.type !== "consultancy") {
    return NextResponse.json({ error: "Consultancy required" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const children = await payload.find({
    collection: "organisations",
    where: { parentOrg: { equals: ctx.activeOrg.id } },
    limit: 200,
    overrideAccess: true,
  });

  const exportRows = children.docs.map((c) => ({
    id: c.id,
    name: c.name,
    sector: c.sector,
    country: c.country,
    plan: c.plan,
    template: templateForSector(c.sector),
  }));

  return NextResponse.json({
    consultancy: ctx.activeOrg.name,
    exportedAt: new Date().toISOString(),
    clients: exportRows,
  });
}
