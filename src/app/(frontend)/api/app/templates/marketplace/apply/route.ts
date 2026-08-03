import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { REPORT_TEMPLATES_SLUG } from "@/collections/ReportTemplates";
import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  appendAppliedTemplate,
  buildAppliedEntry,
  buildOrgTemplateCreateData,
  canApplyMarketplace,
  getMarketplaceTemplate,
  parseApplyBody,
  parseAppliedEntries,
} from "@/lib/templates/marketplace";
import type { Organisation } from "@/payload-types";
import config from "@/payload.config";

/**
 * POST /api/app/templates/marketplace/apply
 * Copy a free marketplace template into the active org (Membership-auth).
 * Appends an appliedMarketplaceTemplates entry — never rewrites prior rows.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canApplyMarketplace(ctx.role)) {
      return NextResponse.json(
        { error: "Forbidden — contributor or above required to apply templates" },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = parseApplyBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const template = getMarketplaceTemplate(parsed.templateKey);
    if (!template) {
      return NextResponse.json(
        { error: "Unknown marketplace template" },
        { status: 404 },
      );
    }

    const payload = await getPayload({ config });
    const createData = buildOrgTemplateCreateData({
      template,
      organisationId: ctx.activeOrg.id,
      userId: ctx.user.id,
    });

    const doc = await payload.create({
      collection: REPORT_TEMPLATES_SLUG,
      data: {
        organisation: createData.organisation,
        templateName: createData.templateName,
        description: createData.description,
        purpose: createData.purpose,
        industry: createData.industry,
        framework: createData.framework,
        type: createData.type,
        isPublic: false,
        version: 1,
        createdBy: createData.createdBy ?? undefined,
        sections: createData.sections,
        questions: createData.questions,
        calculations: createData.calculations,
        templateConfig: createData.templateConfig,
      },
      overrideAccess: true,
    });

    const org = (await payload.findByID({
      collection: "organisations",
      id: ctx.activeOrg.id,
      depth: 0,
      overrideAccess: true,
    })) as Organisation;

    const existing = parseAppliedEntries(org.appliedMarketplaceTemplates);
    const entry = buildAppliedEntry({
      template,
      reportTemplateId: String(doc.id),
      appliedAt: new Date().toISOString(),
      appliedBy: ctx.user.id,
    });
    const applied = appendAppliedTemplate(existing, entry);

    await payload.update({
      collection: "organisations",
      id: ctx.activeOrg.id,
      data: {
        appliedMarketplaceTemplates: applied.map((row) => ({
          templateKey: row.templateKey,
          templateName: row.templateName,
          kind: row.kind,
          industry: row.industry,
          reportTemplateId: row.reportTemplateId,
          appliedAt: row.appliedAt,
          ...(row.appliedBy ? { appliedBy: row.appliedBy } : {}),
        })),
      },
      overrideAccess: true,
    });

    await writeAuditLog(payload, {
      organisationId: ctx.activeOrg.id,
      actorId: ctx.user.id,
      action: "marketplace_template.apply",
      entityType: "report-template",
      entityId: String(doc.id),
      after: {
        marketplaceKey: template.key,
        templateName: createData.templateName,
        kind: template.kind,
        industry: template.industry,
      },
    });

    return NextResponse.json(
      {
        id: doc.id,
        templateName: doc.templateName,
        marketplaceKey: template.key,
        kind: template.kind,
        industry: template.industry,
        applied,
        href: createData.purpose === "compliance" ? "/compliance-templates" : "/reports",
      },
      { status: 201 },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error applying marketplace template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
