import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getOAuthManager } from "@/lib/integrations/ecovadis/oauth";
import { isProductionRuntime } from "@/lib/launch/gates";

export async function GET(req: Request) {
  const ctx = await getCurrentContext();

  if (!ctx.activeOrg || (ctx.role !== "admin" && ctx.role !== "owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const manager = await getOAuthManager();

    // Generate state token (in production, store this in Redis with TTL)
    const state = btoa(`${ctx.activeOrg}-${Date.now()}`);

    const url = manager.getAuthorizationUrl(state);

    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 },
    );
  }
}
