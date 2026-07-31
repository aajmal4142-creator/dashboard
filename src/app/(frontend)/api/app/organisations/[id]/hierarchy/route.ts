import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getApiContext } from "@/lib/auth/apiContext";
import {
  isConsolidationMethod,
  setOrganisationHierarchy,
  type ConsolidationMethod,
} from "@/lib/consolidation";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PUT /api/app/organisations/[id]/hierarchy
 * Set consolidation parent + method + ownership %. Owner/admin only.
 * Rejects circular hierarchies.
 */
export async function PUT(req: Request, context: RouteContext) {
  const auth = await getApiContext();
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const { id } = await context.params;

  const membership = ctx.memberships.find((m) => m.organisationId === id);
  if (!membership) {
    return NextResponse.json(
      { error: "No Membership on this organisation." },
      { status: 403 },
    );
  }
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json(
      { error: "Only owners and admins can edit organisation hierarchy." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    parentOrganisationId?: string | null;
    consolidationMethod?: string;
    ownershipPercent?: number;
  };

  const parentOrganisationId =
    body.parentOrganisationId === undefined
      ? null
      : body.parentOrganisationId === null || body.parentOrganisationId === ""
        ? null
        : String(body.parentOrganisationId);

  if (parentOrganisationId) {
    const parentMembership = ctx.memberships.find(
      (m) => m.organisationId === parentOrganisationId,
    );
    if (!parentMembership) {
      return NextResponse.json(
        {
          error:
            "Parent organisation must be one you have Membership on. Consolidation never includes inaccessible orgs.",
        },
        { status: 403 },
      );
    }
  }

  const consolidationMethod: ConsolidationMethod = isConsolidationMethod(
    body.consolidationMethod,
  )
    ? body.consolidationMethod
    : "full";

  const ownershipPercent =
    typeof body.ownershipPercent === "number" ? body.ownershipPercent : 100;

  const payload = await getPayload({ config });
  const result = await setOrganisationHierarchy(payload, {
    organisationId: id,
    parentOrganisationId,
    consolidationMethod,
    ownershipPercent,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    organisation: result.org,
    note: parentOrganisationId
      ? "Parent set. This organisation will appear in the parent's consolidated report."
      : "Parent cleared. This organisation is no longer included under a parent consolidation.",
  });
}
