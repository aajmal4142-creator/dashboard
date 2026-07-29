import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@/payload.config";
import { getCurrentContext } from "@/lib/auth";

export async function POST() {
  const ctx = await getCurrentContext();

  if (!ctx.activeOrg || (ctx.role !== "admin" && ctx.role !== "owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      return NextResponse.json({ error: "Not connected" }, { status: 404 });
    }

    await payload.update({
      collection: "ecovadis-connections",
      id: connection.docs[0].id,
      data: {
        status: "disconnected",
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
