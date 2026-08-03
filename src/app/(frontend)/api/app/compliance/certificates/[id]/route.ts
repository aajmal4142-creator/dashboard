import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ENERGY_CERTIFICATES_SLUG } from "@/collections/EnergyCertificates";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToEnergyCertificate,
  getOrgCertificate,
  isCertificateStatus,
  isCertificateType,
} from "@/lib/certificates";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/app/compliance/certificates/[id]
 * PUT — update
 * DELETE — remove
 */
export async function GET(_req: Request, context: RouteContext) {
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

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const certificate = await getOrgCertificate(payload, ctx.activeOrg.id, id);
    if (!certificate) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    return NextResponse.json({ certificate });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Certificates get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
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

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const existing = await getOrgCertificate(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const certificateType =
      body.certificateType !== undefined
        ? body.certificateType
        : existing.certificateType;
    const volumeKwh =
      body.volumeKwh !== undefined ? Number(body.volumeKwh) : existing.volumeKwh;
    const vintageYear =
      body.vintageYear !== undefined ? Number(body.vintageYear) : existing.vintageYear;
    const region =
      typeof body.region === "string" && body.region.trim()
        ? body.region.trim()
        : existing.region;
    const periodId =
      typeof body.periodId === "string" && body.periodId.trim()
        ? body.periodId.trim()
        : existing.periodId;
    const status = body.status !== undefined ? body.status : existing.status;

    if (!isCertificateType(certificateType)) {
      return NextResponse.json(
        { error: "certificateType must be REC, GO, EAC, PPA, or green_tariff" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(volumeKwh) || volumeKwh < 0) {
      return NextResponse.json(
        { error: "volumeKwh must be a non-negative number" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(vintageYear) || vintageYear < 1990 || vintageYear > 2100) {
      return NextResponse.json(
        { error: "vintageYear must be an integer between 1990 and 2100" },
        { status: 400 },
      );
    }
    if (!isCertificateStatus(status)) {
      return NextResponse.json(
        { error: "status must be active, retired, or expired" },
        { status: 400 },
      );
    }

    let country = existing.country;
    if (body.country !== undefined) {
      if (body.country === null || body.country === "") {
        country = null;
      } else if (typeof body.country === "string") {
        const c = body.country.trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(c)) {
          return NextResponse.json(
            { error: "country must be ISO 3166-1 alpha-2 when provided" },
            { status: 400 },
          );
        }
        country = c;
      } else {
        return NextResponse.json(
          { error: "country must be a string or null" },
          { status: 400 },
        );
      }
    }

    const period = await payload
      .findByID({
        collection: "reporting-periods",
        id: periodId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null);
    const periodOrg =
      period &&
      (typeof period.organisation === "string"
        ? period.organisation
        : period.organisation?.id);
    if (!period || periodOrg !== ctx.activeOrg.id) {
      return NextResponse.json(
        { error: "periodId must reference a reporting period in this organisation" },
        { status: 400 },
      );
    }

    const updated = await payload.update({
      collection: ENERGY_CERTIFICATES_SLUG,
      id,
      data: {
        label:
          body.label !== undefined
            ? typeof body.label === "string" && body.label.trim()
              ? body.label.trim()
              : null
            : existing.label,
        certificateType,
        volumeKwh,
        vintageYear,
        region,
        country,
        status,
        period: periodId,
        supplier:
          body.supplier !== undefined
            ? typeof body.supplier === "string" && body.supplier.trim()
              ? body.supplier.trim()
              : null
            : existing.supplier,
        notes:
          body.notes !== undefined
            ? typeof body.notes === "string" && body.notes.trim()
              ? body.notes.trim()
              : null
            : existing.notes,
      },
      overrideAccess: true,
    });

    return NextResponse.json({ certificate: docToEnergyCertificate(updated) });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Certificates update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
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

    const { id } = await context.params;
    const payload = await getPayload({ config });
    const existing = await getOrgCertificate(payload, ctx.activeOrg.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    await payload.delete({
      collection: ENERGY_CERTIFICATES_SLUG,
      id,
      overrideAccess: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Certificates delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
