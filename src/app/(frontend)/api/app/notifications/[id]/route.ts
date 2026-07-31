import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { deleteNotification, findNotificationById } from "@/lib/notifications/store";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

function relId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/** DELETE /api/app/notifications/[id] */
export async function DELETE(_req: Request, routeCtx: Ctx) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const { id } = await routeCtx.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const payload = await getPayload({ config });
  let doc: Awaited<ReturnType<typeof findNotificationById>>;
  try {
    doc = await findNotificationById(payload, id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ownerId = relId(doc.userId);
  const orgId = relId(doc.organisationId);

  if (ownerId !== ctx.user.id || orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteNotification(payload, doc.id);

  return NextResponse.json({ ok: true, id: doc.id });
}
