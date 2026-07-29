import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { createEmailService } from "@/lib/billing/emailService";
import { createPdfGenerator } from "@/lib/billing/pdfGenerator";
import type {
  Invoice as BillingInvoice,
  Plan as BillingPlan,
  Subscription as BillingSubscription,
} from "@/lib/billing/types";

/**
 * POST /api/app/billing/invoices/[id]/send-email
 * Send invoice email with PDF attachment
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payload = await getPayload({ config });

    const invoice = await payload.findByID({
      collection: "invoices",
      id,
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const invoiceOrgId =
      typeof invoice.organisation === "object"
        ? invoice.organisation.id
        : String(invoice.organisation);

    if (invoiceOrgId !== ctx.activeOrg.id) {
      return NextResponse.json(
        { error: "You don't have access to this invoice" },
        { status: 403 },
      );
    }

    const subscriptionId =
      typeof invoice.subscription === "object"
        ? invoice.subscription.id
        : String(invoice.subscription);

    const subscription = await payload.findByID({
      collection: "subscriptions",
      id: subscriptionId,
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    if (!subscription.sendInvoices) {
      return NextResponse.json(
        { error: "Invoice emails are disabled for this subscription" },
        { status: 400 },
      );
    }

    let body: { email?: string };
    try {
      body = (await request.json()) as { email?: string };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }
    const recipientEmail = body.email || subscription.contactEmail;

    if (!recipientEmail) {
      return NextResponse.json(
        { error: "No email address specified and none configured on subscription" },
        { status: 400 },
      );
    }

    const planId =
      typeof subscription.plan === "object" ? subscription.plan.id : subscription.plan;
    const plan = await payload.findByID({
      collection: "plans",
      id: String(planId),
    });

    const org = await payload.findByID({
      collection: "organisations",
      id: invoiceOrgId,
    });

    const billingInvoice = invoice as unknown as BillingInvoice;
    const billingSubscription = subscription as unknown as BillingSubscription;
    const billingPlan = plan as unknown as BillingPlan;

    const pdfGenerator = createPdfGenerator();
    const pdfBuffer = await pdfGenerator.generateInvoicePdf(
      billingInvoice,
      { id: org.id, name: org.name },
      billingSubscription,
      billingPlan,
    );

    const emailService = createEmailService(payload);
    await emailService.sendInvoiceEmail(
      billingInvoice,
      [recipientEmail],
      pdfBuffer,
      invoice.invoiceNumber,
    );

    await payload.update({
      collection: "invoices",
      id,
      data: {
        status: "sent",
      },
    });

    return NextResponse.json({
      ok: true,
      sentAt: new Date().toISOString(),
      email: recipientEmail,
      invoiceNumber: invoice.invoiceNumber,
    });
  } catch (error) {
    console.error("Error sending invoice email:", error);
    return NextResponse.json(
      { error: "Failed to send invoice email", details: String(error) },
      { status: 500 },
    );
  }
}
