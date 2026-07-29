import { getPayload } from "payload";
import type { Where } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { CACHE_HEADERS } from "@/lib/api/cache-headers";
import config from "@/payload.config";
import { logger, getRequestId } from "@/lib/logging/logger";

/**
 * GET /api/app/billing/invoices?status=paid&limit=10&offset=0
 * List invoices for organization
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      logger.warn("Unauthorized invoice access attempt", {
        requestId,
        userId: ctx.user?.id,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const limitParam = parseInt(url.searchParams.get("limit") || "20");
    if (!Number.isInteger(limitParam) || limitParam < 1 || limitParam > 100) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 });
    }
    const limit = limitParam;

    const offsetParam = parseInt(url.searchParams.get("offset") || "0");
    if (!Number.isInteger(offsetParam) || offsetParam < 0) {
      return NextResponse.json({ error: "Invalid offset parameter" }, { status: 400 });
    }
    const offset = offsetParam;

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

    const duration = Date.now() - startTime;
    logger.api("GET", "/api/app/billing/invoices", 200, duration, {
      requestId,
      userId: ctx.user.id,
      organisationId: ctx.activeOrg.id,
      invoiceCount: invoices.docs?.length || 0,
    });

    return NextResponse.json(
      {
        invoices: invoices.docs || [],
        total: invoices.totalDocs,
        limit,
        offset,
      },
      {
        headers: CACHE_HEADERS.MINIMAL, // Invoices change frequently
      },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Error fetching invoices", error, {
      requestId,
      duration,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
