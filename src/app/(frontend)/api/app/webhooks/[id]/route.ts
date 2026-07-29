import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { assertMinRole } from "@/lib/access";
import {
  deleteWebhook,
  ApiError,
  ErrorCodes,
  createErrorResponse,
} from "@/lib/webhooks";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ctx = await getCurrentContext();

    if (!ctx.activeOrg) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(ErrorCodes.UNAUTHORIZED, 403, "No active organisation"),
        ),
        { status: 403 },
      );
    }

    // Check ABAC: admin only
    const isAdmin = await assertMinRole(ctx.activeOrg.id, "admin");
    if (!isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(ErrorCodes.UNAUTHORIZED, 403, "Admin access required"),
        ),
        { status: 403 },
      );
    }

    await deleteWebhook(id, ctx.activeOrg.id, ctx.user.id);

    return NextResponse.json({ ok: true, deleted: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    const statusCode = message.includes("not found") ? 404 : 400;

    return NextResponse.json(
      createErrorResponse(new Error(message)),
      { status: statusCode },
    );
  }
}
