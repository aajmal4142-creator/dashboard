import { getPayload } from "payload";
import type { Where } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * GET /api/app/billing/invoices?status=paid&limit=10&offset=0
 * List invoices for organization
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const payload = await getPayload({ config });

    const whereClause: Where = {
      organisation: { equals: ctx.activeOrg.id },
    };

    if (
      status &&
      ["draft", "sent", "paid", "overdue", "failed", "refunded"].includes(status)
    ) {
      whereClause.status = { equals: status };
    }

    const invoices = await payload.find({
      collection: "invoices",
      where: whereClause,
      limit,
      page: Math.floor(offset / limit) + 1,
      sort: "-issueDate",
    });

    return NextResponse.json({
      invoices: invoices.docs || [],
      total: invoices.totalDocs,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
