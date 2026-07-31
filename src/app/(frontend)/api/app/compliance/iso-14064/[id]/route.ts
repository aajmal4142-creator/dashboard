import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  assignIso14064Verifier,
  getOrgIso14064ById,
  listOrgEvidenceOptions,
} from "@/lib/compliance/iso14064Service";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/app/compliance/iso-14064/[id]
 * Get a single checklist (org-scoped).
 *
 * PATCH — assign verifier (+ optional notice).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });
    const checklist = await getOrgIso14064ById(payload, ctx.activeOrg.id, id);
    if (!checklist) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    const evidenceOptions = await listOrgEvidenceOptions(payload, ctx.activeOrg.id);

    return NextResponse.json({ checklist, evidenceOptions });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching ISO 14064 checklist by id:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as {
      verifierUserId?: string;
      assurancePartnerId?: string | null;
      sendNotice?: boolean;
    };

    if (!body.verifierUserId || typeof body.verifierUserId !== "string") {
      return NextResponse.json({ error: "verifierUserId is required" }, { status: 400 });
    }

    const payload = await getPayload({ config });

    try {
      const checklist = await assignIso14064Verifier({
        payload,
        organisationId: ctx.activeOrg.id,
        checklistId: id,
        verifierUserId: body.verifierUserId,
        assurancePartnerId: body.assurancePartnerId ?? null,
        orgName: ctx.activeOrg.name,
        sendNotice: body.sendNotice !== false,
      });
      return NextResponse.json({ checklist });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assign failed";
      if (message.includes("not found")) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (message.includes("active member")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error assigning ISO 14064 verifier:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
