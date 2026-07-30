import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });

  const accountingResult = await payload.find({
    collection: "accounting-connections",
    where: { organisationId: { equals: ctx.activeOrg.id } },
    limit: 100,
    overrideAccess: true,
  });

  return NextResponse.json({
    accounting: accountingResult.docs.map((doc) => ({
      id: doc.id,
      provider: doc.provider,
      status: doc.status,
      connectedAt: doc.connectedAt,
      lastSyncAt: doc.lastSyncAt,
      lastSyncStatus: doc.lastSyncStatus,
    })),
  });
}
