import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * GET /api/app/billing/invoices/[id]
 * Get invoice details
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

    // Verify invoice belongs to user's org
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

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
