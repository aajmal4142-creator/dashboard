import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import config from "@/payload.config";

function canManageKeys(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

function orgIdOf(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/app/settings/bi-keys/[id] — revoke a BI API key.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageKeys(ctx.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can revoke BI API keys." },
      { status: 403 },
    );
  }

  const { id } = await context.params;

  try {
    const payload = await getPayload({ config });
    const existing = await payload.findByID({
      collection: "bi-api-keys",
      id,
      overrideAccess: true,
    });

    if (!existing || orgIdOf(existing.organisation) !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    if (existing.status === "revoked") {
      return NextResponse.json({
        id,
        status: "revoked",
        note: "Key was already revoked.",
      });
    }

    await payload.update({
      collection: "bi-api-keys",
      id,
      data: {
        status: "revoked",
        revokedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "bi.key_revoked",
      entityType: "bi-api-keys",
      entityId: id,
      after: { apiKeyPrefix: existing.apiKeyPrefix ?? null },
    });

    return NextResponse.json({
      id,
      status: "revoked",
      note: "Key revoked. Existing BI connections using it will fail on the next request.",
    });
  } catch (error) {
    console.error("BI key revoke error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
