import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { buildUnreadCountWhere } from "@/lib/notifications";
import { countNotifications } from "@/lib/notifications/store";
import config from "@/payload.config";

/** GET /api/app/notifications/unread-count */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const payload = await getPayload({ config });
  const result = await countNotifications(
    payload,
    buildUnreadCountWhere(ctx.user.id, ctx.activeOrg.id),
  );

  return NextResponse.json({ count: result.totalDocs });
}
