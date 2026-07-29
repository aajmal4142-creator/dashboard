import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { getOAuthManager } from "@/lib/integrations/ecovadis/oauth";

export async function GET() {
  const ctx = await getCurrentContext();

  if (!ctx.activeOrg || (ctx.role !== "admin" && ctx.role !== "owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const manager = await getOAuthManager();
    const state = btoa(`${ctx.activeOrg.id}-${Date.now()}`);
    const url = manager.getAuthorizationUrl(state);

    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
