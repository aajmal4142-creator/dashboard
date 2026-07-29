import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
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

    // Create email collection form
    const form = await payload.create({
      collection: "email-data-collection-forms",
      data: {
        organisation: ctx.activeOrg.id,
        formName,
        formType: formType || "custom",
        status: "draft",
        emailSubject,
        emailBody,
        fields: fields || [],
        recipients: mappedRecipients,
        recipientCount: recipients?.length || 0,
        responseCount: 0,
        responseRate: 0,
        createdBy: ctx.user.id,
      },
    });

    return NextResponse.json(
      {
        formId: form.id,
        message: "Email collection form created",
        status: "draft",
      },
      { status: 201 },
    );
  } catch (error) {
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
      forms: forms.docs.map((f) => ({
        id: f.id,
        formName: f.formName,
        formType: f.formType,
        status: f.status,
        recipientCount: f.recipientCount,
        responseRate: f.responseRate,
      })),
    });
  } catch (error) {
    console.error("Error fetching email forms:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
