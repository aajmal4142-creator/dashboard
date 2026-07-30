import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { generateInboundToken, normalizeEmailAddress } from "@/lib/emailImport";
import config from "@/payload.config";
import type { EmailDataCollectionForm } from "@/payload-types";

type FormType = EmailDataCollectionForm["formType"];
type FormField = NonNullable<EmailDataCollectionForm["fields"]>[number];
type FormRecipient = NonNullable<EmailDataCollectionForm["recipients"]>[number];

/**
 * POST /api/app/email-import/forms
 * Create a new email data collection form
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as {
      formName?: string;
      formType?: FormType;
      emailSubject?: string;
      emailBody?: string;
      fields?: FormField[];
      recipients?: Array<{ email: string; name?: string; company?: string }>;
      inboundEnabled?: boolean;
      whitelistedSenders?: Array<{ email: string; label?: string }>;
      recurringEnabled?: boolean;
      recurringCadence?: "none" | "weekly" | "monthly" | "quarterly";
      status?: "draft" | "active";
    };
    const { formName, formType, emailSubject, emailBody, fields, recipients } = body;

    if (!formName || !emailSubject || !emailBody) {
      return NextResponse.json(
        { error: "formName, emailSubject, and emailBody are required" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });

    const mappedRecipients: FormRecipient[] = recipients
      ? recipients.map((r) => ({
          email: r.email,
          name: r.name,
          company: r.company,
          status: "pending" as const,
        }))
      : [];

    const whitelist = (body.whitelistedSenders ?? []).map((s) => ({
      email: normalizeEmailAddress(s.email),
      label: s.label,
    }));

    const inboundToken = generateInboundToken();

    const form = await (
      payload.create as (args: {
        collection: "email-data-collection-forms";
        data: Record<string, unknown>;
      }) => Promise<{ id: string; status?: string | null; inboundToken?: string | null }>
    )({
      collection: "email-data-collection-forms",
      data: {
        organisation: ctx.activeOrg.id,
        formName,
        formType: formType || "custom",
        status: body.status === "active" ? "active" : "draft",
        emailSubject,
        emailBody,
        fields: fields || [],
        recipients: mappedRecipients,
        recipientCount: recipients?.length || 0,
        responseCount: 0,
        responseRate: 0,
        createdBy: ctx.user.id,
        inboundEnabled: body.inboundEnabled === true,
        inboundToken,
        whitelistedSenders: whitelist,
        recurringEnabled: body.recurringEnabled === true,
        recurringCadence: body.recurringCadence ?? "none",
      },
    });

    return NextResponse.json(
      {
        formId: form.id,
        message: "Email collection form created",
        status: form.status ?? "draft",
        inboundToken: form.inboundToken ?? inboundToken,
        inboundEnabled: body.inboundEnabled === true,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating email form:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/app/email-import/forms
 * List email collection forms
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
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    const forms = await payload.find({
      collection: "email-data-collection-forms",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 50,
    });

    return NextResponse.json({
      total: forms.totalDocs,
      forms: forms.docs.map((f) => {
        const ext = f as typeof f & {
          inboundEnabled?: boolean | null;
          recurringEnabled?: boolean | null;
          lastImportAt?: string | null;
        };
        return {
          id: f.id,
          formName: f.formName,
          formType: f.formType,
          status: f.status,
          recipientCount: f.recipientCount,
          responseRate: f.responseRate,
          inboundEnabled: ext.inboundEnabled ?? false,
          recurringEnabled: ext.recurringEnabled ?? false,
          lastImportAt: ext.lastImportAt ?? null,
        };
      }),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching email forms:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
