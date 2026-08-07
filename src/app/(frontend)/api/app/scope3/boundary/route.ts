import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  buildScope3BoundaryMatrix,
  isScope3BoundaryStatus,
  type Scope3BoundaryEntry,
} from "@/lib/scope3/boundary";
import { isScope3CategoryNumber } from "@/lib/scope3/categories";
import { SCOPE3_BOUNDARIES_SLUG } from "@/collections/Scope3Boundaries";
import config from "@/payload.config";

/** GET /api/app/scope3/boundary — Cat 1–15 matrix merged with org decisions. */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "No active organisation" }, { status: 403 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "datapoint",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: SCOPE3_BOUNDARIES_SLUG,
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 15,
      overrideAccess: true,
    });

    const entries: Scope3BoundaryEntry[] = result.docs
      .filter((d) => isScope3CategoryNumber(d.category))
      .map((d) => ({
        category: d.category as Scope3BoundaryEntry["category"],
        status: isScope3BoundaryStatus(d.status) ? d.status : "not_assessed",
        rationale: d.rationale ?? null,
        updatedAt: d.updatedAt ?? null,
      }));

    return NextResponse.json({ matrix: buildScope3BoundaryMatrix(entries) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Scope3 boundary GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PATCH /api/app/scope3/boundary — upsert one category's decision. Body: { category, status, rationale? } */
export async function PATCH(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg || !ctx.user) {
      return NextResponse.json({ error: "No active organisation" }, { status: 403 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "datapoint",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      category?: number;
      status?: string;
      rationale?: string | null;
    };

    if (!isScope3CategoryNumber(body.category)) {
      return NextResponse.json(
        { error: "category must be an integer 1–15" },
        { status: 400 },
      );
    }
    if (!isScope3BoundaryStatus(body.status)) {
      return NextResponse.json(
        { error: "status must be included, excluded, or not_assessed" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const existing = await payload.find({
      collection: SCOPE3_BOUNDARIES_SLUG,
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { category: { equals: body.category } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });

    const rationale =
      body.rationale === undefined
        ? undefined
        : body.rationale && body.rationale.trim()
          ? body.rationale.trim()
          : null;

    if (existing.docs[0]) {
      await payload.update({
        collection: SCOPE3_BOUNDARIES_SLUG,
        id: existing.docs[0].id,
        data: {
          status: body.status,
          ...(rationale !== undefined ? { rationale } : {}),
        },
        overrideAccess: true,
      });
    } else {
      await payload.create({
        collection: SCOPE3_BOUNDARIES_SLUG,
        data: {
          organisation: ctx.activeOrg.id,
          category: body.category,
          status: body.status,
          rationale: rationale ?? undefined,
        },
        overrideAccess: true,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Scope3 boundary PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
