import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * GET /api/app/billing/invoices/[id]/download
 * Download invoice PDF
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payload = await getPayload({ config });

    const invoice = await payload.findByID({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: "invoices" as any,
      id,
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Verify invoice belongs to user's org
    if (invoice.organisation !== ctx.activeOrg.id) {
      return NextResponse.json(
        { error: "You don't have access to this invoice" },
        { status: 403 }
      );
    }

    // If PDF URL exists, redirect to it
    if (invoice.pdfUrl) {
      return NextResponse.redirect(invoice.pdfUrl);
    }

    // Otherwise return invoice data with suggestion to generate PDF
    return NextResponse.json({
      error: "PDF not yet generated",
      invoice,
      message: "PDF generation is queued and will be available shortly",
    }, { status: 202 });
  } catch (error) {
    console.error("Error downloading invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
