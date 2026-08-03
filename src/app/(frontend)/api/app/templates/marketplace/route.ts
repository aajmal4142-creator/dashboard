import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  canApplyMarketplace,
  filterMarketplaceTemplates,
  parseAppliedEntries,
  parseMarketplaceSearchParams,
} from "@/lib/templates/marketplace";
import type { Organisation } from "@/payload-types";
import config from "@/payload.config";

/**
 * GET /api/app/templates/marketplace
 * Membership-auth catalog list (static free starters + applied keys for active org).
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const filter = parseMarketplaceSearchParams(url);
    const templates = filterMarketplaceTemplates(filter);

    const payload = await getPayload({ config });
    const org = (await payload.findByID({
      collection: "organisations",
      id: ctx.activeOrg.id,
      depth: 0,
      overrideAccess: true,
    })) as Organisation;

    const applied = parseAppliedEntries(org.appliedMarketplaceTemplates);

    return NextResponse.json({
      templates,
      total: templates.length,
      applied,
      canApply: canApplyMarketplace(ctx.role),
      filters: filter,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing marketplace templates:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
