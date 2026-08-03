import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { listPathways } from "@/lib/assurance/pathways";

/**
 * GET /api/app/assurance/pathways
 * Typed limited vs reasonable pathway templates (evidence matrix + checkpoints).
 */
export async function GET() {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ pathways: listPathways() });
}
