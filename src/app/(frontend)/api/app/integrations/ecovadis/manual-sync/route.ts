import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { syncEcoVadisSuppliers } from "@/lib/integrations/ecovadis/sync";

export async function POST(req: Request) {
  const ctx = await getCurrentContext();

  if (!ctx.activeOrg || (ctx.role !== "admin" && ctx.role !== "owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await syncEcoVadisSuppliers(ctx.activeOrg);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 },
    );
  }
}
