import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { POLICIES_SLUG } from "@/collections/Policies";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToPolicy,
  isPolicyCategory,
  isPolicyStatus,
  listOrgPolicies,
  parseEffectiveDate,
  parseOptionalUrl,
} from "@/lib/policies";
import config from "@/payload.config";

function canWrite(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

/**
 * GET /api/app/policy-library — list org policy documents
 * POST — create policy document
 *
 * Note: /api/app/policies/* is reserved for RBAC (user-policies / roles).
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const categoryParam = url.searchParams.get("category");
    const statusParam = url.searchParams.get("status");

    const category =
      categoryParam && isPolicyCategory(categoryParam) ? categoryParam : undefined;
    if (categoryParam && !category) {
      return NextResponse.json(
        {
          error:
            "category must be climate, travel, supplier_code, environment, health_safety, ethics, or other",
        },
        { status: 400 },
      );
    }

    const status = statusParam && isPolicyStatus(statusParam) ? statusParam : undefined;
    if (statusParam && !status) {
      return NextResponse.json(
        { error: "status must be draft, active, or retired" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const policies = await listOrgPolicies(payload, ctx.activeOrg.id, {
      category,
      status,
    });

    return NextResponse.json({
      policies,
      total: policies.length,
      canWrite: canWrite(ctx.role),
      canDelete: ctx.role === "owner" || ctx.role === "admin",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Policy library list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const version = typeof body.version === "string" ? body.version.trim() : "";
    const owner = typeof body.owner === "string" ? body.owner.trim() : "";
    const category = body.category;
    const status = body.status === undefined ? "draft" : body.status;
    const effectiveDate = parseEffectiveDate(body.effectiveDate);
    const documentUrl = parseOptionalUrl(body.documentUrl);
    const documentId =
      body.documentId === undefined || body.documentId === null || body.documentId === ""
        ? null
        : typeof body.documentId === "string"
          ? body.documentId.trim()
          : null;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
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
    if (!version) {
      return NextResponse.json({ error: "version is required" }, { status: 400 });
    }
    if (!owner) {
      return NextResponse.json({ error: "owner is required" }, { status: 400 });
    }
    if (!effectiveDate) {
      return NextResponse.json(
        { error: "effectiveDate must be YYYY-MM-DD" },
        { status: 400 },
      );
    }
    if (documentUrl === undefined) {
      return NextResponse.json(
        { error: "documentUrl must be an http(s) URL when provided" },
        { status: 400 },
      );
    }
    if (
      body.documentId !== undefined &&
      body.documentId !== null &&
      body.documentId !== ""
    ) {
      if (typeof body.documentId !== "string" || !body.documentId.trim()) {
        return NextResponse.json(
          { error: "documentId must be a Media id string or null" },
          { status: 400 },
        );
      }
    }

    const payload = await getPayload({ config });

    if (documentId) {
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
    }

    const created = await payload.create({
      collection: POLICIES_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        title,
        category,
        status,
        version,
        owner,
        effectiveDate,
        document: documentId ?? undefined,
        documentUrl: documentUrl ?? undefined,
        notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : undefined,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ policy: docToPolicy(created) }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Policy library create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
