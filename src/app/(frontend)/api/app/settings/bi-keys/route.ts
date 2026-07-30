import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import { generateBiApiKey } from "@/lib/bi";
import config from "@/payload.config";

function canManageKeys(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

function publicKey(doc: {
  id: string;
  name: string;
  apiKeyPrefix?: string | null;
  status?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: doc.id,
    name: doc.name,
    apiKeyPrefix: doc.apiKeyPrefix ?? null,
    status: doc.status ?? "active",
    lastUsedAt: doc.lastUsedAt ?? null,
    revokedAt: doc.revokedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * GET /api/app/settings/bi-keys — list BI API keys for active org.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "bi-api-keys",
      where: { organisation: { equals: ctx.activeOrg.id } },
      sort: "-createdAt",
      limit: 100,
      overrideAccess: true,
    });

    return NextResponse.json({
      keys: result.docs.map((d) => publicKey(d)),
      total: result.totalDocs,
      canManage: canManageKeys(ctx.role),
    });
  } catch (error) {
    console.error("BI keys list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/settings/bi-keys — create key; returns plaintext once.
 */
export async function POST(request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageKeys(ctx.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can create BI API keys." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { apiKey, apiKeyHash, apiKeyPrefix } = generateBiApiKey();
    const payload = await getPayload({ config });

    const created = await (
      payload.create as (args: {
        collection: "bi-api-keys";
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<{
        id: string;
        name: string;
        apiKeyPrefix?: string | null;
        status?: string | null;
        lastUsedAt?: string | null;
        revokedAt?: string | null;
        createdAt: string;
        updatedAt: string;
      }>
    )({
      collection: "bi-api-keys",
      data: {
        organisation: ctx.activeOrg.id,
        name,
        apiKeyHash,
        apiKeyPrefix,
        status: "active",
        createdBy: ctx.user.id,
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "bi.key_created",
      entityType: "bi-api-keys",
      entityId: created.id,
      after: { name, apiKeyPrefix },
    });

    return NextResponse.json(
      {
        key: publicKey(created),
        apiKey,
        note: "Store this API key now. It cannot be retrieved again — only revoked.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("BI key create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
