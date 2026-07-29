import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@/payload.config";
import { getCurrentContext } from "@/lib/auth";

export async function GET() {
  const ctx = await getCurrentContext();

  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active org" }, { status: 401 });
  }

  try {
    const payload = await getPayload({ config });

    const connection = await payload.find({
      collection: "ecovadis-connections",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 1,
      overrideAccess: true,
    });

    if (!connection.docs[0]) {
      return NextResponse.json({
        connected: false,
        status: "disconnected",
      });
    }

    const doc = connection.docs[0];

    return NextResponse.json({
      connected: doc.status === "connected",
      status: doc.status,
      connectedAt: doc.connectedAt,
      lastSyncAt: doc.lastSyncAt,
      lastSyncStatus: doc.lastSyncStatus,
      errorMessage: doc.errorMessage,
      syncCount: doc.syncCount,
      totalSuppliersSynced: doc.totalSuppliersSynced,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
