import { getPayload } from "payload";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildSfdrPaiPack,
  computeSfdrCoverage,
  sfdrPaiPackToPlainText,
  type SfdrDatapointInput,
  type SfdrOrgProfileInput,
} from "@/lib/frameworks/sfdr";
import { ensureOpenPeriod } from "@/lib/org/period";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function evidenceIdsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.length > 0) return [item];
    if (typeof item === "object" && item !== null && "id" in item) {
      const id = (item as { id: unknown }).id;
      if (typeof id === "string" && id.length > 0) return [id];
    }
    return [];
  });
}

function asQuality(value: unknown): SfdrDatapointInput["quality"] {
  if (
    value === "measured" ||
    value === "calculated" ||
    value === "estimated" ||
    value === "missing"
  ) {
    return value;
  }
  return "missing";
}

function asProvenance(value: unknown): SfdrDatapointInput["provenance"] {
  if (
    value === "supplier_primary" ||
    value === "spend_estimate" ||
    value === "manual"
  ) {
    return value;
  }
  return null;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
}

/**
 * GET /api/app/frameworks/sfdr/coverage?periodId=&pack=
 * Deterministic SFDR PAI Table 1 coverage for the active org.
 * Pass pack=1 to include a plain-text PAI readiness pack.
 */
export async function GET(req: NextRequest) {
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
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await getPayload({ config });
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const periodId =
      typeof params.periodId === "string" && params.periodId.length > 0
        ? params.periodId
        : await ensureOpenPeriod(
            ctx.activeOrg.id,
            ctx.activeOrg.plan,
            ctx.activeOrg.subscriptionStatus,
          );

    const period = await payload.findByID({
      collection: "reporting-periods",
      id: periodId,
      depth: 0,
      overrideAccess: true,
    });
    const periodOrg =
      typeof period.organisation === "string"
        ? period.organisation
        : period.organisation?.id;
    if (periodOrg !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Period not in organisation" }, { status: 403 });
    }

    const org = await payload.findByID({
      collection: "organisations",
      id: ctx.activeOrg.id,
      depth: 0,
      overrideAccess: true,
    });

    const orgProfile: SfdrOrgProfileInput = {
      name: asStringOrNull(org.name) ?? asStringOrNull(ctx.activeOrg.name),
      country: asStringOrNull(org.country) ?? asStringOrNull(ctx.activeOrg.country),
      sector: asStringOrNull(org.sector) ?? asStringOrNull(ctx.activeOrg.sector),
      revenueBand:
        asStringOrNull(org.revenueBand) ??
        asStringOrNull(ctx.activeOrg.revenueBand),
    };

    const datapoints = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: periodId } },
        ],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    });

    const inputs: SfdrDatapointInput[] = datapoints.docs.map((doc) => ({
      metricKey: String(doc.metricKey),
      quality: asQuality(doc.quality),
      provenance: asProvenance(doc.provenance),
      evidenceIds: evidenceIdsOf(doc.evidence),
    }));

    const coverage = computeSfdrCoverage({
      periodId,
      datapoints: inputs,
      orgProfile,
    });

    const periodLabel =
      typeof period.label === "string" ? period.label : periodId;

    const includePack =
      params.pack === "1" || params.pack === "true" || params.pack === "yes";

    const pack = includePack
      ? buildSfdrPaiPack({ coverage, periodLabel })
      : null;

    return NextResponse.json({
      success: true,
      periodLabel,
      coverage,
      pack: pack
        ? {
            ...pack,
            plainText: sfdrPaiPackToPlainText(pack),
          }
        : undefined,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("SFDR PAI coverage error:", error);
    return NextResponse.json(
      { error: "Failed to compute SFDR PAI coverage" },
      { status: 500 },
    );
  }
}
