import { getPayload } from "payload";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { SOCIAL_MAPPED_METRIC_KEYS } from "@/lib/social";
import { ensureOpenPeriod } from "@/lib/org/period";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

const MAPPED = new Set<string>(SOCIAL_MAPPED_METRIC_KEYS);

type Quality = "measured" | "calculated" | "estimated" | "missing";

function asQuality(value: unknown): Quality | null {
  if (
    value === "measured" ||
    value === "calculated" ||
    value === "estimated" ||
    value === "missing"
  ) {
    return value;
  }
  return null;
}

/**
 * POST /api/app/social/values
 * Upsert a mapped social metric datapoint for the active org period.
 * Unmapped indicators cannot be written here — they remain catalog gaps.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "datapoint",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      metricKey?: unknown;
      value?: unknown;
      quality?: unknown;
      periodId?: unknown;
      unit?: unknown;
    };

    const metricKey = typeof body.metricKey === "string" ? body.metricKey.trim() : "";
    if (!metricKey || !MAPPED.has(metricKey)) {
      return NextResponse.json(
        {
          error:
            "metricKey must be a mapped social metric (see SOCIAL_MAPPED_METRIC_KEYS).",
        },
        { status: 400 },
      );
    }

    if (typeof body.value !== "number" || !Number.isFinite(body.value)) {
      return NextResponse.json(
        { error: "value must be a finite number." },
        { status: 400 },
      );
    }

    const quality = asQuality(body.quality) ?? "measured";
    const unit = typeof body.unit === "string" ? body.unit : undefined;

    const payload = await getPayload({ config });
    const periodId =
      typeof body.periodId === "string" && body.periodId.length > 0
        ? body.periodId
        : await ensureOpenPeriod(
            ctx.activeOrg.id,
            ctx.activeOrg.plan,
            ctx.activeOrg.subscriptionStatus,
          );

    const period = await payload.findByID({
      collection: "reporting-periods",
      id: periodId,
      depth: 0,
      overrideAccess: true,
    });
    const periodOrg =
      typeof period.organisation === "string"
        ? period.organisation
        : period.organisation?.id;
    if (periodOrg !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Period not in organisation" }, { status: 403 });
    }

    const existing = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: periodId } },
          { metricKey: { equals: metricKey } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    const data = {
      organisation: ctx.activeOrg.id,
      period: periodId,
      metricKey,
      value: body.value,
      quality,
      provenance: "manual" as const,
      source: "manual" as const,
      approvalState: "pending" as const,
      ...(unit !== undefined ? { unit } : {}),
    };

    if (existing.docs[0]) {
      const canEdit = await requirePermission(
        ctx.user.id,
        ctx.activeOrg.id,
        "edit",
        "datapoint",
        String(existing.docs[0].id),
        "organisation",
      );
      if (!canEdit) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const updated = await payload.update({
        collection: "datapoints",
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      });
      return NextResponse.json({
        success: true,
        action: "updated",
        datapoint: {
          id: String(updated.id),
          metricKey: String(updated.metricKey),
          value: updated.value ?? null,
          quality: updated.quality,
        },
      });
    }

    const created = await payload.create({
      collection: "datapoints",
      data,
      overrideAccess: true,
    });

    return NextResponse.json({
      success: true,
      action: "created",
      datapoint: {
        id: String(created.id),
        metricKey: String(created.metricKey),
        value: created.value ?? null,
        quality: created.quality,
      },
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Social values upsert error:", error);
    return NextResponse.json(
      { error: "Failed to save social datapoint" },
      { status: 500 },
    );
  }
}
