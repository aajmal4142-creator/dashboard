import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@/payload.config";
import { getCurrentContext } from "@/lib/auth";
import {
  getOAuthManager,
  getOrRefreshToken,
} from "@/lib/integrations/ecovadis/oauth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state parameter" },
      { status: 400 },
    );
  }

  try {
    const ctx = await getCurrentContext();

    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "No active org" }, { status: 401 });
    }

    // Verify state (in production, check against Redis/DB)
    const expectedState = btoa(`${ctx.activeOrg}-`);
    if (!state.startsWith(expectedState)) {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    const manager = await getOAuthManager();
    const token = await manager.exchangeAuthCode(code);

    const payload = await getPayload({ config });

    // Check if connection exists
    const existing = await payload.find({
      collection: "ecovadis-connections",
      where: { organisation: { equals: ctx.activeOrg } },
      limit: 1,
      overrideAccess: true,
    });

    if (existing.docs[0]) {
      // Update existing
      await payload.update({
        collection: "ecovadis-connections",
        id: existing.docs[0].id,
        data: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          expiresAt: token.expiresAt,
          status: "connected",
          connectedAt: new Date(),
          lastSyncStatus: "pending",
        },
        overrideAccess: true,
      });
    } else {
      // Create new
      await payload.create({
        collection: "ecovadis-connections",
        data: {
          organisation: ctx.activeOrg,
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          expiresAt: token.expiresAt,
          status: "connected",
          connectedAt: new Date(),
          lastSyncStatus: "pending",
          syncCount: 0,
          totalSuppliersSynced: 0,
        },
        overrideAccess: true,
      });
    }

    // Redirect to success page (or return JSON for API clients)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/integrations/ecovadis?success=true`,
    );
  } catch (error) {
    console.error("EcoVadis callback error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 },
    );
  }
}
