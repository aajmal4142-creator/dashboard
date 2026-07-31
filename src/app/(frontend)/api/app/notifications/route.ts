import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  buildUserOrgNotificationWhere,
  groupNotificationsByType,
  mapNotificationDoc,
  markAllReadData,
  parseNotificationListParams,
} from "@/lib/notifications";
import { findNotifications, updateNotification } from "@/lib/notifications/store";
import config from "@/payload.config";

/** GET /api/app/notifications — list own org-scoped notifications. */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const { limit, unreadOnly } = parseNotificationListParams(url.searchParams);

  const payload = await getPayload({ config });
  const result = await findNotifications(payload, {
    where: buildUserOrgNotificationWhere(ctx.user.id, ctx.activeOrg.id, {
      unreadOnly,
    }),
    sort: "-createdAt",
    limit,
  });

  const notifications = result.docs
    .map((doc) => mapNotificationDoc(doc))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return NextResponse.json({
    notifications,
    groups: groupNotificationsByType(notifications),
    total: result.totalDocs,
    unreadOnly,
    limit,
  });
}

/** PATCH /api/app/notifications — mark all unread as read (optional). */
export async function PATCH() {
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
  const unread = await findNotifications(payload, {
    where: buildUserOrgNotificationWhere(ctx.user.id, ctx.activeOrg.id, {
      unreadOnly: true,
    }),
    limit: 200,
  });

  const data = markAllReadData();
  let marked = 0;
  for (const doc of unread.docs) {
    await updateNotification(payload, String(doc.id), data);
    marked += 1;
  }

  return NextResponse.json({ ok: true, marked });
}
