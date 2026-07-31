import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import {
  generateBiApiKey,
  parseAllowedIps,
  quotaPercentageUsed,
  remainingFromUsed,
  resolveBiQuotaLimits,
} from "@/lib/bi";
import { normalizePlan } from "@/lib/billing/plans";
import config from "@/payload.config";

function canManageKeys(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

function publicKey(
  doc: {
    id: string;
    name: string;
    apiKeyPrefix?: string | null;
    status?: string | null;
    lastUsedAt?: string | null;
    revokedAt?: string | null;
    quotaLimitPerHour?: number | null;
    quotaLimitPerDay?: number | null;
    quotaResetAt?: string | null;
    callsThisHour?: number | null;
    callsToday?: number | null;
    allowedIps?: { ip?: string | null }[] | null;
    createdAt: string;
    updatedAt: string;
  },
  plan: string,
) {
  const limits = resolveBiQuotaLimits(plan, {
    quotaLimitPerHour: doc.quotaLimitPerHour,
    quotaLimitPerDay: doc.quotaLimitPerDay,
  });
  const usedHour = doc.callsThisHour ?? 0;
  const usedDay = doc.callsToday ?? 0;
  return {
    id: doc.id,
    name: doc.name,
    apiKeyPrefix: doc.apiKeyPrefix ?? null,
    status: doc.status ?? "active",
    lastUsedAt: doc.lastUsedAt ?? null,
    revokedAt: doc.revokedAt ?? null,
    quotaLimitPerHour: limits.perHour,
    quotaLimitPerDay: limits.perDay,
    callsThisHour: usedHour,
    callsToday: usedDay,
    remainingHour: remainingFromUsed(usedHour, limits.perHour),
    remainingDay: remainingFromUsed(usedDay, limits.perDay),
    percentHour: quotaPercentageUsed(usedHour, limits.perHour),
    percentDay: quotaPercentageUsed(usedDay, limits.perDay),
    quotaResetAt: doc.quotaResetAt ?? null,
    allowedIps: parseAllowedIps(doc.allowedIps),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * GET /api/app/settings/bi-keys — list BI API keys + plan quota usage for active org.
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getPayload({ config });
    const plan = normalizePlan(ctx.activeOrg.plan);
    const limits = resolveBiQuotaLimits(plan);
    const result = await payload.find({
      collection: "bi-api-keys",
      where: { organisation: { equals: ctx.activeOrg.id } },
      sort: "-createdAt",
      limit: 100,
      overrideAccess: true,
    });

    return NextResponse.json({
      keys: result.docs.map((d) => publicKey(d, plan)),
      total: result.totalDocs,
      canManage: canManageKeys(ctx.role),
      quota: {
        plan,
        perHour: limits.perHour,
        perDay: limits.perDay,
        unlimited: limits.perHour == null && limits.perDay == null,
      },
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
    const body = (await request.json()) as {
      name?: string;
      quotaLimitPerHour?: number;
      quotaLimitPerDay?: number;
      allowedIps?: string[];
    };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { apiKey, apiKeyHash, apiKeyPrefix } = generateBiApiKey();
    const payload = await getPayload({ config });
    const plan = normalizePlan(ctx.activeOrg.plan);
    const allowedIps = Array.isArray(body.allowedIps)
      ? body.allowedIps
          .filter((ip): ip is string => typeof ip === "string")
          .map((ip) => ip.trim())
          .filter(Boolean)
          .map((ip) => ({ ip }))
      : undefined;

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
        quotaLimitPerHour?: number | null;
        quotaLimitPerDay?: number | null;
        quotaResetAt?: string | null;
        callsThisHour?: number | null;
        callsToday?: number | null;
        allowedIps?: { ip?: string | null }[] | null;
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
        callsThisHour: 0,
        callsToday: 0,
        ...(typeof body.quotaLimitPerHour === "number" && body.quotaLimitPerHour > 0
          ? { quotaLimitPerHour: body.quotaLimitPerHour }
          : {}),
        ...(typeof body.quotaLimitPerDay === "number" && body.quotaLimitPerDay > 0
          ? { quotaLimitPerDay: body.quotaLimitPerDay }
          : {}),
        ...(allowedIps && allowedIps.length > 0 ? { allowedIps } : {}),
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
        key: publicKey(created, plan),
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
