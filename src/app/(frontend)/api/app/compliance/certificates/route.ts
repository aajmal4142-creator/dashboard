import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ENERGY_CERTIFICATES_SLUG } from "@/collections/EnergyCertificates";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  docToEnergyCertificate,
  isCertificateStatus,
  isCertificateType,
  listOrgCertificates,
  listOrgPeriods,
} from "@/lib/certificates";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/certificates — list certificates (+ periods)
 * POST — create certificate line
 */
export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId") ?? undefined;
    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && isCertificateStatus(statusParam) ? statusParam : undefined;

    if (statusParam && !status) {
      return NextResponse.json(
        { error: "status must be active, retired, or expired" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const [certificates, periods] = await Promise.all([
      listOrgCertificates(payload, ctx.activeOrg.id, { periodId, status }),
      listOrgPeriods(payload, ctx.activeOrg.id),
    ]);

    return NextResponse.json({
      certificates,
      total: certificates.length,
      periods,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Certificates list error:", error);
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
      "create",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as Record<string, unknown>;
    const certificateType = body.certificateType;
    const volumeKwh = Number(body.volumeKwh);
    const vintageYear = Number(body.vintageYear);
    const region = typeof body.region === "string" ? body.region.trim() : "";
    const periodId = typeof body.periodId === "string" ? body.periodId.trim() : "";
    const status = body.status === undefined ? "active" : body.status;

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
    if (!region) {
      return NextResponse.json({ error: "region is required" }, { status: 400 });
    }
    if (!periodId) {
      return NextResponse.json({ error: "periodId is required" }, { status: 400 });
    }
    if (!isCertificateStatus(status)) {
      return NextResponse.json(
        { error: "status must be active, retired, or expired" },
        { status: 400 },
      );
    }

    let country: string | null | undefined;
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

    const payload = await getPayload({ config });
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

    const created = await payload.create({
      collection: ENERGY_CERTIFICATES_SLUG,
      data: {
        organisation: ctx.activeOrg.id,
        label:
          typeof body.label === "string" && body.label.trim()
            ? body.label.trim()
            : undefined,
        certificateType,
        volumeKwh,
        vintageYear,
        region,
        country: country === undefined ? undefined : country,
        status,
        period: periodId,
        supplier:
          typeof body.supplier === "string" && body.supplier.trim()
            ? body.supplier.trim()
            : undefined,
        notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : undefined,
      },
      overrideAccess: true,
    });

    return NextResponse.json(
      { certificate: docToEnergyCertificate(created) },
      { status: 201 },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Certificates create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
