import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import type { Where } from "payload";
import type { AssurancePartner } from "@/payload-types";

/**
 * GET /api/app/assurance-partners/search?location=...&cert=...&minRating=...
 * Search assurance partner directory
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "billing",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(request.url);
    const location = url.searchParams.get("location");
    const cert = url.searchParams.get("cert");
    const minRating = url.searchParams.get("minRating");

    const payload = await getPayload({ config });

    // Build query filters
    const where: Where = {};

    if (location) {
      where.country = { contains: location };
    }

    if (minRating) {
      where.rating = { greater_than_equal: parseFloat(minRating) };
    }

    // Get partners
    const partners = await payload.find({
      collection: "assurance-partners",
      where,
      limit: 50,
    });

    // Filter by certification if specified
    let filtered: AssurancePartner[] = partners.docs;
    if (cert) {
      filtered = partners.docs.filter((p) => {
        const certs = p.certifications ?? [];
        return certs.some((c) => c.cert === cert);
      });
    }

    return NextResponse.json({
      total: filtered.length,
      partners: filtered.map((p) => ({
        id: p.id,
        name: p.firmName,
        website: p.website,
        email: p.contactEmail,
        location: p.location,
        rating: p.rating,
        certifications: p.certifications,
        specializations: p.specializations,
        availability: p.availability,
        leadTime: p.leadTime,
      })),
    });
  } catch (error) {
    console.error("Error searching assurance partners:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
