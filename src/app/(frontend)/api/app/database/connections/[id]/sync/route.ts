import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { sanitizeConnectorError, syncDatabaseConnection } from "@/lib/database";

import { requireOrgAdmin } from "../../../_shared";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/app/database/connections/[id]/sync — trigger one-shot sync.
 */
export async function POST(_request: Request, ctx: RouteCtx) {
  const auth = await getCurrentContext();
  const denied = requireOrgAdmin(auth);
  if (denied) return denied;

  const { id } = await ctx.params;

  try {
    const result = await syncDatabaseConnection({
      organisationId: auth.activeOrg!.id,
      connectionId: id,
      triggeredBy: auth.user!.id,
      trigger: "user",
    });

    const statusCode =
      result.status === "failed" ? 422 : result.status === "partial" ? 207 : 200;

    return NextResponse.json(
      {
        ...result,
        message:
          result.status === "success"
            ? "Sync completed"
            : result.status === "partial"
              ? "Sync completed with some row failures. Check errors and sync history."
              : (result.errors[0]?.message ??
                "Sync failed. Check connection mapping and period status."),
      },
      { status: statusCode },
    );
  } catch (err) {
    return NextResponse.json({ error: sanitizeConnectorError(err) }, { status: 422 });
  }
}
