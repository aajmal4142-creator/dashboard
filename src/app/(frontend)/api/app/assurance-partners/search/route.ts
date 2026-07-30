import { getPayload } from "payload";
import { NextResponse } from "next/server";

import {
  buildPartnerWhere,
  mapPartnerDoc,
  parsePartnerSearchParams,
} from "@/lib/assurancePartners";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

/**
 * GET /api/app/assurance-partners/search
 * Same DB-side filters as the list route (country, specialization, cert, firmType, q).
 * Kept for backward compatibility with F0 path.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const params = parsePartnerSearchParams(url);
    const where = buildPartnerWhere(params);

    const payload = await getPayload({ config });
    const partners = await payload.find({
      collection: "assurance-partners",
      where,
      limit: 100,
      sort: "firmName",
    });

    return NextResponse.json({
      total: partners.totalDocs,
      partners: partners.docs.map(mapPartnerDoc),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error searching assurance partners:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
