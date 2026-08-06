import { getPayload } from "payload";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildCaliforniaPack,
  computeCaliforniaCoverage,
  defaultScope3Required,
  type CaliforniaDatapointInput,
  type CaliforniaLaw,
  type CaliforniaOrgProfileInput,
  type CaliforniaTcfdAnswerInput,
} from "@/lib/frameworks/california";
import { ensureOpenPeriod } from "@/lib/org/period";
import { requirePermission } from "@/lib/policy/protect";
import { TCFD_DISCLOSURES_SLUG } from "@/collections/TcfdDisclosures";
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

function asQuality(value: unknown): CaliforniaDatapointInput["quality"] {
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

function asProvenance(value: unknown): CaliforniaDatapointInput["provenance"] {
  if (
    value === "supplier_primary" ||
    value === "spend_estimate" ||
    value === "manual"
  ) {
    return value;
  }
  return null;
}

function parseLaw(value: string | null): CaliforniaLaw | null {
  if (value === "253" || value === "261") return value;
  return null;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
}

function tcfdAnswersFromDoc(answers: unknown): CaliforniaTcfdAnswerInput[] {
  if (!answers || typeof answers !== "object") return [];
  const rows: CaliforniaTcfdAnswerInput[] = [];
  for (const [questionId, raw] of Object.entries(answers)) {
    if (!raw || typeof raw !== "object") {
      rows.push({ questionId, hasText: false });
      continue;
    }
    const text = "text" in raw ? (raw as { text: unknown }).text : null;
    const hasText = typeof text === "string" && text.trim().length > 0;
    rows.push({ questionId, hasText });
  }
  return rows;
}

/**
 * GET /api/app/frameworks/california/coverage?law=253|261&periodId=&scope3=&pack=
 * Deterministic California SB 253 / SB 261 checklist coverage for the active org.
 * Pass pack=1 to include a plain-text SB 253/261 readiness pack.
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

    const params = Object.fromEntries(new URL(req.url).searchParams);
    const law = parseLaw(
      typeof params.law === "string" ? params.law : null,
    );
    if (!law) {
      return NextResponse.json(
        { error: "Query law must be 253 or 261" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
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

    const orgProfile: CaliforniaOrgProfileInput = {
      name: asStringOrNull(org.name) ?? asStringOrNull(ctx.activeOrg.name),
      country: asStringOrNull(org.country) ?? asStringOrNull(ctx.activeOrg.country),
      revenueBand:
        asStringOrNull(org.revenueBand) ??
        asStringOrNull(ctx.activeOrg.revenueBand),
      fiscalYearEnd:
        asStringOrNull(org.fiscalYearEnd) ??
        asStringOrNull(ctx.activeOrg.fiscalYearEnd),
      sector: asStringOrNull(org.sector) ?? asStringOrNull(ctx.activeOrg.sector),
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

    const inputs: CaliforniaDatapointInput[] = datapoints.docs.map((doc) => ({
      metricKey: String(doc.metricKey),
      quality: asQuality(doc.quality),
      provenance: asProvenance(doc.provenance),
      evidenceIds: evidenceIdsOf(doc.evidence),
    }));

    let tcfdAnswers: CaliforniaTcfdAnswerInput[] = [];
    if (law === "261") {
      const reportingYear =
        typeof period.endDate === "string"
          ? new Date(period.endDate).getUTCFullYear()
          : new Date().getUTCFullYear();

      const tcfd = await payload.find({
        collection: TCFD_DISCLOSURES_SLUG,
        where: {
          and: [
            { organisation: { equals: ctx.activeOrg.id } },
            { reportingYear: { equals: reportingYear } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        sort: "-updatedAt",
      });

      const latest =
        tcfd.docs[0] ??
        (
          await payload.find({
            collection: TCFD_DISCLOSURES_SLUG,
            where: { organisation: { equals: ctx.activeOrg.id } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            sort: "-reportingYear",
          })
        ).docs[0];

      tcfdAnswers = tcfdAnswersFromDoc(latest?.answers);
    }

    const reportingYear =
      typeof period.endDate === "string"
        ? new Date(period.endDate).getUTCFullYear()
        : null;

    const scope3Param = params.scope3;
    const scope3Required =
      scope3Param === "1" || scope3Param === "true"
        ? true
        : scope3Param === "0" || scope3Param === "false"
          ? false
          : defaultScope3Required(reportingYear);

    const coverage = computeCaliforniaCoverage({
      law,
      periodId,
      datapoints: inputs,
      orgProfile,
      tcfdAnswers,
      scope3Required,
      reportingYear,
    });

    const periodLabel =
      typeof period.label === "string" ? period.label : periodId;

    const includePack =
      params.pack === "1" || params.pack === "true" || params.pack === "yes";
    const pack = includePack ? buildCaliforniaPack({ coverage, periodLabel }) : null;

    return NextResponse.json({
      success: true,
      law,
      periodLabel,
      reportingYear,
      coverage,
      pack: pack ?? undefined,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("California coverage error:", error);
    return NextResponse.json(
      { error: "Failed to compute California coverage" },
      { status: 500 },
    );
  }
}
