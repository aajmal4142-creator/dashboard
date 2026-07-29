import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { createPdfGenerator } from "@/lib/billing/pdfGenerator";
import type {
  Invoice as BillingInvoice,
  Plan as BillingPlan,
  Subscription as BillingSubscription,
} from "@/lib/billing/types";

/**
 * GET /api/app/billing/invoices/[id]/download
 * Download invoice PDF (generates on-demand if not cached)
 */
export async function GET(
  _request: Request,
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

    if (invoice.pdfUrl) {
      return NextResponse.redirect(invoice.pdfUrl);
    }

    try {
      const subscriptionId =
        typeof invoice.subscription === "object"
          ? invoice.subscription.id
          : String(invoice.subscription);

      const subscription = await payload.findByID({
        collection: "subscriptions",
        id: subscriptionId,
      });

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

      const pdfGenerator = createPdfGenerator();
      const pdfBuffer = await pdfGenerator.generateInvoicePdf(
        invoice as unknown as BillingInvoice,
        { id: org.id, name: org.name },
        subscription as unknown as BillingSubscription,
        plan as unknown as BillingPlan,
      );

      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
          "Cache-Control": "public, max-age=31536000",
        },
      });
    } catch (genError) {
      console.error("Error generating PDF:", genError);
      return NextResponse.json(
        {
          error: "Failed to generate PDF",
          message: "Please try again later",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error downloading invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
