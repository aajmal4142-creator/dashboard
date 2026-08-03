import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { POLICIES_SLUG } from "@/collections/Policies";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToPolicy,
  getOrgPolicy,
  isPolicyCategory,
  isPolicyStatus,
  parseEffectiveDate,
  parseOptionalUrl,
} from "@/lib/policies";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

function canDelete(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * GET /api/app/policy-library/[id]
 * PUT — update
 * DELETE — remove (admin+)
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const policy = await getOrgPolicy(payload, ctx.activeOrg.id, id);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    return NextResponse.json({ policy });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Policy library get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const existing = await getOrgPolicy(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : existing.title;
    const version =
      typeof body.version === "string" && body.version.trim()
        ? body.version.trim()
        : existing.version;
    const owner =
      typeof body.owner === "string" && body.owner.trim()
        ? body.owner.trim()
        : existing.owner;
    const category = body.category !== undefined ? body.category : existing.category;
    const status = body.status !== undefined ? body.status : existing.status;

    if (!isPolicyCategory(category)) {
      return NextResponse.json(
        {
          error:
            "category must be climate, travel, supplier_code, environment, health_safety, ethics, or other",
        },
        { status: 400 },
      );
    }
    if (!isPolicyStatus(status)) {
      return NextResponse.json(
        { error: "status must be draft, active, or retired" },
        { status: 400 },
      );
    }

    let effectiveDate = existing.effectiveDate;
    if (body.effectiveDate !== undefined) {
      const parsed = parseEffectiveDate(body.effectiveDate);
      if (!parsed) {
        return NextResponse.json(
          { error: "effectiveDate must be YYYY-MM-DD" },
          { status: 400 },
        );
      }
      effectiveDate = parsed;
    }

    let documentUrl = existing.documentUrl;
    if (body.documentUrl !== undefined) {
      const parsed = parseOptionalUrl(body.documentUrl);
      if (parsed === undefined) {
        return NextResponse.json(
          { error: "documentUrl must be an http(s) URL when provided" },
          { status: 400 },
        );
      }
      documentUrl = parsed;
    }

    let documentId = existing.documentId;
    if (body.documentId !== undefined) {
      if (body.documentId === null || body.documentId === "") {
        documentId = null;
      } else if (typeof body.documentId === "string" && body.documentId.trim()) {
        documentId = body.documentId.trim();
        const media = await payload
          .findByID({
            collection: "media",
            id: documentId,
            depth: 0,
            overrideAccess: true,
          })
          .catch(() => null);
        if (!media) {
          return NextResponse.json(
            { error: "documentId must reference an existing Media file" },
            { status: 400 },
          );
        }
      } else {
        return NextResponse.json(
          { error: "documentId must be a Media id string or null" },
          { status: 400 },
        );
      }
    }

    const updated = await payload.update({
      collection: POLICIES_SLUG,
      id,
      data: {
        title,
        category,
        status,
        version,
        owner,
        effectiveDate,
        document: documentId,
        documentUrl,
        notes:
          body.notes !== undefined
            ? typeof body.notes === "string" && body.notes.trim()
              ? body.notes.trim()
              : null
            : existing.notes,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ policy: docToPolicy(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Policy library update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canDelete(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const existing = await getOrgPolicy(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    await payload.delete({
      collection: POLICIES_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Policy library delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
