import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { CBAM_DECLARATIONS_SLUG } from "@/collections/CbamDeclarations";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToCbamDeclaration,
  findDeclaration,
  listOrgDeclarations,
  type CbamDeclarationStatus,
  type CbamQuarter,
} from "@/lib/cbam";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function parseQuarter(value: unknown): CbamQuarter | null {
  const v = String(value ?? "").replace(/^q/i, "");
  if (v === "1" || v === "2" || v === "3" || v === "4") return v;
  return null;
}

function parseStatus(value: unknown): CbamDeclarationStatus | null {
  if (value === "draft" || value === "submitted") return value;
  return null;
}

/**
 * GET /api/app/compliance/cbam/declarations — list quarterly drafts
 * POST — upsert draft for year+quarter (certificate price, status, notes)
 */
export async function GET() {
  try {
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
    const declarations = await listOrgDeclarations(payload, ctx.activeOrg.id);
    return NextResponse.json({ declarations, total: declarations.length });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("CBAM declarations list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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

    const body = (await req.json()) as Record<string, unknown>;
    const reportingYear = Number(body.reportingYear);
    const reportingQuarter = parseQuarter(body.reportingQuarter);
    const status = parseStatus(body.status) ?? "draft";
    const certificatePriceEur =
      body.certificatePriceEur === null || body.certificatePriceEur === ""
        ? null
        : body.certificatePriceEur === undefined
          ? undefined
          : Number(body.certificatePriceEur);

    if (
      !Number.isInteger(reportingYear) ||
      reportingYear < 2023 ||
      reportingYear > 2100
    ) {
      return NextResponse.json(
        { error: "reportingYear must be an integer between 2023 and 2100" },
        { status: 400 },
      );
    }
    if (!reportingQuarter) {
      return NextResponse.json(
        { error: "reportingQuarter must be 1–4" },
        { status: 400 },
      );
    }
    if (
      certificatePriceEur !== undefined &&
      certificatePriceEur !== null &&
      (!Number.isFinite(certificatePriceEur) || certificatePriceEur < 0)
    ) {
      return NextResponse.json(
        { error: "certificatePriceEur must be a non-negative number or null" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const existing = await findDeclaration(
      payload,
      ctx.activeOrg.id,
      reportingYear,
      reportingQuarter,
    );

    const label = `${reportingYear} Q${reportingQuarter}`;
    const notes =
      typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : body.notes === null
          ? null
          : undefined;

    if (existing) {
      const updated = await payload.update({
        collection: CBAM_DECLARATIONS_SLUG,
        id: existing.id,
        data: {
          label,
          status,
          ...(certificatePriceEur !== undefined ? { certificatePriceEur } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
        overrideAccess: true,
      });
      return NextResponse.json({ declaration: docToCbamDeclaration(updated) });
    }

    const created = await payload.create({
      collection: CBAM_DECLARATIONS_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        label,
        reportingYear,
        reportingQuarter,
        status,
        certificatePriceEur:
          certificatePriceEur === undefined ? undefined : certificatePriceEur,
        notes: notes === undefined ? undefined : notes,
      },
      overrideAccess: true,
    });

    return NextResponse.json(
      { declaration: docToCbamDeclaration(created) },
      { status: 201 },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("CBAM declaration upsert error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
