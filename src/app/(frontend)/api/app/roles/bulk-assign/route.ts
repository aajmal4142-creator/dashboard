import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "memberships",
    ctx.activeOrg.id,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { roleId, userIds } = body;

  if (!roleId || !userIds || !Array.isArray(userIds)) {
    return NextResponse.json(
      { error: "Missing required fields: roleId, userIds (array)" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });

  try {
    const results = await Promise.all(
      userIds.map(async (userId: string) => {
        const membership = await payload.find({
          collection: "memberships",
          where: {
            and: [
              { user: { equals: userId } },
              { organisation: { equals: ctx.activeOrg!.id } },
            ],
          },
          limit: 1,
        });

        if (membership.docs.length === 0) {
          return { userId, success: false, error: "Membership not found" };
        }

        const updated = await payload.update({
          collection: "memberships",
          id: String(membership.docs[0].id),
          data: { role: roleId },
        });

        return { userId, success: true, membshipId: updated.id };
      }),
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json(
      {
        message: `Assigned role to ${successful} users${failed > 0 ? `, ${failed} failed` : ""}`,
        results,
      },
      { status: successful > 0 ? 200 : 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to assign roles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
