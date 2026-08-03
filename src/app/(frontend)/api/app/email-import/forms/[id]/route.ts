import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  buildInboundAddress,
  buildSubjectTokenHint,
  generateInboundToken,
  normalizeEmailAddress,
} from "@/lib/emailImport";
import config from "@/payload.config";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/app/email-import/forms/[id]
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await getPayload({ config });
    const form = await payload.findByID({
      collection: "email-data-collection-forms",
      id,
      depth: 0,
      overrideAccess: true,
    });

    const orgId =
      typeof form.organisation === "string" ? form.organisation : form.organisation?.id;
    if (orgId !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const extended = form as typeof form & {
      inboundEnabled?: boolean | null;
      inboundToken?: string | null;
      whitelistedSenders?: Array<{ email: string; label?: string | null }> | null;
      recurringEnabled?: boolean | null;
      recurringCadence?: string | null;
      lastImportAt?: string | null;
    };

    const inboundToken = extended.inboundToken ?? null;

    return NextResponse.json({
      id: form.id,
      formName: form.formName,
      formType: form.formType,
      status: form.status,
      inboundEnabled: extended.inboundEnabled ?? false,
      inboundToken,
      inboundAddress: inboundToken ? buildInboundAddress(inboundToken) : null,
      subjectTokenHint: inboundToken ? buildSubjectTokenHint(inboundToken) : null,
      whitelistedSenders: (extended.whitelistedSenders ?? []).map((s) => ({
        email: s.email,
        label: s.label ?? null,
      })),
      recurringEnabled: extended.recurringEnabled ?? false,
      recurringCadence: extended.recurringCadence ?? "none",
      lastImportAt: extended.lastImportAt ?? null,
      recipientCount: form.recipientCount,
      responseCount: form.responseCount,
      responseRate: form.responseRate,
      emailSubject: form.emailSubject,
      emailBody: form.emailBody,
    });
  } catch (error) {
    console.error(
      "email-import form get error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/**
 * PATCH /api/app/email-import/forms/[id]
 * Enable/disable inbound, update whitelist, recurring settings, activate form.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "edit",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      status?: "draft" | "active" | "closed" | "archived";
      inboundEnabled?: boolean;
      whitelistedSenders?: Array<{ email: string; label?: string }>;
      recurringEnabled?: boolean;
      recurringCadence?: "none" | "weekly" | "monthly" | "quarterly";
      rotateInboundToken?: boolean;
      emailSubject?: string;
      emailBody?: string;
      formName?: string;
    };

    const payload = await getPayload({ config });
    const existing = await payload.findByID({
      collection: "email-data-collection-forms",
      id,
      depth: 0,
      overrideAccess: true,
    });

    const orgId =
      typeof existing.organisation === "string"
        ? existing.organisation
        : existing.organisation?.id;
    if (orgId !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.inboundEnabled !== undefined) data.inboundEnabled = body.inboundEnabled;
    if (body.recurringEnabled !== undefined) {
      data.recurringEnabled = body.recurringEnabled;
    }
    if (body.recurringCadence !== undefined) {
      data.recurringCadence = body.recurringCadence;
    }
    if (body.formName !== undefined) data.formName = body.formName;
    if (body.emailSubject !== undefined) data.emailSubject = body.emailSubject;
    if (body.emailBody !== undefined) data.emailBody = body.emailBody;

    if (body.whitelistedSenders !== undefined) {
      data.whitelistedSenders = body.whitelistedSenders.map((s) => ({
        email: normalizeEmailAddress(s.email),
        label: s.label,
      }));
    }

    const existingExt = existing as typeof existing & {
      inboundToken?: string | null;
    };
    if (body.rotateInboundToken || !existingExt.inboundToken) {
      data.inboundToken = generateInboundToken();
    }

    const updated = await (
      payload.update as (args: {
        collection: "email-data-collection-forms";
        id: string;
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<{
        id: string;
        status?: string | null;
        inboundEnabled?: boolean | null;
        inboundToken?: string | null;
        recurringEnabled?: boolean | null;
        recurringCadence?: string | null;
        whitelistedSenders?: Array<{ email: string }> | null;
      }>
    )({
      collection: "email-data-collection-forms",
      id,
      data,
      overrideAccess: true,
    });

    const inboundToken = updated.inboundToken ?? null;

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      inboundEnabled: updated.inboundEnabled ?? false,
      inboundToken,
      inboundAddress: inboundToken ? buildInboundAddress(inboundToken) : null,
      subjectTokenHint: inboundToken ? buildSubjectTokenHint(inboundToken) : null,
      recurringEnabled: updated.recurringEnabled ?? false,
      recurringCadence: updated.recurringCadence ?? "none",
      whitelistedSenders: updated.whitelistedSenders ?? [],
      message: "Email collection form updated",
    });
  } catch (error) {
    console.error(
      "email-import form patch error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
