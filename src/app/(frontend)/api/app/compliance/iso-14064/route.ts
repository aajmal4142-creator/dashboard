import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/iso-14064
 * Get ISO 14064 compliance status for organization
 */
export async function GET(_request: Request) {
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

    const payload = await getPayload({ config });

    const compliance = await payload.find({
      collection: "iso-14064-compliance",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 1,
    });

    if (!compliance.docs?.[0]) {
      return NextResponse.json({ status: "not_started", checklist: [] });
    }

    const record = compliance.docs[0];

    return NextResponse.json({
      id: record.id,
      status: record.status,
      complianceScore: record.complianceScore,
      checklist: record.checklist,
      gaps: record.gaps,
      lastAuditDate: record.lastAuditDate,
      nextAuditDate: record.nextAuditDate,
      auditor: record.auditor,
      verificationNotes: record.verificationNotes,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching ISO 14064 compliance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/compliance/iso-14064/create
 * Create or initialize ISO 14064 compliance record
 */
export async function POST(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "billing",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    // Check if already exists
    const existing = await payload.find({
      collection: "iso-14064-compliance",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 1,
    });

    if (existing.docs?.[0]) {
      return NextResponse.json(
        { error: "Compliance record already exists" },
        { status: 400 },
      );
    }

    // Create with default ISO 14064 checklist
    const defaultChecklist = [
      {
        requirement: "Organizational boundaries defined",
        description: "Define equity/financial control boundaries",
        status: "not_started" as const,
      },
      {
        requirement: "GHG inventory boundaries defined",
        description: "Set temporal and operational boundaries",
        status: "not_started" as const,
      },
      {
        requirement: "Emission sources identified",
        description: "Identify all relevant emission sources",
        status: "not_started" as const,
      },
      {
        requirement: "Calculation methodologies selected",
        description: "Choose calculation methods for each source",
        status: "not_started" as const,
      },
      {
        requirement: "Data collection procedures",
        description: "Establish data quality & collection protocols",
        status: "not_started" as const,
      },
      {
        requirement: "Uncertainty analysis performed",
        description: "Quantify uncertainty in calculations",
        status: "not_started" as const,
      },
      {
        requirement: "QA/QC procedures implemented",
        description: "Implement quality assurance and control",
        status: "not_started" as const,
      },
    ];

    const record = await payload.create({
      collection: "iso-14064-compliance",
      data: {
        organisation: ctx.activeOrg.id,
        status: "in_progress",
        complianceScore: 0,
        checklist: defaultChecklist,
        gaps: [],
      },
    });

    return NextResponse.json(
      {
        id: record.id,
        message: "ISO 14064 compliance record created",
        status: "in_progress",
      },
      { status: 201 },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating ISO 14064 compliance record:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
